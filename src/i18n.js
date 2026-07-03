/*
 * Pure Auto-Liker — UI language and site-label dictionaries.
 * Loaded before the other scripts in both the popup and the content script.
 * Russian only when the browser locale is ru*; any other locale gets English.
 * Pure localizes its own UI (filter chips, popup options) from the same browser
 * locale, so site-facing labels are picked with the same rule.
 */
(function () {
  const lang = ((navigator.language || 'en').toLowerCase().indexOf('ru') === 0) ? 'ru' : 'en';

  // Site-facing labels of the location popup options, keyed by the neutral ids
  // stored in cfg.distance.
  // WARNING: the English distance labels are unverified guesses — if selection
  // fails on an English Pure UI, the chip verification will report it; fix the
  // labels here.
  const LOCATION = {
    dist_near:      { ru: 'Рядом',             en: 'Nearby' },
    dist_neighbors: { ru: 'Соседи',            en: 'Neighbors' },
    dist_notfar:    { ru: 'Неподалёку',        en: 'Not far' },
    dist_horizon:   { ru: 'На горизонте',      en: 'On the horizon' },
    dist_far:       { ru: 'Далеко, но близко', en: 'Far, but close' },
    dist_universe:  { ru: 'Вся вселенная',     en: 'Anywhere' },  // en label confirmed from live DOM
    city_moscow:    { ru: 'Москва',            en: 'Moscow' },
    city_spb:       { ru: 'Санкт-Петербург',   en: 'Saint Petersburg' },
    city_london:    { ru: 'Лондон',            en: 'London' },
    city_ny:        { ru: 'Нью-Йорк',          en: 'New York' },
    city_paris:     { ru: 'Париж',             en: 'Paris' },
    city_la:        { ru: 'Лос-Анджелес',      en: 'Los Angeles' },
    city_berlin:    { ru: 'Берлин',            en: 'Berlin' },
    city_dubai:     { ru: 'Дубай',             en: 'Dubai' },
    city_istanbul:  { ru: 'Стамбул',           en: 'Istanbul' },
    city_singapore: { ru: 'Сингапур',          en: 'Singapore' }
  };

  const MSG = {
    en: {
      subtitle: 'smart auto-likes',
      cnt_session: 'session',
      cnt_today: 'today',
      cnt_total: 'total',
      rate_suffix: '/hour',
      btn_start: 'Start',
      btn_stop: 'Stop',
      sec_location: '📍 Location',
      loc_keep: 'Keep — as set on the site',
      grp_distance: 'Distance',
      grp_cities: 'Cities',
      opt_dist_near: 'Nearby · <5 km',
      opt_dist_neighbors: 'Neighbors · 10 km',
      opt_dist_notfar: 'Not far · 30 km',
      opt_dist_horizon: 'On the horizon · 50 km',
      opt_dist_far: 'Far, but close · 100 km',
      opt_dist_universe: 'Anywhere · >100 km',
      loc_custom: '✏️ Other city…',
      city_label: 'City name',
      city_ph: 'e.g., Tbilisi',
      city_hint: 'It will be found via the location popup search on the site',
      autofilters_row: 'Auto-apply filter <small>otherwise the current one on the site is used</small>',
      dryrun_row: 'Dry-run <small>highlight only, no clicks</small>',
      sec_speed: '🚀 Speed',
      preset_calm: 'Calm',
      preset_calm_s: '1.5–3 s',
      preset_normal: 'Normal',
      preset_normal_s: '0.8–1.2 s',
      preset_turbo: 'Turbo',
      preset_turbo_s: '0.35–0.7 s',
      adv_summary: 'Fine tuning',
      f_min: 'Min delay, ms',
      f_max: 'Max delay, ms',
      f_longpause: 'Long pause every',
      f_cap: 'Daily cap <small>0 = off</small>',
      f_smin: 'Scroll pause min, ms',
      f_smax: 'Scroll pause max, ms',
      hints_summary: '💡 How to use',
      hint1: 'Open the <b>pure.app</b> feed and hit <b>Start</b>. The first time, enable <b>Dry-run</b> — hearts get highlighted without any clicks.',
      hint2: 'You can <b>close</b> this window — liking continues in the background, the counter shows on the icon. The tab shows a <b>“…started debugging this browser”</b> banner — that is expected: do not dismiss it and do not open DevTools on that tab.',
      toast_saved: '✓ Saved',
      open_feed: 'Open the pure.app feed',
      status_running: 'running',
      status_stopped: 'stopped',
      status_starting: 'starting…',
      status_search: 'looking for profiles…',
      status_search_new: 'looking for new profiles…',
      status_scroll: 'scrolling the feed…',
      status_like: 'liking…',
      status_longpause: 'long pause…',
      status_cap: 'daily cap reached',
      status_pause_prefix: 'PAUSED: ',
      status_set_location: 'setting location: {label}',
      mode_current: 'current',
      err_blocked: 'Looks like a block/captcha (HTTP {status})',
      err_captcha: 'captcha detected',
      err_noresp: 'no response from the background worker',
      err_noelem: 'no element',
      err_click: 'trusted click failed: {err} (do not dismiss the debugging banner or open DevTools on this tab)',
      note_location: 'location: {label}',
      note_nochip: 'location chip not found — set it manually on the site',
      note_nopopup: 'the location popup did not open',
      note_nooption: 'option “{label}” not found in the popup',
      note_unconfirmed: 'location not confirmed, the chip shows “{text}”'
    },
    ru: {
      subtitle: 'умные авто-лайки',
      cnt_session: 'за сессию',
      cnt_today: 'сегодня',
      cnt_total: 'всего',
      rate_suffix: '/час',
      btn_start: 'Старт',
      btn_stop: 'Стоп',
      sec_location: '📍 Локация',
      loc_keep: 'Не менять — как выбрано на сайте',
      grp_distance: 'Дистанция',
      grp_cities: 'Города',
      opt_dist_near: 'Рядом · <5 км',
      opt_dist_neighbors: 'Соседи · 10 км',
      opt_dist_notfar: 'Неподалёку · 30 км',
      opt_dist_horizon: 'На горизонте · 50 км',
      opt_dist_far: 'Далеко, но близко · 100 км',
      opt_dist_universe: 'Вся вселенная · >100 км',
      loc_custom: '✏️ Другой город…',
      city_label: 'Название города',
      city_ph: 'например, Тбилиси',
      city_hint: 'Найду его через поиск в попапе локации на сайте',
      autofilters_row: 'Авто-выставлять фильтр <small>иначе берём текущий на сайте</small>',
      dryrun_row: 'Dry-run <small>только подсветка, без кликов</small>',
      sec_speed: '🚀 Темп',
      preset_calm: 'Спокойный',
      preset_calm_s: '1.5–3 с',
      preset_normal: 'Обычный',
      preset_normal_s: '0.8–1.2 с',
      preset_turbo: 'Турбо',
      preset_turbo_s: '0.35–0.7 с',
      adv_summary: 'Точная настройка',
      f_min: 'Задержка мин, мс',
      f_max: 'Задержка макс, мс',
      f_longpause: 'Длинная пауза каждые',
      f_cap: 'Лимит/день <small>0 = нет</small>',
      f_smin: 'Скролл-пауза мин, мс',
      f_smax: 'Скролл-пауза макс, мс',
      hints_summary: '💡 Как пользоваться',
      hint1: 'Открой ленту <b>pure.app</b> и жми <b>Старт</b>. Первый раз включи <b>Dry-run</b> — расширение подсветит сердечки, ничего не кликая.',
      hint2: 'Окно можно <b>закрыть</b> — лайки идут в фоне, счётчик виден на иконке. Сверху вкладки висит баннер <b>«…запустил отладку браузера»</b> — так и нужно: не закрывай его и не открывай DevTools на этой вкладке.',
      toast_saved: '✓ Сохранено',
      open_feed: 'Открой ленту pure.app',
      status_running: 'работает',
      status_stopped: 'остановлен',
      status_starting: 'запуск…',
      status_search: 'ищу анкеты…',
      status_search_new: 'ищу новые анкеты…',
      status_scroll: 'мотаю ленту…',
      status_like: 'лайкаю…',
      status_longpause: 'длинная пауза…',
      status_cap: 'достигнут дневной лимит',
      status_pause_prefix: 'ПАУЗА: ',
      status_set_location: 'ставлю локацию: {label}',
      mode_current: 'текущий',
      err_blocked: 'Похоже на блокировку/капчу (HTTP {status})',
      err_captcha: 'обнаружена капча',
      err_noresp: 'нет ответа фонового воркера',
      err_noelem: 'нет элемента',
      err_click: 'не удалось trusted-клик: {err} (не закрывай баннер отладки и DevTools на этой вкладке)',
      note_location: 'локация: {label}',
      note_nochip: 'чип локации не найден — выставь на сайте вручную',
      note_nopopup: 'попап локации не открылся',
      note_nooption: 'вариант «{label}» не найден в попапе',
      note_unconfirmed: 'локация не подтвердилась, на чипе: «{text}»'
    }
  };

  function t(key, subs) {
    let s = (MSG[lang] && MSG[lang][key]) || MSG.en[key] || key;
    if (subs) for (const k in subs) s = s.split('{' + k + '}').join(subs[k]);
    return s;
  }

  // Neutral key → site label for the current locale. Unknown keys pass through
  // unchanged so legacy configs with raw labels keep working.
  function locationLabel(key) {
    const m = LOCATION[key];
    return m ? (m[lang] || m.en) : key;
  }

  window.__PURE_I18N = { lang, t, locationLabel, LOCATION };
})();
