/* Pure Auto-Liker — попап: настройки, старт/стоп, опрос статуса. */
(function () {
  const DEFAULTS = {
    minDelay: 800, maxDelay: 1200, longPauseEvery: 40,
    distance: 'keep', autoFilters: true, dryRun: false, dailyCap: 0,
    scrollPauseMin: 600, scrollPauseMax: 1400
  };

  const $ = (id) => document.getElementById(id);
  const fields = ['minDelay', 'maxDelay', 'longPauseEvery', 'dailyCap', 'distance', 'autoFilters', 'dryRun', 'scrollPauseMin', 'scrollPauseMax'];

  function readForm() {
    return {
      minDelay: +$('minDelay').value || DEFAULTS.minDelay,
      maxDelay: +$('maxDelay').value || DEFAULTS.maxDelay,
      longPauseEvery: Math.max(0, +$('longPauseEvery').value || 0),
      dailyCap: Math.max(0, +$('dailyCap').value || 0),
      distance: $('distance').value,
      autoFilters: $('autoFilters').checked,
      dryRun: $('dryRun').checked,
      scrollPauseMin: Math.max(0, +$('scrollPauseMin').value || 0),
      scrollPauseMax: Math.max(0, +$('scrollPauseMax').value || 0)
    };
  }

  function fillForm(cfg) {
    $('minDelay').value = cfg.minDelay;
    $('maxDelay').value = cfg.maxDelay;
    $('longPauseEvery').value = cfg.longPauseEvery;
    $('dailyCap').value = cfg.dailyCap;
    $('distance').value = cfg.distance;
    $('autoFilters').checked = !!cfg.autoFilters;
    $('dryRun').checked = !!cfg.dryRun;
    $('scrollPauseMin').value = cfg.scrollPauseMin;
    $('scrollPauseMax').value = cfg.scrollPauseMax;
  }

  function saveCfg() {
    const cfg = readForm();
    chrome.storage.local.set({ cfg });
    sendToTab({ cmd: 'saveCfg', cfg });
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0]));
    });
  }

  async function sendToTab(msg) {
    const tab = await getActiveTab();
    if (!tab || !/^https:\/\/pure\.app\/app\//.test(tab.url || '')) {
      renderNoTab();
      return null;
    }
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, msg, (resp) => {
        if (chrome.runtime.lastError) { renderNoTab(); resolve(null); return; }
        resolve(resp);
      });
    });
  }

  function renderNoTab() {
    $('dot').className = 'dot';
    $('statusText').textContent = 'Открой ленту pure.app/app/...';
  }

  // Обновить число с «бампом» при изменении.
  function setNum(id, val) {
    const el = $(id);
    const next = String(val);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.remove('bump');
    void el.offsetWidth;        // рестарт анимации
    el.classList.add('bump');
  }

  function render(st) {
    if (!st) return;
    const dot = $('dot');
    dot.className = 'dot' + (st.paused ? ' pause' : st.running ? ' run' : st.lastError ? ' err' : '');
    $('statusText').textContent = st.statusText || (st.running ? 'работает' : 'остановлен');
    setNum('cSession', st.session || 0);
    setNum('cToday', st.today || 0);
    $('cMode').textContent = st.currentMode || '—';

    document.body.classList.toggle('is-running', !!st.running && !st.paused);
    document.body.classList.toggle('is-paused', !!st.paused);

    const err = $('err');
    if (st.lastError) { err.hidden = false; err.textContent = '⚠ ' + st.lastError; }
    else err.hidden = true;
  }

  // --- события ---
  $('startBtn').addEventListener('click', async () => {
    const cfg = readForm();
    chrome.storage.local.set({ cfg });
    const st = await sendToTab({ cmd: 'start', cfg });
    render(st);
  });
  $('stopBtn').addEventListener('click', async () => {
    const st = await sendToTab({ cmd: 'stop' });
    render(st);
  });
  fields.forEach((id) => $(id).addEventListener('change', saveCfg));

  // --- инициализация + опрос статуса ---
  chrome.storage.local.get(['cfg'], (data) => fillForm(Object.assign({}, DEFAULTS, data.cfg || {})));
  async function poll() { render(await sendToTab({ cmd: 'getStatus' })); }
  poll();
  setInterval(poll, 1000);
})();
