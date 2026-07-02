/*
 * Pure Auto-Liker — background service worker.
 * Sends TRUSTED (isTrusted=true) input via chrome.debugger / CDP. This is the
 * only way an extension can press a button that the site guards with an
 * isTrusted check (anti-bot).
 *
 * While attached, Chrome shows the "…started debugging this browser" banner on
 * the tab. Closing it detaches the debugger and breaks the clicks.
 */
const LOG = '[PureLiker/bg]';
const attached = new Set(); // tabIds with an attached debugger

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
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
}

// Programmatic scrollTop doesn't trigger the virtualized feed's lazy loading —
// a trusted wheel event does.
async function trustedWheel(tabId, x, y, deltaY) {
  await attach(tabId);
  await cmd(tabId, 'Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, pointerType: 'mouse' });
}

// Types into the focused field. Input.insertText behaves like real typing —
// Pure's React inputs accept it, unlike synthetic input events.
async function trustedType(tabId, text) {
  await attach(tabId);
  await cmd(tabId, 'Input.insertText', { text: String(text || '') });
}

const KEYS = { Escape: { key: 'Escape', code: 'Escape', vk: 27 } };
async function trustedKey(tabId, name) {
  const k = KEYS[name];
  if (!k) throw new Error('unknown key: ' + name);
  await attach(tabId);
  await cmd(tabId, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk });
  await cmd(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk });
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

  if (msg.cmd === 'trustedType') {
    trustedType(tabId, msg.text).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true; // async
  }

  if (msg.cmd === 'trustedKey') {
    trustedKey(tabId, msg.key).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
    );
    return true; // async
  }

  if (msg.cmd === 'badge') {
    chrome.action.setBadgeBackgroundColor({ color: '#e6219a' });
    chrome.action.setBadgeText({ tabId, text: msg.text || '' });
    sendResponse({ ok: true });
    return;
  }

  if (msg.cmd === 'detachDebugger') {
    detach(tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Forget state if the user dismissed the banner or closed the tab.
chrome.debugger.onDetach.addListener((src) => { if (src.tabId != null) attached.delete(src.tabId); });
chrome.tabs.onRemoved.addListener((tabId) => { attached.delete(tabId); });
