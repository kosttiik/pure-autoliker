/*
 * Pure Auto-Liker — фоновый service worker.
 * Шлёт ДОВЕРЕННЫЕ (isTrusted=true) клики через chrome.debugger / CDP
 * Input.dispatchMouseEvent. Это единственный способ из расширения нажать
 * кнопку, которую сайт защищает проверкой isTrusted (анти-бот).
 *
 * Пока работает — на вкладке висит баннер «…выполняет отладку браузера».
 * Это нормально, снимать его нельзя (иначе клики перестанут проходить).
 */
const LOG = '[PureLiker/bg]';
const attached = new Set(); // tabId, к которым прицеплен дебаггер

function attach(tabId) {
  return new Promise((resolve, reject) => {
    if (attached.has(tabId)) { resolve(); return; }
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
      attached.add(tabId);
      console.log(LOG, 'debugger attached to tab', tabId);
      resolve();
    });
  });
}

function detach(tabId) {
  return new Promise((resolve) => {
    if (!attached.has(tabId)) { resolve(); return; }
    chrome.debugger.detach({ tabId }, () => { attached.delete(tabId); resolve(); });
  });
}

function cmd(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (res) => {
      if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
      resolve(res);
    });
  });
}

async function trustedClick(tabId, x, y) {
  await attach(tabId);
  // Наводим курсор, затем нажатие и отпускание левой кнопки в одной точке.
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
}

// Доверенная прокрутка колесом — как будто пользователь крутит мышь над лентой.
// Надёжно триггерит ленивую подгрузку, в отличие от программного scrollTop.
async function trustedWheel(tabId, x, y, deltaY) {
  await attach(tabId);
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, pointerType: 'mouse' });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (!msg || !msg.cmd || !tabId) return;

  if (msg.cmd === 'trustedClick') {
    trustedClick(tabId, msg.x, msg.y).then(
      () => sendResponse({ ok: true }),
      (e) => {
        console.warn(LOG, 'trustedClick error', e);
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    );
    return true; // async
  }

  if (msg.cmd === 'trustedWheel') {
    trustedWheel(tabId, msg.x, msg.y, msg.deltaY).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true; // async
  }

  if (msg.cmd === 'detachDebugger') {
    detach(tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Если пользователь сам снял баннер/закрыл вкладку — забываем состояние.
chrome.debugger.onDetach.addListener((src) => { if (src.tabId != null) attached.delete(src.tabId); });
chrome.tabs.onRemoved.addListener((tabId) => { attached.delete(tabId); });
