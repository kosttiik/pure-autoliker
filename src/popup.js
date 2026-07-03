/* Pure Auto-Liker — popup: settings, speed presets, start/stop, status polling. */
(function () {
  const I = window.__PURE_I18N;

  // English is the default markup language; translations are applied only from
  // the dictionary, so unknown keys keep the markup text.
  function applyI18n() {
    document.documentElement.lang = I.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = I.t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = I.t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = I.t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.label = I.t(el.dataset.i18nLabel); });
    // City options display the same label the site uses.
    document.querySelectorAll('[data-i18n-loc]').forEach((el) => { el.textContent = I.locationLabel(el.dataset.i18nLoc); });
  }
  applyI18n();

  // cfg.distance from v2.0 stored raw Russian site labels — map them to the
  // neutral keys introduced with i18n.
  const LEGACY_DISTANCE = {
    'Рядом': 'dist_near', 'Соседи': 'dist_neighbors', 'Неподалёку': 'dist_notfar',
    'На горизонте': 'dist_horizon', 'Далеко, но близко': 'dist_far', 'Вся вселенная': 'dist_universe',
    'Москва': 'city_moscow', 'Санкт-Петербург': 'city_spb', 'Лондон': 'city_london',
    'Нью-Йорк': 'city_ny', 'Париж': 'city_paris', 'Лос-Анджелес': 'city_la',
    'Берлин': 'city_berlin', 'Дубай': 'city_dubai', 'Стамбул': 'city_istanbul', 'Сингапур': 'city_singapore'
  };

  const DEFAULTS = {
    minDelay: 800, maxDelay: 1200, longPauseEvery: 40,
    distance: 'keep', customCity: '', autoFilters: true, dryRun: false, dailyCap: 0,
    scrollPauseMin: 600, scrollPauseMax: 1400
  };

  // A preset is highlighted only when ALL of its values match the form.
  const PRESETS = {
    calm:   { minDelay: 1500, maxDelay: 3000, longPauseEvery: 25, scrollPauseMin: 900, scrollPauseMax: 2000 },
    normal: { minDelay: 800,  maxDelay: 1200, longPauseEvery: 40, scrollPauseMin: 600, scrollPauseMax: 1400 },
    turbo:  { minDelay: 350,  maxDelay: 700,  longPauseEvery: 60, scrollPauseMin: 300, scrollPauseMax: 800 }
  };

  const $ = (id) => document.getElementById(id);
  const numFields = ['minDelay', 'maxDelay', 'longPauseEvery', 'dailyCap', 'scrollPauseMin', 'scrollPauseMax'];

  function readForm() {
    return {
      minDelay: +$('minDelay').value || DEFAULTS.minDelay,
      maxDelay: +$('maxDelay').value || DEFAULTS.maxDelay,
      longPauseEvery: Math.max(0, +$('longPauseEvery').value || 0),
      dailyCap: Math.max(0, +$('dailyCap').value || 0),
      distance: $('distance').value,
      customCity: $('customCity').value.trim(),
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
    if (!$('distance').value) $('distance').value = LEGACY_DISTANCE[cfg.distance] || 'keep';
    $('customCity').value = cfg.customCity || '';
    $('autoFilters').checked = !!cfg.autoFilters;
    $('dryRun').checked = !!cfg.dryRun;
    $('scrollPauseMin').value = cfg.scrollPauseMin;
    $('scrollPauseMax').value = cfg.scrollPauseMax;
    syncCustomCityRow();
    syncPresetHighlight();
  }

  function syncCustomCityRow() {
    $('customCityRow').hidden = $('distance').value !== 'custom';
  }

  function syncPresetHighlight() {
    const cfg = readForm();
    let active = null;
    for (const name in PRESETS) {
      const p = PRESETS[name];
      if (Object.keys(p).every((k) => +cfg[k] === p[k])) { active = name; break; }
    }
    document.querySelectorAll('.preset').forEach((b) => {
      b.classList.toggle('active', b.dataset.preset === active);
    });
  }

  let toastTimer = null;
  function showToast() {
    const t = $('toast');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
  }

  function saveCfg() {
    const cfg = readForm();
    chrome.storage.local.set({ cfg });
    sendToTab({ cmd: 'saveCfg', cfg });
    syncPresetHighlight();
    showToast();
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
    $('statusText').textContent = I.t('open_feed');
  }

  function setNum(id, val) {
    const el = $(id);
    const next = String(val);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  }

  function render(st) {
    if (!st) return;
    const dot = $('dot');
    dot.className = 'dot' + (st.paused ? ' pause' : st.running ? ' run' : st.lastError ? ' err' : '');
    $('statusText').textContent = st.statusText || I.t(st.running ? 'status_running' : 'status_stopped');
    setNum('cSession', st.session || 0);
    setNum('cToday', st.today || 0);
    setNum('cTotal', st.total || 0);

    const modeChip = $('modeChip');
    if (st.running && st.currentMode) { modeChip.hidden = false; $('cMode').textContent = st.currentMode; }
    else modeChip.hidden = true;

    const rateChip = $('rateChip');
    const elapsed = st.startedAt ? Date.now() - st.startedAt : 0;
    if (st.running && st.session >= 3 && elapsed > 60000) {
      rateChip.hidden = false;
      $('cRate').textContent = Math.round(st.session * 3600000 / elapsed);
    } else rateChip.hidden = true;

    document.body.classList.toggle('is-running', !!st.running && !st.paused);
    document.body.classList.toggle('is-paused', !!st.paused);

    const err = $('err');
    if (st.lastError) { err.hidden = false; err.textContent = '⚠ ' + st.lastError; }
    else err.hidden = true;

    const note = $('filterNote');
    if (st.filterNote && st.filterNote.text) {
      note.hidden = false;
      note.textContent = '📍 ' + st.filterNote.text;
      note.classList.toggle('warn', !st.filterNote.ok);
    } else note.hidden = true;
  }

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

  document.querySelectorAll('.preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.preset];
      for (const k in p) $(k).value = p[k];
      saveCfg();
    });
  });

  numFields.forEach((id) => $(id).addEventListener('change', saveCfg));
  $('autoFilters').addEventListener('change', saveCfg);
  $('dryRun').addEventListener('change', saveCfg);
  $('distance').addEventListener('change', () => { syncCustomCityRow(); saveCfg(); });

  // Typed by hand — debounce so the toast doesn't fire on every keystroke.
  let cityTimer = null;
  $('customCity').addEventListener('input', () => {
    clearTimeout(cityTimer);
    cityTimer = setTimeout(saveCfg, 600);
  });

  chrome.storage.local.get(['cfg'], (data) => fillForm(Object.assign({}, DEFAULTS, data.cfg || {})));
  async function poll() { render(await sendToTab({ cmd: 'getStatus' })); }
  poll();
  setInterval(poll, 1000);
})();
