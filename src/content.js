/*
 * Pure Auto-Liker — движок (isolated content-script world).
 * Запускается на pure.app/app/*. Управляется из попапа сообщениями.
 */
(function () {
  const SEL = (window.__PURE && window.__PURE.SEL) || {};
  const LOG = '[PureLiker]';

  // ---------- Инжект перехватчика fetch в контекст страницы ----------
  (function injectPageScript() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('src/inject.js');
      s.onload = function () { s.remove(); };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { console.warn(LOG, 'inject failed', e); }
  })();

  // ---------- Конфиг по умолчанию ----------
  const DEFAULTS = {
    minDelay: 800,
    maxDelay: 1200,
    longPauseEvery: 40,        // каждые N лайков — длинная пауза
    longPauseMinMs: 60000,
    longPauseMaxMs: 120000,
    distance: 'keep',          // 'keep' (не трогать) или подпись: 'Рядом', 'На горизонте', 'Москва'…
    autoFilters: true,         // мастер-выключатель: разрешить расширению менять фильтры на сайте
    dryRun: false,
    dailyCap: 0,               // 0 = без лимита
    scrollPauseMin: 600,       // рейт-лимит промотки: пауза между шагами скролла, мс
    scrollPauseMax: 1400,
    maxScrollTries: 15         // сколько раз скроллим без новых карточек прежде чем закончить пасс
  };

  // ---------- Состояние ----------
  const state = {
    running: false,
    paused: false,
    gen: 0,                    // поколение запуска: новый Старт инвалидирует старый цикл
    statusText: 'остановлен',
    currentMode: null,
    liked: new Map(),          // id -> момент лайка (epoch ms); лайк на Pure живёт 24ч
    lastLike: null,            // {ts, ok, blocked, status} — результат POST-лайка из inject.js
    cfg: Object.assign({}, DEFAULTS),
    counters: { session: 0, today: 0, day: todayStr() },
    lastError: null
  };

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---------- Память лайков (между сессиями) ----------
  // Лайк на Pure истекает ровно через 24ч — после этого анкету можно лайкать заново,
  // поэтому храним момент лайка и считаем «лайкнутым» только в пределах TTL.
  const LIKED_CAP = 5000;                  // не даём карте расти бесконечно
  const LIKE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
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
    state.liked.set(id, Date.now());       // обновляем таймстамп (в т.ч. при повторном лайке после 24ч)
    if (state.liked.size > LIKED_CAP) {
      // Map сохраняет порядок вставки — выкидываем самые старые записи.
      const keep = Array.from(state.liked).slice(-LIKED_CAP);
      state.liked = new Map(keep);
    }
    persistLikedSoon();
  }

  // ---------- Сигналы от перехватчика fetch ----------
  // inject.js ловит POST /reactions/sent/likes и присылает результат — по нему
  // подтверждаем реальный лайк (201/200) и ловим блокировку/капчу (403/429).
  window.addEventListener('message', function (ev) {
    const d = ev.data;
    if (!d || d.source !== 'PURE_AUTO_LIKER') return;
    if (d.type === 'PURE_LIKE_RESULT') {
      state.lastLike = { ts: Date.now(), ok: !!d.ok, blocked: !!d.blocked, status: d.status };
      if (d.blocked) {
        state.lastError = 'Похоже на блокировку/капчу (HTTP ' + d.status + ')';
        autoPause(state.lastError);
      }
    }
  });

  // ---------- Наблюдатель тоста «Лайк уже был» ----------
  // В DOM состояние лайка не отражается; единственный сигнал «уже лайкнуто» —
  // тост при повторном клике. Ловим его появление через MutationObserver.
  let lastAlreadyToastTs = 0;
  function startToastObserver() {
    const phrase = (SEL.text && SEL.text.alreadyLiked) || 'Лайк уже был';
    try {
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if ((node.textContent || '').indexOf(phrase) !== -1) { lastAlreadyToastTs = Date.now(); return; }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { console.warn(LOG, 'toast observer failed', e); }
  }

  // ---------- Доверенный клик через фон (CDP) ----------
  function trustedClickAt(btn) {
    const r = btn.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ cmd: 'trustedClick', x, y }, (resp) => {
          if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
          resolve(resp || { ok: false, error: 'нет ответа фонового воркера' });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  function detachDebugger() {
    try { chrome.runtime.sendMessage({ cmd: 'detachDebugger' }, () => void chrome.runtime.lastError); } catch (e) {}
  }

  // Доверенная прокрутка колесом через фон (как живой скролл) — для надёжной подгрузки.
  function trustedWheel(x, y, deltaY) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ cmd: 'trustedWheel', x, y, deltaY }, (resp) => {
          void chrome.runtime.lastError; resolve(resp || { ok: false });
        });
      } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  // Доверенный клик по элементу (фильтры и т.п.) — сперва в центр экрана,
  // потом CDP-клик по координатам. Pure режет синтетические клики везде.
  async function clickTrusted(el) {
    if (!el) return { ok: false, error: 'нет элемента' };
    // Скроллим только если элемент вне экрана — иначе можно случайно сдвинуть попап.
    if (!isInViewport(el)) {
      try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) {}
      await sleep(60);
    }
    return await trustedClickAt(el);
  }

  // Диагностика ленты — что движок видит прямо сейчас.
  function feedDiag() {
    const list = document.querySelector(SEL.feedListSelector);
    const scope = list || document.body;
    const btns = scope.querySelectorAll('button');
    let likeable = 0, liked = 0, withSvg = 0;
    for (const b of btns) {
      if (b.querySelector('svg path')) withSvg++;
      if (isLikeButton(b)) likeable++; else if (isLikedHeart(b)) liked++;
    }
    return 'контейнер=' + (list ? 'есть' : 'НЕТ→body') +
           ' кнопок=' + btns.length + ' c-svg=' + withSvg +
           ' нелайкнутых-сердец=' + likeable + ' лайкнутых=' + liked;
  }

  // ---------- Детект капчи ----------
  function captchaVisible() {
    const ifr = document.querySelector('iframe[src*="recaptcha"][title*="challenge"], iframe[title*="recaptcha"]');
    if (!ifr) return false;
    const r = ifr.getBoundingClientRect();
    return r.width > 10 && r.height > 10 && ifr.offsetParent !== null;
  }

  function autoPause(reason) {
    state.paused = true;
    state.running = false;
    state.statusText = 'ПАУЗА: ' + reason;
    console.warn(LOG, 'auto-pause:', reason);
  }

  // ---------- Поиск кнопок лайка ----------
  function pathStartsWithAny(d, prefixes) {
    if (!d) return false;
    const t = d.trim();
    return prefixes.some((p) => t.indexOf(p) === 0);
  }

  function isLikeButton(btn) {
    const paths = btn.querySelectorAll('svg path');
    for (const p of paths) {
      const d = p.getAttribute('d') || '';
      if (pathStartsWithAny(d, SEL.likeHeartPathPrefixes)) return true;
      if (pathStartsWithAny(d, SEL.nonLikePathPrefixes)) return false;
    }
    return false;
  }

  // ---------- Лайкнуто? — по SVG-пути ----------
  // Лайкнутое сердце рисуется ДРУГИМ путём (сердце с «хвостом кометы»),
  // нелайкнутое — контурное сердце. Это надёжнее любого цвета.
  function isLikedHeart(btn) {
    const paths = btn.querySelectorAll('svg path');
    for (const p of paths) {
      const d = p.getAttribute('d') || '';
      if (pathStartsWithAny(d, SEL.likedHeartPathPrefixes)) return true;
    }
    return false;
  }

  // Возвращает {root, id} для карточки, которой принадлежит кнопка.
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

  // Все ещё не лайкнутые кнопки-сердечки, видимые в DOM.
  // Если контейнер ленты не найден — ищем по всему документу (путь сердца
  // достаточно специфичен, чужие кнопки не зацепит).
  function findLikeTargets() {
    const list = document.querySelector(SEL.feedListSelector) || document.body;
    const out = [];
    const buttons = list.querySelectorAll('button');
    for (const btn of buttons) {
      if (!isLikeButton(btn)) continue;
      const info = cardInfo(btn);
      if (!info) continue;
      if (likedRecently(info.id)) continue;       // лайкнули < 24ч назад — лайк ещё активен
      if (isLikedHeart(btn)) {                     // уже лайкнуто на сайте — не трогаем
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

  // ---------- Скролл ----------
  // Надёжно находим реальный прокручиваемый контейнер ленты: явный селектор →
  // ближайший прокручиваемый предок списка → документ. Виртуализированные ленты
  // часто скроллятся не в documentElement, а во вложенном div с overflow:auto.
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
    if (explicit) return explicit; // хоть что-то
    return document.scrollingElement || document.documentElement;
  }

  function cardIds() {
    return Array.from(document.querySelectorAll('[id^="' + SEL.announcementIdPrefix + '"]')).map((e) => e.id);
  }

  // Быстрая промотка вниз в поиске нелайкнутых + принудительная догрузка ленты.
  // Мотаем НЕСКОЛЬКИМИ способами (scrollTop контейнера, window, прокрутка последней
  // карточки в видимость) — чтобы сдвинуть любой тип ленты. Прогресс считаем по
  // сдвигу/росту высоты/СМЕНЕ набора карточек, поэтому движок не застревает.
  async function advanceFeed(aggressive) {
    const sc = getScroller();
    const beforeTop = sc.scrollTop;
    const beforeH = sc.scrollHeight;
    const before = cardIds();
    const beforeKey = before.length + '|' + (before[before.length - 1] || '');
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
    const hard = aggressive || atBottom;
    const step = Math.round(sc.clientHeight * (hard ? 1.6 : 0.9));

    // Точка прокрутки — центр видимой части ленты.
    let cx, cy;
    try {
      const r = sc.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        cx = Math.round(r.left + r.width / 2);
        cy = Math.round(r.top + Math.min(r.height, window.innerHeight) / 2);
      }
    } catch (e) {}
    if (cx == null) { cx = Math.round(window.innerWidth / 2); cy = Math.round(window.innerHeight / 2); }

    // ДОВЕРЕННЫЙ wheel ВНИЗ (deltaY>0). При застревании — несколько импульсов подряд.
    const bursts = hard ? 3 : 1;
    for (let i = 0; i < bursts; i++) {
      await trustedWheel(cx, cy, Math.round(step / bursts));
      if (bursts > 1) await sleep(50);
    }

    // Программный фолбэк — СТРОГО ВНИЗ и монотонно (никогда не уменьшаем scrollTop,
    // поэтому никакой дёрготни вверх). scrollIntoView НЕ используем — он мог скроллить вверх.
    try { sc.scrollTop = Math.max(sc.scrollTop, beforeTop + step); } catch (e) {}
    // На самом дне — добиваем в конец, чтобы триггернуть бесконечную подгрузку.
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) {
      try { sc.scrollTop = sc.scrollHeight; } catch (e) {}
    }

    await sleep(hard ? rand(450, 700) : rand(200, 320)); // дать дорендерить

    const after = cardIds();
    const afterKey = after.length + '|' + (after[after.length - 1] || '');
    const grew = sc.scrollHeight > beforeH + 8;
    const moved = sc.scrollTop - beforeTop > 4;          // прогресс только вниз
    const cardsChanged = afterKey !== beforeKey;        // появились/сменились карточки
    return grew || moved || cardsChanged;
  }

  // ---------- Фильтры ----------
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

  // Чип в баре фильтров, чей текст содержит одну из подписей.
  function findChipByLabels(labels) {
    const bar = document.querySelector(SEL.filterBarSelector) || document;
    const chips = bar.querySelectorAll(SEL.filterChipSelector);
    for (const c of chips) {
      const t = (c.textContent || '').trim();
      for (const lab of labels) { if (lab && t.indexOf(lab) !== -1) return c; }
    }
    return null;
  }
  // Чип локации/дистанции (показывает текущий город или радиус).
  function findLocationChip() {
    const bar = document.querySelector(SEL.filterBarSelector) || document;
    return findChipByLabels(SEL.text.locationLabels || []) ||
           bar.querySelector(SEL.filterChipSelector);
  }

  // Контейнер открытого попапа — чтобы искать варианты ТОЛЬКО в нём, а не по всей
  // странице (иначе после смены фильтра текст варианта может совпасть с текстом в
  // ленте, и клик уйдёт в карточку профиля).
  function popupRoot() {
    const anyOpt = document.querySelector(SEL.popupOptionSelector);
    if (anyOpt) {
      let el = anyOpt;
      for (let i = 0; i < 6 && el.parentElement && el.parentElement !== document.body; i++) el = el.parentElement;
      return el;
    }
    const portals = (SEL.portalRoots || []).map((s) => document.querySelector(s)).filter(Boolean);
    return portals[0] || null;
  }

  // Вариант в попапе по тексту: сперва штатные опции (по селектору), затем —
  // подходящий элемент ВНУТРИ попапа (у разных попапов классы отличаются).
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

  async function waitForOptions(timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (document.querySelector(SEL.popupOptionSelector)) return true;
      await sleep(120);
    }
    return false;
  }

  // Закрыть открытый попап и дождаться его исчезновения (иначе следующий клик
  // уйдёт в исчезающие элементы прошлого попапа).
  async function closePopups() {
    if (!document.querySelector(SEL.popupOptionSelector)) return;
    await clickTrusted(document.body);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    for (let i = 0; i < 15 && document.querySelector(SEL.popupOptionSelector); i++) await sleep(120);
  }

  // Открыть меню чипа: сперва закрыть прошлый попап, кликнуть, дождаться вариантов.
  async function openChipMenu(chip, what) {
    await closePopups();
    await clickTrusted(chip);
    if (!(await waitForOptions(3000))) { console.warn(LOG, 'попап «' + what + '» не открылся'); return false; }
    await sleep(rand(220, 420));
    return true;
  }

  // Одиночный выбор (локация/город) — после клика меню закрывается само.
  async function setSingleFilter(chip, optionLabel, what) {
    if (!chip) { console.warn(LOG, 'не нашёл чип «' + what + '» — выставьте вручную'); return false; }
    if ((chip.textContent || '').indexOf(optionLabel) !== -1) return true; // уже выбрано
    state.statusText = 'фильтр: ' + optionLabel;
    if (!(await openChipMenu(chip, what))) return false;
    const opt = findPopupOption(optionLabel);
    if (!opt) { console.warn(LOG, 'нет варианта «' + optionLabel + '» в попапе «' + what + '»'); await closePopups(); return false; }
    await clickTrusted(opt);
    await sleep(rand(300, 500));
    await closePopups();
    await waitFeedRerender(4000);
    console.log(LOG, 'фильтр выставлен:', optionLabel);
    return true;
  }

  // Выставляем дистанцию/город, если задано. Вызывается один раз за запуск.
  async function applyFilters() {
    if (!state.cfg.autoFilters) return true;
    try {
      const d = state.cfg.distance;
      if (d && d !== 'keep') await setSingleFilter(findLocationChip(), d, 'локация');
    } catch (e) { console.warn(LOG, 'applyFilters error', e); }
    return true;
  }

  // ---------- Один лайк ----------
  // Ждём исхода клика: успех по сети (POST 201) / тост «уже лайкнуто» /
  // удаление карточки / отказ сети. Возвращает строку-исход.
  async function waitLikeOutcome(btn, t0, timeoutMs) {
    while (Date.now() - t0 < timeoutMs) {
      if (lastAlreadyToastTs > t0) return 'already';
      if (state.lastLike && state.lastLike.ts > t0) {
        if (state.lastLike.blocked) return 'blocked';
        if (state.lastLike.ok) return 'liked-new';
        return 'rejected';                       // POST не 2xx — лимит/уже лайкнуто
      }
      if (!btn.isConnected) return 'liked-new';  // карточку убрали — лайк прошёл
      await sleep(100);
    }
    return 'uncertain';
  }

  // Диагностика кнопки для калибровки (Dry-run): что отличает лайкнутую от нет.
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
    // Подтягиваем кнопку в видимость минимально (nearest), чтобы не дёргать ленту
    // вверх — координаты для CDP-клика берём прямо перед кликом.
    if (!isInViewport(target.btn)) {
      target.btn.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      await sleep(rand(80, 160));
    }

    if (state.cfg.dryRun) {
      highlight(target.root, target.btn);
      state.liked.set(target.id, Date.now()); // только в памяти сессии, без записи в storage
      console.log(LOG, '[DRY-RUN] сердечко id=', target.id, heartDiag(target.btn));
      return true;
    }

    // Страховка от гонки: если карточка уже лайкнута (по пути) или попала в память —
    // НЕ кликаем, просто пропускаем, чтобы быстро мотать дальше.
    if (likedRecently(target.id) || isLikedHeart(target.btn) || !isLikeButton(target.btn)) {
      markLiked(target.id);
      console.log(LOG, 'пропуск (уже лайкнуто) id=', target.id);
      return true;
    }

    highlight(target.root, target.btn);
    const t0 = Date.now();
    const click = await trustedClickAt(target.btn);
    if (!click || !click.ok) {
      const reason = 'не удалось trusted-клик: ' + ((click && click.error) || '?') +
        ' (не закрывай баннер отладки и DevTools на этой вкладке)';
      autoPause(reason);
      state.lastError = reason;
      return false;
    }

    // Короткое окно: ловим блокировку/тост «уже лайкнуто». Лайкнутые карточки и так
    // отфильтрованы по SVG-пути, поэтому при отсутствии сигнала считаем лайк успешным
    // (trusted-клик надёжен) — без зависимости от inject.js и долгого ожидания сети.
    const outcome = await waitLikeOutcome(target.btn, t0, 500);
    if (outcome === 'blocked') return false; // авто-пауза уже сработала

    if (outcome === 'already' || outcome === 'rejected') {
      markLiked(target.id);
      console.log(LOG, 'уже лайкнуто/отклонено, пропускаю id=', target.id, '(', outcome, ')');
      return true;
    }
    // liked-new ИЛИ uncertain — считаем успехом.
    markLiked(target.id);
    bumpCounters();
    console.log(LOG, 'лайк id=', target.id, '(', outcome, ') сессия=', state.counters.session, 'сегодня=', state.counters.today);
    return true;
  }

  function bumpCounters() {
    if (state.counters.day !== todayStr()) { state.counters.day = todayStr(); state.counters.today = 0; }
    state.counters.session++;
    state.counters.today++;
    persistCounters();
  }

  function capReached() {
    const cap = state.cfg.dailyCap | 0;
    if (!cap) return false;
    if (state.counters.day !== todayStr()) return false;
    return state.counters.today >= cap;
  }

  // Короткая подпись текущего фильтра для индикатора «режим».
  function modeLabel() {
    const d = state.cfg.distance;
    return (d && d !== 'keep') ? d : 'текущий';
  }

  // ---------- Один проход по ленте ----------
  async function runPass(myGen) {
    state.currentMode = modeLabel();

    // Дать ленте прогрузиться (особенно сразу после смены фильтра).
    state.statusText = 'ищу анкеты…';
    for (let i = 0; i < 12 && engineAlive(myGen); i++) {
      if (findLikeTargets().length > 0) break;
      await sleep(400);
    }
    console.log(LOG, 'старт прохода |', feedDiag());

    let stuck = 0;
    const STUCK_LIMIT = 60; // ~1 мин безрезультатного поиска, прежде чем отдать ход другому режиму
    while (engineAlive(myGen)) {
      if (captchaVisible()) { autoPause('обнаружена капча'); break; }
      if (capReached()) { state.statusText = 'достигнут дневной лимит'; state.running = false; break; }

      const targets = findLikeTargets();
      if (targets.length === 0) {
        // Нет нелайков в кадре — мотаем дальше и догружаем ленту.
        const progressed = await advanceFeed(stuck >= 3);
        if (progressed) {
          stuck = 0;
          // Рейт-лимит: не мотаем ленту слишком часто (по огромным пачкам лайкнутых).
          const sMin = Math.max(0, Number(state.cfg.scrollPauseMin) || 0);
          const sMax = Math.max(sMin, Number(state.cfg.scrollPauseMax) || sMin);
          state.statusText = 'мотаю ленту…';
          await sleep(rand(sMin, sMax));
          continue;
        }
        // Прогресса нет: коротко ждём и СНОВА сканируем — так ловим и ручной скролл
        // пользователя, и запоздалую подгрузку. Никогда не уходим в «глухой» простой.
        stuck++;
        state.statusText = 'ищу новые анкеты…';
        await sleep(1000);
        if (stuck >= STUCK_LIMIT) {
          console.log(LOG, 'лента не растёт ~1мин, перезаход |', feedDiag());
          break; // в runEngine — перезайдёт; движок продолжит работать
        }
        continue;
      }
      stuck = 0;

      const t = targets[0];
      state.statusText = 'лайкаю…';
      try {
        await likeOne(t);
      } catch (e) {
        console.warn(LOG, 'ошибка лайка', e);
        markLiked(t.id);
      }
      if (!engineAlive(myGen)) break;

      // Пауза между лайками + редкая длинная пауза.
      // Санитизируем: числа, не отрицательные, min<=max (иначе sleep мог бы получить NaN/0).
      let minD = Math.max(0, Number(state.cfg.minDelay) || 0);
      let maxD = Math.max(minD, Number(state.cfg.maxDelay) || minD);
      let delay = rand(minD, maxD);
      if (state.cfg.longPauseEvery > 0 && state.counters.session > 0 &&
          state.counters.session % state.cfg.longPauseEvery === 0) {
        delay = rand(state.cfg.longPauseMinMs, state.cfg.longPauseMaxMs);
        state.statusText = 'длинная пауза…';
        console.log(LOG, 'длинная пауза', Math.round(delay / 1000), 'с');
      } else {
        console.log(LOG, 'пауза', Math.round(delay), 'мс (min=', minD, 'max=', maxD, ')');
      }
      await sleep(delay);
    }
  }

  // ---------- Главный запуск ----------
  function engineAlive(myGen) { return state.running && !state.paused && state.gen === myGen; }

  async function runEngine() {
    const myGen = ++state.gen;   // любой прошлый/зомби-цикл с этого момента невалиден
    state.running = true;
    state.paused = false;
    state.lastError = null;
    state.counters.session = 0;
    state.statusText = 'запуск…';
    console.log(LOG, 'движок запущен, gen=', myGen, '|', feedDiag());

    // Фильтр дистанции выставляем один раз за запуск, а не в каждом проходе.
    await applyFilters();

    // Никогда не останавливаемся сами: проход за проходом. Когда лента исчерпана —
    // короткая пауза и заходим снова (могут появиться новые анкеты).
    let idleCycles = 0;
    while (engineAlive(myGen)) {
      const before = state.counters.session;
      await runPass(myGen);
      if (!engineAlive(myGen)) break;

      if (state.counters.session === before) {
        idleCycles++;
        console.log(LOG, 'проход без новых лайков, перезаход, idle=', idleCycles);
        await sleep(1000); // короткий вдох; поиск/скролл продолжается внутри runPass
      } else {
        idleCycles = 0;
      }
    }

    if (state.gen === myGen) {   // чистит состояние только последний запуск
      state.running = false;
      state.currentMode = null;
      detachDebugger();
      console.log(LOG, 'движок остановлен. Итого за сессию:', state.counters.session);
    }
  }

  // ---------- Хранилище ----------
  function loadCfg() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['cfg', 'counters', 'likedMap', 'likedIds'], (data) => {
        state.cfg = Object.assign({}, DEFAULTS, data.cfg || {});
        if (data.counters && data.counters.day === todayStr()) {
          state.counters.today = data.counters.today || 0;
          state.counters.day = data.counters.day;
        }
        const now = Date.now();
        if (data.likedMap && typeof data.likedMap === 'object') {
          for (const id in data.likedMap) {
            const ts = data.likedMap[id];
            if (ts && (now - ts) < LIKE_TTL_MS) state.liked.set(id, ts); // протухшие (>24ч) не грузим
          }
        } else if (Array.isArray(data.likedIds)) {
          // миграция со старого формата без таймстампов: считаем их свежими
          for (const id of data.likedIds) state.liked.set(id, now);
        }
        resolve();
      });
    });
  }
  function persistCounters() {
    chrome.storage.local.set({ counters: { today: state.counters.today, day: state.counters.day } });
  }

  // ---------- Связь с попапом ----------
  function statusPayload() {
    return {
      running: state.running,
      paused: state.paused,
      statusText: state.statusText,
      currentMode: state.currentMode,
      session: state.counters.session,
      today: state.counters.today,
      lastError: state.lastError,
      onFeed: !!document.querySelector(SEL.feedListSelector)
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.cmd) return;
    if (msg.cmd === 'start') {
      loadCfg().then(() => {
        if (msg.cfg) { state.cfg = Object.assign({}, DEFAULTS, msg.cfg); chrome.storage.local.set({ cfg: state.cfg }); }
        runEngine(); // всегда свежий запуск; прошлый/зомби-цикл инвалидируется по gen
        sendResponse(statusPayload());
      });
      return true;
    }
    if (msg.cmd === 'stop') {
      state.gen++;            // инвалидируем активный цикл — он выйдет на ближайшей проверке
      state.running = false; state.paused = false;
      state.statusText = 'остановлен'; state.currentMode = null;
      detachDebugger();
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
  console.log(LOG, 'контент-скрипт загружен на', location.href);
})();
