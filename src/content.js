/*
 * Pure Auto-Liker — engine (isolated content-script world).
 * Runs on pure.app/app/*, controlled by the popup via messages.
 */
(function () {
  const SEL = (window.__PURE && window.__PURE.SEL) || {};
  const I18N = window.__PURE_I18N || { lang: 'en', t: (k) => k, locationLabel: (k) => k };
  const LOG = '[PureLiker]';

  // Content scripts can't observe page fetch — inject an interceptor into the page context.
  (function injectPageScript() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('src/inject.js');
      s.onload = function () { s.remove(); };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { console.warn(LOG, 'inject failed', e); }
  })();

  const DEFAULTS = {
    minDelay: 800,
    maxDelay: 1200,
    longPauseEvery: 40,
    longPauseMinMs: 60000,
    longPauseMaxMs: 120000,
    distance: 'keep',          // 'keep', a neutral key (dist_*/city_*), 'custom', or a legacy raw label
    customCity: '',            // used when distance === 'custom'
    autoFilters: true,
    dryRun: false,
    dailyCap: 0,               // 0 = unlimited
    scrollPauseMin: 600,
    scrollPauseMax: 1400,
    maxScrollTries: 15
  };

  const state = {
    running: false,
    paused: false,
    gen: 0,                    // run generation: a new Start invalidates any older loop
    statusText: I18N.t('status_stopped'),
    currentMode: null,
    liked: new Map(),          // id -> like timestamp (epoch ms)
    lastLike: null,            // {ts, ok, blocked, status} from inject.js
    cfg: Object.assign({}, DEFAULTS),
    counters: { session: 0, today: 0, total: 0, day: todayStr() },
    startedAt: null,
    filterNote: null,          // {ok, text} — outcome of the location filter attempt
    lastError: null
  };

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Likes on Pure expire exactly 24h after being set — the profile can be liked
  // again after that, so entries are only treated as "liked" within the TTL.
  const LIKED_CAP = 5000;
  const LIKE_TTL_MS = 24 * 60 * 60 * 1000;
  let likedPersistTimer = null;

  function likedRecently(id) {
    const ts = state.liked.get(id);
    return !!ts && (Date.now() - ts) < LIKE_TTL_MS;
  }

  function persistLikedSoon() {
    if (likedPersistTimer) return;
    likedPersistTimer = setTimeout(() => {
      likedPersistTimer = null;
      try {
        const obj = {};
        for (const [id, ts] of state.liked) obj[id] = ts;
        chrome.storage.local.set({ likedMap: obj });
      } catch (e) {}
    }, 1000);
  }

  function markLiked(id) {
    if (!id) return;
    state.liked.set(id, Date.now());
    if (state.liked.size > LIKED_CAP) {
      // Map preserves insertion order — drop the oldest entries.
      const keep = Array.from(state.liked).slice(-LIKED_CAP);
      state.liked = new Map(keep);
    }
    persistLikedSoon();
  }

  // Like results from the fetch interceptor: confirms real likes (200/201) and
  // catches blocking/captcha (403/429).
  window.addEventListener('message', function (ev) {
    const d = ev.data;
    if (!d || d.source !== 'PURE_AUTO_LIKER') return;
    if (d.type === 'PURE_LIKE_RESULT') {
      state.lastLike = { ts: Date.now(), ok: !!d.ok, blocked: !!d.blocked, status: d.status };
      if (d.blocked) {
        state.lastError = I18N.t('err_blocked', { status: d.status });
        autoPause(state.lastError);
      }
    }
  });

  // The DOM does not reflect like state; the only "already liked" signal is a
  // toast shown on a repeated click — watch for it via MutationObserver.
  // Matched by text phrases AND by the toast bubble's SVG path (language-
  // independent). Any toast this close to a like click means "already liked",
  // and waitLikeOutcome only reads the timestamp within its 500ms window.
  let lastAlreadyToastTs = 0;
  function nodeLooksLikeToast(node) {
    const pref = SEL.toastBlobPathPrefix;
    if (!pref || !node.querySelectorAll) return false;
    for (const p of node.querySelectorAll('svg path')) {
      const d = (p.getAttribute('d') || '').trim();
      if (d.indexOf(pref) === 0) return true;
    }
    return false;
  }
  function startToastObserver() {
    const phrases = (SEL.text && SEL.text.alreadyLikedPhrases) || ['Лайк уже был'];
    try {
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (nodeLooksLikeToast(node)) { lastAlreadyToastTs = Date.now(); return; }
            const txt = node.textContent || '';
            for (const ph of phrases) {
              if (txt.indexOf(ph) !== -1) { lastAlreadyToastTs = Date.now(); return; }
            }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { console.warn(LOG, 'toast observer failed', e); }
  }

  // Pure rejects clicks with isTrusted=false, so all clicks go through the
  // background worker as CDP Input.dispatchMouseEvent (chrome.debugger).
  function trustedClickAt(btn) {
    const r = btn.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ cmd: 'trustedClick', x, y }, (resp) => {
          if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
          resolve(resp || { ok: false, error: I18N.t('err_noresp') });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  function detachDebugger() {
    try { chrome.runtime.sendMessage({ cmd: 'detachDebugger' }, () => void chrome.runtime.lastError); } catch (e) {}
  }

  // Programmatic scrollTop doesn't wake the virtualized feed's lazy loading —
  // only a trusted wheel event does.
  function trustedWheel(x, y, deltaY) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ cmd: 'trustedWheel', x, y, deltaY }, (resp) => {
          void chrome.runtime.lastError; resolve(resp || { ok: false });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  // Pure's React inputs ignore synthetic input events the same way they ignore
  // synthetic clicks — city search typing must go through CDP Input.insertText.
  function trustedType(text) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ cmd: 'trustedType', text }, (resp) => {
          void chrome.runtime.lastError; resolve(resp || { ok: false });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  function trustedKey(key) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ cmd: 'trustedKey', key }, (resp) => {
          void chrome.runtime.lastError; resolve(resp || { ok: false });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  function updateBadge() {
    try {
      const text = state.running && state.counters.session > 0 ? String(state.counters.session) : '';
      chrome.runtime.sendMessage({ cmd: 'badge', text }, () => void chrome.runtime.lastError);
    } catch (e) {}
  }

  async function clickTrusted(el) {
    if (!el) return { ok: false, error: I18N.t('err_noelem') };
    // Scroll only when off-screen — coordinates are taken right before the CDP click.
    if (!isInViewport(el)) {
      try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) {}
      await sleep(60);
    }
    return await trustedClickAt(el);
  }

  function feedDiag() {
    const list = document.querySelector(SEL.feedListSelector);
    const scope = list || document.body;
    const btns = scope.querySelectorAll('button');
    let likeable = 0, liked = 0, withSvg = 0;
    for (const b of btns) {
      if (b.querySelector('svg path')) withSvg++;
      if (isLikeButton(b)) likeable++; else if (isLikedHeart(b)) liked++;
    }
    return 'container=' + (list ? 'yes' : 'NO→body') +
           ' buttons=' + btns.length + ' with-svg=' + withSvg +
           ' unliked-hearts=' + likeable + ' liked=' + liked;
  }

  function captchaVisible() {
    const ifr = document.querySelector('iframe[src*="recaptcha"][title*="challenge"], iframe[title*="recaptcha"]');
    if (!ifr) return false;
    const r = ifr.getBoundingClientRect();
    return r.width > 10 && r.height > 10 && ifr.offsetParent !== null;
  }

  function autoPause(reason) {
    state.paused = true;
    state.running = false;
    state.statusText = I18N.t('status_pause_prefix') + reason;
    console.warn(LOG, 'auto-pause:', reason);
  }

  function pathStartsWithAny(d, prefixes) {
    if (!d) return false;
    const t = d.trim();
    return prefixes.some((p) => t.indexOf(p) === 0);
  }

  // Like state is distinguished by the heart's SVG path, not by color/class:
  // unliked = outline heart, liked = a different "comet tail" path.
  function isLikeButton(btn) {
    const paths = btn.querySelectorAll('svg path');
    for (const p of paths) {
      const d = p.getAttribute('d') || '';
      if (pathStartsWithAny(d, SEL.likeHeartPathPrefixes)) return true;
      if (pathStartsWithAny(d, SEL.nonLikePathPrefixes)) return false;
    }
    return false;
  }

  function isLikedHeart(btn) {
    const paths = btn.querySelectorAll('svg path');
    for (const p of paths) {
      const d = p.getAttribute('d') || '';
      if (pathStartsWithAny(d, SEL.likedHeartPathPrefixes)) return true;
    }
    return false;
  }

  function cardInfo(btn) {
    let el = btn;
    while (el && el !== document.body) {
      if (el.querySelector) {
        const ann = el.querySelector('[id^="' + SEL.announcementIdPrefix + '"]');
        if (ann) {
          const id = ann.id.slice(SEL.announcementIdPrefix.length).replace(/-+$/, '');
          return { root: el, id: id || ann.id };
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  // All not-yet-liked heart buttons currently in the DOM. Falls back to the whole
  // document if the feed container is missing — the heart path is specific enough.
  function findLikeTargets() {
    const list = document.querySelector(SEL.feedListSelector) || document.body;
    const out = [];
    const buttons = list.querySelectorAll('button');
    for (const btn of buttons) {
      if (!isLikeButton(btn)) continue;
      const info = cardInfo(btn);
      if (!info) continue;
      if (likedRecently(info.id)) continue;
      if (isLikedHeart(btn)) {
        markLiked(info.id);
        continue;
      }
      out.push({ btn, id: info.id, root: info.root });
    }
    return out;
  }

  function isInViewport(el) {
    try {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.width > 0 && r.height > 0 && r.top >= 4 && r.bottom <= vh - 4;
    } catch (e) { return false; }
  }

  function highlight(root, btn) {
    try {
      const t = btn || root;
      const old = t.style.outline;
      t.style.outline = '3px solid #ff2d87';
      t.style.outlineOffset = '2px';
      setTimeout(() => { t.style.outline = old; }, 900);
    } catch (e) {}
  }

  // The virtualized feed scrolls inside a nested overflow:auto div, not the
  // document: explicit selector → closest scrollable ancestor of the list → document.
  function getScroller() {
    const explicit = document.querySelector(SEL.scrollContainerSelector);
    if (explicit && explicit.scrollHeight > explicit.clientHeight + 20) return explicit;

    const list = document.querySelector(SEL.feedListSelector);
    let el = list;
    while (el && el !== document.body) {
      try {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
            el.scrollHeight > el.clientHeight + 20) return el;
      } catch (e) {}
      el = el.parentElement;
    }
    if (explicit) return explicit;
    return document.scrollingElement || document.documentElement;
  }

  function cardIds() {
    return Array.from(document.querySelectorAll('[id^="' + SEL.announcementIdPrefix + '"]')).map((e) => e.id);
  }

  // Advance the feed downwards and force lazy loading. Progress is measured by
  // scroll offset / height growth / card-set change, so the engine can't stall.
  async function advanceFeed(aggressive) {
    const sc = getScroller();
    const beforeTop = sc.scrollTop;
    const beforeH = sc.scrollHeight;
    const before = cardIds();
    const beforeKey = before.length + '|' + (before[before.length - 1] || '');
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
    const hard = aggressive || atBottom;
    const step = Math.round(sc.clientHeight * (hard ? 1.6 : 0.9));

    let cx, cy;
    try {
      const r = sc.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        cx = Math.round(r.left + r.width / 2);
        cy = Math.round(r.top + Math.min(r.height, window.innerHeight) / 2);
      }
    } catch (e) {}
    if (cx == null) { cx = Math.round(window.innerWidth / 2); cy = Math.round(window.innerHeight / 2); }

    const bursts = hard ? 3 : 1;
    for (let i = 0; i < bursts; i++) {
      await trustedWheel(cx, cy, Math.round(step / bursts));
      if (bursts > 1) await sleep(50);
    }

    // Programmatic fallback — strictly downwards and monotonic (scrollIntoView is
    // avoided: it can scroll up and make the feed jitter).
    try { sc.scrollTop = Math.max(sc.scrollTop, beforeTop + step); } catch (e) {}
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) {
      try { sc.scrollTop = sc.scrollHeight; } catch (e) {}
    }

    await sleep(hard ? rand(450, 700) : rand(200, 320));

    const after = cardIds();
    const afterKey = after.length + '|' + (after[after.length - 1] || '');
    const grew = sc.scrollHeight > beforeH + 8;
    const moved = sc.scrollTop - beforeTop > 4;
    const cardsChanged = afterKey !== beforeKey;
    return grew || moved || cardsChanged;
  }

  async function waitFeedRerender(timeoutMs) {
    const list = document.querySelector(SEL.feedListSelector);
    if (!list) { await sleep(1500); return; }
    await new Promise((resolve) => {
      let done = false;
      const obs = new MutationObserver(() => { if (!done) { done = true; obs.disconnect(); resolve(); } });
      obs.observe(list, { childList: true, subtree: true });
      setTimeout(() => { if (!done) { done = true; obs.disconnect(); resolve(); } }, timeoutMs);
    });
    await sleep(800);
  }

  // styled-components class hashes change with every Pure release, so the primary
  // anchor is the branded SVG "blob" every chip is drawn with (its path is stable).
  // Class selectors are a fallback only.
  function findFilterChips() {
    const scope = document.querySelector(SEL.filterBarSelector) || document;
    const chips = [];
    const pref = SEL.chipBlobPathPrefix;
    if (pref) {
      for (const p of scope.querySelectorAll('svg path')) {
        const d = (p.getAttribute('d') || '').trim();
        if (d.indexOf(pref) !== 0) continue;
        // Chip structure: <div chip> <span><svg blob/></span> <div label/> </div>
        const holder = p.closest('span');
        const chip = holder && holder.parentElement;
        if (chip && (chip.textContent || '').trim() && chips.indexOf(chip) === -1) chips.push(chip);
      }
    }
    if (chips.length) return chips;
    return Array.from(scope.querySelectorAll(SEL.filterChipSelector));
  }

  function findChipByLabels(labels) {
    for (const c of findFilterChips()) {
      const t = (c.textContent || '').trim();
      for (const lab of labels) { if (lab && t.indexOf(lab) !== -1) return c; }
    }
    return null;
  }

  // Location chip detection order: country-flag img (data:image → a city is
  // selected) → known labels → first chip (location is always first on Pure).
  function findLocationChip() {
    const chips = findFilterChips();
    for (const c of chips) {
      const img = c.querySelector('img');
      if (img && (img.getAttribute('src') || '').indexOf('data:image') === 0) return c;
    }
    return findChipByLabels(SEL.text.locationLabels || []) || chips[0] || null;
  }

  // Root of the open location panel. Options must be searched ONLY inside it:
  // after a filter change the option text may also appear in the feed, and a
  // page-wide match would send the click into a profile card.
  // The panel is NOT mounted in a portal root, and its classes are hashed, so
  // the anchor is structural: the panel always carries a search input — climb
  // from it to the container that also holds the options list.
  function popupRoot() {
    const inputs = document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])');
    for (const inp of inputs) {
      if (!inp.offsetParent) continue; // hidden
      let el = inp;
      for (let i = 0; i < 5 && el.parentElement && el.parentElement !== document.body; i++) {
        el = el.parentElement;
        if (el.querySelector(SEL.feedListSelector)) break; // climbed out of the panel
        for (const child of el.children) {
          if (child.contains(inp)) continue;
          if ((child.textContent || '').trim() && child.children.length > 0) return el;
        }
      }
    }
    for (const s of (SEL.portalRoots || [])) {
      const el = document.querySelector(s);
      if (el && el.childElementCount > 0 && (el.textContent || '').trim()) return el;
    }
    const anyOpt = document.querySelector(SEL.popupOptionSelector);
    if (anyOpt) {
      let el = anyOpt;
      for (let i = 0; i < 6 && el.parentElement && el.parentElement !== document.body; i++) el = el.parentElement;
      return el;
    }
    return null;
  }

  function popupIsOpen() { return !!popupRoot(); }

  function findPopupOption(label) {
    const direct = document.querySelectorAll(SEL.popupOptionSelector);
    for (const o of direct) {
      const span = o.querySelector('span');
      const t = ((span ? span.textContent : o.textContent) || '').trim();
      if (t === label || t.indexOf(label) === 0) return o;
    }
    const root = popupRoot();
    if (!root) return null;
    let best = null;
    for (const el of root.querySelectorAll('div,span,li,button,label,p')) {
      const t = (el.textContent || '').trim();
      if ((t === label || t.indexOf(label) === 0) && t.length < label.length + 14) {
        if (!best || (el.textContent || '').length < (best.textContent || '').length) best = el;
      }
    }
    return best;
  }

  // Loose match for city search results: popup element whose text starts with
  // the typed prefix (case-insensitive).
  function fuzzyPopupOption(label) {
    const root = popupRoot();
    if (!root) return null;
    const needle = label.trim().toLowerCase().slice(0, 4);
    if (!needle) return null;
    let best = null;
    for (const el of root.querySelectorAll('div,span,li,button,label,p')) {
      if (el.querySelector('input')) continue;
      const t = (el.textContent || '').trim();
      if (t && t.length < 48 && t.toLowerCase().indexOf(needle) === 0) {
        if (!best || t.length < (best.textContent || '').trim().length) best = el;
      }
    }
    return best;
  }

  function popupSearchInput() {
    const root = popupRoot();
    if (!root) return null;
    return root.querySelector('input[type="search"], input[type="text"], input:not([type])');
  }

  async function waitForOptions(timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (document.querySelector(SEL.popupOptionSelector) || popupIsOpen()) return true;
      await sleep(120);
    }
    return false;
  }

  // Close via Escape, then the panel's back button — never an "outside" click:
  // screen center could land on a feed card and open a profile.
  async function closePopups() {
    if (!popupIsOpen()) return;
    await trustedKey('Escape');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    for (let i = 0; i < 5 && popupIsOpen(); i++) await sleep(120);
    if (popupIsOpen()) {
      const root = popupRoot();
      const back = root && root.querySelector('button');
      if (back) await clickTrusted(back);
      for (let i = 0; i < 10 && popupIsOpen(); i++) await sleep(120);
    }
  }

  async function openChipMenu(chip, what) {
    await closePopups();
    await clickTrusted(chip);
    if (!(await waitForOptions(3000))) { console.warn(LOG, what + ' popup did not open'); return false; }
    await sleep(rand(220, 420));
    return true;
  }

  // Set the location (distance or city). If the popup has no ready-made option
  // (arbitrary city), type into its search field and pick a result. The final
  // chip text is re-checked to verify the selection actually applied.
  async function setLocationFilter(label) {
    const chip = findLocationChip();
    if (!chip) {
      state.filterNote = { ok: false, text: I18N.t('note_nochip') };
      console.warn(LOG, state.filterNote.text);
      return false;
    }
    if ((chip.textContent || '').indexOf(label) !== -1) {
      state.filterNote = { ok: true, text: I18N.t('note_location', { label }) };
      return true;
    }
    state.statusText = I18N.t('status_set_location', { label });
    if (!(await openChipMenu(chip, 'location'))) {
      state.filterNote = { ok: false, text: I18N.t('note_nopopup') };
      return false;
    }

    let opt = findPopupOption(label);
    if (!opt) {
      const input = popupSearchInput();
      if (input) {
        await clickTrusted(input);
        await sleep(rand(150, 260));
        await trustedType(label);
        await sleep(rand(800, 1200)); // let search results load
        opt = findPopupOption(label) || fuzzyPopupOption(label);
      }
    }
    if (!opt) {
      state.filterNote = { ok: false, text: I18N.t('note_nooption', { label }) };
      console.warn(LOG, state.filterNote.text);
      await closePopups();
      return false;
    }

    await clickTrusted(opt);
    await sleep(rand(300, 500));
    await closePopups();
    await waitFeedRerender(4000);

    const now = findLocationChip();
    const ok = !!now && (now.textContent || '').indexOf(label) !== -1;
    state.filterNote = ok
      ? { ok: true, text: I18N.t('note_location', { label }) }
      : { ok: false, text: I18N.t('note_unconfirmed', { text: (((now && now.textContent) || '?').trim()) }) };
    console.log(LOG, state.filterNote.text);
    return ok;
  }

  async function applyFilters() {
    state.filterNote = null;
    if (!state.cfg.autoFilters) return true;
    try {
      let want = state.cfg.distance;
      if (want === 'custom') want = (state.cfg.customCity || '').trim();
      // Neutral keys map to the site's locale-specific label; legacy configs
      // with raw labels pass through locationLabel() unchanged.
      else if (want && want !== 'keep') want = I18N.locationLabel(want);
      if (want && want !== 'keep') await setLocationFilter(want);
    } catch (e) { console.warn(LOG, 'applyFilters error', e); }
    return true;
  }

  async function waitLikeOutcome(btn, t0, timeoutMs) {
    while (Date.now() - t0 < timeoutMs) {
      if (lastAlreadyToastTs > t0) return 'already';
      if (state.lastLike && state.lastLike.ts > t0) {
        if (state.lastLike.blocked) return 'blocked';
        if (state.lastLike.ok) return 'liked-new';
        return 'rejected';
      }
      if (!btn.isConnected) return 'liked-new';  // card removed — the like went through
      await sleep(15);
    }
    return 'uncertain';
  }

  // Dry-run diagnostics: what distinguishes a liked button from an unliked one.
  function heartDiag(btn) {
    const svg = btn.querySelector('svg');
    const path = svg && svg.querySelector('path');
    const g = (el) => { try { return getComputedStyle(el); } catch (e) { return {}; } };
    const csb = g(btn), css = svg ? g(svg) : {}, csp = path ? g(path) : {};
    return {
      disabled: btn.disabled,
      ariaPressed: btn.getAttribute('aria-pressed'),
      ariaDisabled: btn.getAttribute('aria-disabled'),
      btnColor: csb.color, btnOpacity: csb.opacity,
      svgFill: css.fill, pathFill: csp.fill, pathColor: csp.color,
      btnClass: btn.className
    };
  }

  async function likeOne(target) {
    // block:'nearest' avoids pulling the feed upwards; CDP click coordinates are
    // taken right before the click.
    if (!isInViewport(target.btn)) {
      target.btn.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      await sleep(rand(80, 160));
    }

    if (state.cfg.dryRun) {
      highlight(target.root, target.btn);
      state.liked.set(target.id, Date.now()); // session-only, not persisted
      console.log(LOG, '[DRY-RUN] heart id=', target.id, heartDiag(target.btn));
      return true;
    }

    // Race guard: skip without clicking if the card got liked meanwhile.
    if (likedRecently(target.id) || isLikedHeart(target.btn) || !isLikeButton(target.btn)) {
      markLiked(target.id);
      console.log(LOG, 'skip (already liked) id=', target.id);
      return true;
    }

    highlight(target.root, target.btn);
    const t0 = Date.now();
    const click = await trustedClickAt(target.btn);
    if (!click || !click.ok) {
      const reason = I18N.t('err_click', { err: (click && click.error) || '?' });
      autoPause(reason);
      state.lastError = reason;
      return false;
    }

    // Short window to catch blocking or the "already liked" toast. Absent a
    // signal the like counts as successful: the trusted click is reliable,
    // liked cards are pre-filtered by SVG path, and inject.js often fails to
    // load under Pure's CSP — network confirmation can't be depended on.
    const outcome = await waitLikeOutcome(target.btn, t0, 30);
    if (outcome === 'blocked') return false; // auto-pause already triggered

    if (outcome === 'already' || outcome === 'rejected') {
      markLiked(target.id);
      console.log(LOG, 'already liked/rejected, skipping id=', target.id, '(', outcome, ')');
      return true;
    }
    markLiked(target.id);
    bumpCounters();
    console.log(LOG, 'liked id=', target.id, '(', outcome, ') session=', state.counters.session, 'today=', state.counters.today);
    return true;
  }

  function bumpCounters() {
    if (state.counters.day !== todayStr()) { state.counters.day = todayStr(); state.counters.today = 0; }
    state.counters.session++;
    state.counters.today++;
    state.counters.total++;
    persistCounters();
    updateBadge();
  }

  function capReached() {
    const cap = state.cfg.dailyCap | 0;
    if (!cap) return false;
    if (state.counters.day !== todayStr()) return false;
    return state.counters.today >= cap;
  }

  function modeLabel() {
    const d = state.cfg.distance;
    if (d === 'custom') return (state.cfg.customCity || '').trim() || I18N.t('mode_current');
    if (d && d !== 'keep') return I18N.locationLabel(d);
    return I18N.t('mode_current');
  }

  async function runPass(myGen) {
    state.currentMode = modeLabel();

    // Let the feed load, especially right after a filter change.
    state.statusText = I18N.t('status_search');
    for (let i = 0; i < 12 && engineAlive(myGen); i++) {
      if (findLikeTargets().length > 0) break;
      await sleep(400);
    }
    console.log(LOG, 'pass started |', feedDiag());

    let stuck = 0;
    const STUCK_LIMIT = 60;
    while (engineAlive(myGen)) {
      if (captchaVisible()) { autoPause(I18N.t('err_captcha')); break; }
      if (capReached()) { state.statusText = I18N.t('status_cap'); state.running = false; break; }

      const targets = findLikeTargets();
      if (targets.length === 0) {
        const progressed = await advanceFeed(stuck >= 3);
        if (progressed) {
          stuck = 0;
          const sMin = Math.max(0, Number(state.cfg.scrollPauseMin) || 0);
          const sMax = Math.max(sMin, Number(state.cfg.scrollPauseMax) || sMin);
          state.statusText = I18N.t('status_scroll');
          await sleep(rand(sMin, sMax));
          continue;
        }
        // No progress: keep rescanning on a short interval — this also picks up
        // the user's manual scrolling and late lazy loads.
        stuck++;
        state.statusText = I18N.t('status_search_new');
        await sleep(1000);
        if (stuck >= STUCK_LIMIT) {
          console.log(LOG, 'feed not growing for ~1min, re-entering |', feedDiag());
          break; // runEngine re-enters; the engine keeps running
        }
        continue;
      }
      stuck = 0;

      const t = targets[0];
      state.statusText = I18N.t('status_like');
      try {
        await likeOne(t);
      } catch (e) {
        console.warn(LOG, 'like error', e);
        markLiked(t.id);
      }
      if (!engineAlive(myGen)) break;

      // Sanitize: numbers, non-negative, min<=max (sleep must not get NaN).
      let minD = Math.max(0, Number(state.cfg.minDelay) || 0);
      let maxD = Math.max(minD, Number(state.cfg.maxDelay) || minD);
      let delay = rand(minD, maxD);
      if (state.cfg.longPauseEvery > 0 && state.counters.session > 0 &&
          state.counters.session % state.cfg.longPauseEvery === 0) {
        delay = rand(state.cfg.longPauseMinMs, state.cfg.longPauseMaxMs);
        state.statusText = I18N.t('status_longpause');
        console.log(LOG, 'long pause', Math.round(delay / 1000), 's');
      } else {
        console.log(LOG, 'pause', Math.round(delay), 'ms (min=', minD, 'max=', maxD, ')');
      }
      await sleep(delay);
    }
  }

  function engineAlive(myGen) { return state.running && !state.paused && state.gen === myGen; }

  async function runEngine() {
    const myGen = ++state.gen;
    state.running = true;
    state.paused = false;
    state.lastError = null;
    state.counters.session = 0;
    state.startedAt = Date.now();
    state.statusText = I18N.t('status_starting');
    updateBadge();
    console.log(LOG, 'engine started, gen=', myGen, '|', feedDiag());

    await applyFilters();

    // Never stops on its own: when the feed is exhausted, take a short breath
    // and re-enter — new profiles may appear.
    let idleCycles = 0;
    while (engineAlive(myGen)) {
      const before = state.counters.session;
      await runPass(myGen);
      if (!engineAlive(myGen)) break;

      if (state.counters.session === before) {
        idleCycles++;
        console.log(LOG, 'pass with no new likes, re-entering, idle=', idleCycles);
        await sleep(1000);
      } else {
        idleCycles = 0;
      }
    }

    if (state.gen === myGen) {   // only the latest run may clean up shared state
      state.running = false;
      state.currentMode = null;
      detachDebugger();
      updateBadge();
      console.log(LOG, 'engine stopped. Session total:', state.counters.session);
    }
  }

  function loadCfg() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['cfg', 'counters', 'likedMap', 'likedIds'], (data) => {
        state.cfg = Object.assign({}, DEFAULTS, data.cfg || {});
        if (data.counters) {
          state.counters.total = data.counters.total || 0;   // all-time, never reset
          if (data.counters.day === todayStr()) {
            state.counters.today = data.counters.today || 0;
            state.counters.day = data.counters.day;
          }
        }
        const now = Date.now();
        if (data.likedMap && typeof data.likedMap === 'object') {
          for (const id in data.likedMap) {
            const ts = data.likedMap[id];
            if (ts && (now - ts) < LIKE_TTL_MS) state.liked.set(id, ts);
          }
        } else if (Array.isArray(data.likedIds)) {
          // migration from the old timestamp-less format: treat as fresh
          for (const id of data.likedIds) state.liked.set(id, now);
        }
        resolve();
      });
    });
  }
  function persistCounters() {
    chrome.storage.local.set({ counters: { today: state.counters.today, day: state.counters.day, total: state.counters.total } });
  }

  function statusPayload() {
    return {
      running: state.running,
      paused: state.paused,
      statusText: state.statusText,
      currentMode: state.currentMode,
      session: state.counters.session,
      today: state.counters.today,
      total: state.counters.total,
      startedAt: state.startedAt,
      filterNote: state.filterNote,
      lastError: state.lastError,
      onFeed: !!document.querySelector(SEL.feedListSelector)
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.cmd) return;
    if (msg.cmd === 'start') {
      loadCfg().then(() => {
        if (msg.cfg) { state.cfg = Object.assign({}, DEFAULTS, msg.cfg); chrome.storage.local.set({ cfg: state.cfg }); }
        runEngine(); // always a fresh run; any older loop is invalidated via gen
        sendResponse(statusPayload());
      });
      return true;
    }
    if (msg.cmd === 'stop') {
      state.gen++;            // invalidate the active loop — it exits at the next check
      state.running = false; state.paused = false;
      state.statusText = I18N.t('status_stopped'); state.currentMode = null;
      detachDebugger();
      updateBadge();
      sendResponse(statusPayload());
      return;
    }
    if (msg.cmd === 'getStatus') { sendResponse(statusPayload()); return; }
    if (msg.cmd === 'saveCfg') {
      state.cfg = Object.assign({}, DEFAULTS, msg.cfg || {});
      chrome.storage.local.set({ cfg: state.cfg });
      sendResponse({ ok: true });
      return;
    }
  });

  loadCfg();
  startToastObserver();
  console.log(LOG, 'content script loaded on', location.href);
})();
