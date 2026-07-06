/* Pure Auto-Liker landing — i18n, reveals, FAQ, version pull. Vanilla, no deps. */
(function () {
  "use strict";

  var REPO = "kosttiik/pure-autoliker";
  var FALLBACK_VERSION = "v2.2.3";

  var TAGS = [
    "pure auto liker", "pure autoliker", "pure auto-liker", "автолайкер pure", "пьюр автолайкер",
    "пьюр автолайки", "пьюр автолайк", "пур автолайкер", "автолайки пьюр", "автолайк пьюр", "лайки пьюр",
    "pure app автолайк", "pure.app бот", "пьюр бот", "бот пьюр", "авто лайки pure", "авто-лайки pure",
    "автолайки pure", "pure autoliker github", "автоматизация лайков", "автоматизация пьюр", "расширение для pure",
    "расширение пьюр", "chrome extension pure", "brave extension pure", "edge extension pure", "opera extension",
    "vivaldi extension", "arc browser", "яндекс браузер pure", "пьюр яндекс браузер", "pure dating automation",
    "auto like bot", "like bot pure", "pure знакомства бот", "пьюр знакомства", "свайпы pure", "свайпы пьюр",
    "like automation", "mv3 extension", "manifest v3 liker", "chrome devtools protocol", "open source dating bot",
    "pure feed liker", "авто-лайки для pure", "бот для pure", "бот для пьюр", "pure app bot", "auto swipe pure",
    "like bot chrome", "pure app liker", "auto liker для pure", "pure бот лайки", "расширение chrome pure",
    "pure app extension", "automate pure likes", "pure likes bot", "бесплатный автолайкер", "бесплатный автолайкер pure",
    "скрипт лайков pure", "pure feed automation", "yandex browser extension", "pure знакомства автолайк",
    "auto heart pure", "pure swipe bot", "массовые лайки pure", "массовые лайки пьюр", "pure app автоматизация",
    "dating app auto liker", "pure liker github", "kosttiik pure autoliker", "browser extension likes",
    "pure app chrome extension", "авто свайп pure", "pure feed bot", "gpl open source", "chromium extension",
    "скачать автолайкер pure", "download pure autoliker", "pure app бот скачать", "автолайкинг pure",
    "pure autoliker 2026", "пьюр автолайкер расширение"
  ];

  var DICT = {
    en: {
      nav_how: "How it works", nav_features: "Features", nav_faq: "FAQ", nav_safety: "Safety",
      hero_eyebrow: "Open-source · Chrome · Brave · Edge · Opera · Yandex · MV3",
      hero_title_a: "Auto-likes for Pure,", hero_title_grad: "on autopilot.",
      hero_sub: "A browser extension that auto-likes new profiles in the pure.app feed — with a human-like pace, rate limits and a city filter. Open source, nothing extra.",
      hero_cta_install: "Install from GitHub", hero_cta_how: "How it works",
      hero_meta_license: "Open license", hero_meta_version: "From GitHub releases", hero_meta_browsers: "Any Chromium browser",
      popup_subtitle: "smart auto-likes", popup_running: "Running", popup_paused: "Paused",
      popup_session: "session", popup_today: "today", popup_total: "total", popup_city: "Berlin", popup_hour: "hr",
      popup_start: "Start", popup_stop: "Stop", popup_location: "Location", popup_speed: "Speed",
      popup_city_full: "Berlin", popup_calm: "Calm", popup_normal: "Normal", popup_turbo: "Turbo",
      popup_hint_title: "Tip:", popup_hint: "run the first pass with Dry-run — hearts get highlighted without any clicks.",
      popup_dryrun: "Dry-run", popup_autofilter: "Auto-filter",
      how_eyebrow: "In 4 steps", how_title: "From install to first like in a couple of minutes",
      how_sub: "No sign-up and no servers. Everything runs locally, in your browser and under your own session.",
      step_1_title: "Install the extension", step_1_text: "Download the repo, turn on Developer mode and hit “Load unpacked”.",
      step_2_title: "Open the pure.app feed", step_2_text: "Log in to pure.app and open the profile feed.",
      step_3_title: "Hit Start", step_3_text: "Pick a filter and speed. For the first run, enable Dry-run to check it.",
      step_4_title: "Likes run on their own", step_4_text: "Close the popup — it keeps going in the background, counter shows on the icon.",
      feat_eyebrow: "Features", feat_title: "Everything you need for tidy automation",
      feat_sub: "It likes smartly, remembers history and keeps a human rhythm — so everything looks natural.",
      feat_1_title: "Only new profiles", feat_1_text: "Skips already-liked ones, likes only new profiles and remembers them across runs (24 hours).",
      feat_2_title: "Human-like pace", feat_2_text: "Configurable delays between likes, a periodic long pause and a daily cap.",
      feat_3_title: "City & radius filter", feat_3_text: "From “Nearby” to “Whole universe” or a specific city — the extension sets the filter for you.",
      feat_4_title: "Speed presets", feat_4_text: "Calm, Normal, Turbo — or fine-tune delays and scrolling by hand.",
      feat_5_title: "Runs in background", feat_5_text: "Close the popup and switch tabs — liking continues, counter on the icon.",
      feat_6_title: "Dry-run mode", feat_6_text: "Highlights the hearts without clicking — a safe way to check the first run.",
      show_eyebrow: "The interface", show_title: "A tidy popup with everything at hand",
      show_sub: "Counters, status, location and speed on one screen. Fine-tuning and hints live just below.",
      show_1_title: "Live counters", show_1_text: "Likes this session, today and total — updated on the fly.",
      show_2_title: "Trusted clicks (CDP)", show_2_text: "Real input via the Chrome DevTools Protocol so Pure registers the likes.",
      show_3_title: "Presets and fine-tuning", show_3_text: "Quick modes plus manual delays, pauses and a daily cap.",
      safe_eyebrow: "Transparency", safe_title: "Open source, no servers",
      safe_sub: "An educational project: exploring MV3, the Chrome DevTools Protocol and common anti-bot patterns on your own account.",
      safe_1_title: "Fully open source (GPL-3.0)", safe_1_text: "You can read every line and build it yourself — no hidden behavior.",
      safe_2_title: "Sends nothing outside", safe_2_text: "Runs only in your browser, under your session. No data leaves your machine.",
      safe_3_title: "Doesn’t break Pure", safe_3_text: "It doesn’t bypass payments, touch anyone else’s data or exploit vulnerabilities.",
      safe_4_title: "The same clicks you’d make", safe_4_text: "It clicks the same buttons you would by hand — just automatically.",
      safe_note: "Automating actions may go against Pure’s terms of service. Use it at your own risk — any account limitations are on you.",
      faq_title: "Frequently asked", faq_sub: "The short answers to what people ask most about Pure Auto-Liker.",
      faq_1_q: "What is Pure Auto-Liker?", faq_1_a: "It’s an open-source extension for Chrome, Brave, Edge, Opera, Vivaldi and Yandex Browser that automatically likes new profiles in the pure.app feed, skipping already-liked ones.",
      faq_2_q: "Is it safe for my account?", faq_2_a: "The extension just clicks the same buttons you would, in your own browser. That said, automation may violate Pure’s rules, so use it at your own risk and keep a human-like pace.",
      faq_3_q: "Why does a “debugging this browser” banner appear?", faq_3_a: "Pure ignores synthetic clicks, so the extension dispatches real input through the Chrome DevTools Protocol. That makes the browser show a yellow debugging banner — don’t dismiss it and don’t open DevTools on that tab.",
      faq_4_q: "Does it work in Chrome, Brave and Yandex Browser?", faq_4_a: "Yes. It’s a Manifest V3 extension for any Chromium browser — Chrome, Brave, Microsoft Edge, Opera, Vivaldi, Arc and Yandex Browser. Install it via “Load unpacked”.",
      faq_5_q: "Are there rate limits and pauses?", faq_5_a: "Yes. You can set delays between likes, a long pause every N likes and a daily cap — so the behavior looks natural.",
      faq_6_q: "Is it free and what license?", faq_6_a: "Completely free and open source under the GNU GPL-3.0 license. The code is on GitHub — you can inspect, modify and build it yourself.",
      tags_eyebrow: "Keywords", tags_title: "This is what people search for",
      tags_sub: "Popular queries around auto-liking on Pure — the ones this project is found by.",
      cta_title: "Ready to like on autopilot?", cta_sub: "Install it free from GitHub in a couple of minutes and run the first pass in Dry-run.",
      cta_install: "Open on GitHub", cta_docs: "Read the README",
      footer_tagline: "Auto-likes for Pure · open-source", footer_license: "GPL-3.0 License", footer_releases: "Releases",
      footer_disclaimer: "This project is not affiliated with Pure and is made for educational purposes. Pure is a trademark of its respective owner. Automation may violate the service’s terms of use; use at your own risk. Licensed under the GNU GPL-3.0.",
      doc_title: "Pure Auto-Liker — auto-likes for the Pure app · autopilot for pure.app"
    },
    ru: {
      nav_how: "Как работает", nav_features: "Возможности", nav_faq: "FAQ", nav_safety: "Безопасность",
      hero_eyebrow: "Open-source · Chrome · Brave · Edge · Opera · Яндекс · MV3",
      hero_title_a: "Автолайки для Pure", hero_title_grad: "на автопилоте.",
      hero_sub: "Расширение для браузера, которое само лайкает новые профили в ленте pure.app — с человечным темпом, лимитами и фильтром по городу. Открытый код, ничего лишнего.",
      hero_cta_install: "Установить с GitHub", hero_cta_how: "Как это работает",
      hero_meta_license: "Открытая лицензия", hero_meta_version: "Из релизов GitHub", hero_meta_browsers: "Любой Chromium-браузер",
      popup_subtitle: "умные автолайки", popup_running: "Работает", popup_paused: "Пауза",
      popup_session: "сессия", popup_today: "сегодня", popup_total: "всего", popup_city: "Москва", popup_hour: "час",
      popup_start: "Старт", popup_stop: "Стоп", popup_location: "Локация", popup_speed: "Скорость",
      popup_city_full: "Москва", popup_calm: "Спокойно", popup_normal: "Обычно", popup_turbo: "Турбо",
      popup_hint_title: "Совет:", popup_hint: "первый запуск включите с Dry-run — сердечки подсветятся без кликов.",
      popup_dryrun: "Dry-run", popup_autofilter: "Авто-фильтр",
      how_eyebrow: "За 4 шага", how_title: "От установки до первого лайка — пара минут",
      how_sub: "Никакой регистрации и серверов. Всё работает локально, в вашем браузере и под вашей сессией.",
      step_1_title: "Установите расширение", step_1_text: "Скачайте репозиторий, включите режим разработчика и нажмите «Загрузить распакованное».",
      step_2_title: "Откройте ленту pure.app", step_2_text: "Залогиньтесь на pure.app и перейдите в ленту профилей.",
      step_3_title: "Нажмите Start", step_3_text: "Выберите фильтр и скорость. На первый раз включите Dry-run для проверки.",
      step_4_title: "Лайки идут сами", step_4_text: "Закройте попап — процесс продолжится в фоне, счётчик виден на иконке.",
      feat_eyebrow: "Возможности", feat_title: "Всё, что нужно для аккуратной автоматизации",
      feat_sub: "Лайкает разумно, помнит историю и держит человеческий ритм — чтобы всё выглядело естественно.",
      feat_1_title: "Только новые профили", feat_1_text: "Пропускает уже лайкнутые, ставит лайк только новым и помнит их между запусками (24 часа).",
      feat_2_title: "Человечный темп", feat_2_text: "Настраиваемые задержки между лайками, периодическая длинная пауза и дневной лимит.",
      feat_3_title: "Фильтр города и радиуса", feat_3_text: "От «Рядом» до «Вся вселенная» или конкретный город — расширение выставит фильтр за вас.",
      feat_4_title: "Пресеты скорости", feat_4_text: "Спокойно, Обычно, Турбо — или тонкая ручная настройка задержек и прокрутки.",
      feat_5_title: "Работа в фоне", feat_5_text: "Закройте попап и переключайте вкладки — лайки продолжаются, счётчик на иконке.",
      feat_6_title: "Режим Dry-run", feat_6_text: "Подсвечивает сердечки без кликов — безопасный способ проверить первый запуск.",
      show_eyebrow: "Интерфейс", show_title: "Аккуратный попап, всё под рукой",
      show_sub: "Счётчики, статус, локация и скорость — на одном экране. Ниже — тонкая настройка и подсказки.",
      show_1_title: "Живые счётчики", show_1_text: "Лайки за сессию, за сегодня и всего — обновляются на лету.",
      show_2_title: "Настоящие клики (CDP)", show_2_text: "Клики через Chrome DevTools Protocol, чтобы Pure их засчитывал.",
      show_3_title: "Пресеты и точная настройка", show_3_text: "Быстрые режимы плюс ручные задержки, паузы и дневной лимит.",
      safe_eyebrow: "Прозрачность", safe_title: "Открытый код, никаких серверов",
      safe_sub: "Проект образовательный: исследование MV3, Chrome DevTools Protocol и типичных анти-бот паттернов на своём аккаунте.",
      safe_1_title: "Полностью открытый код (GPL-3.0)", safe_1_text: "Можно прочитать каждую строку и собрать самому — никаких скрытых действий.",
      safe_2_title: "Ничего не отправляет наружу", safe_2_text: "Работает только в вашем браузере и под вашей сессией. Данные никуда не уходят.",
      safe_3_title: "Не ломает Pure", safe_3_text: "Не обходит оплату, не трогает чужие данные и не эксплуатирует уязвимости.",
      safe_4_title: "Те же клики, что и у вас", safe_4_text: "Кликает те же кнопки, что вы нажали бы вручную — просто автоматически.",
      safe_note: "Автоматизация действий может нарушать условия использования Pure. Используйте на свой страх и риск — ответственность за аккаунт на вас.",
      faq_title: "Частые вопросы", faq_sub: "Коротко о том, что чаще всего спрашивают о Pure Auto-Liker.",
      faq_1_q: "Что такое Pure Auto-Liker?", faq_1_a: "Это open-source расширение для Chrome, Brave, Edge, Opera, Vivaldi и Яндекс.Браузера, которое автоматически ставит лайки новым профилям в ленте pure.app, пропуская уже лайкнутые.",
      faq_2_q: "Это безопасно для аккаунта?", faq_2_a: "Расширение просто кликает те же кнопки, что и вы, в вашем браузере. Тем не менее автоматизация может нарушать правила Pure, поэтому используйте на свой риск и включайте человечный темп.",
      faq_3_q: "Почему появляется баннер «отладка браузера»?", faq_3_a: "Pure игнорирует синтетические клики, поэтому расширение отправляет настоящие события через Chrome DevTools Protocol. Из-за этого браузер показывает жёлтый баннер отладки — не закрывайте его и не открывайте DevTools на этой вкладке.",
      faq_4_q: "Работает ли в Chrome, Brave и Яндекс.Браузере?", faq_4_a: "Да. Это Manifest V3 расширение для любого Chromium-браузера — Chrome, Brave, Microsoft Edge, Opera, Vivaldi, Arc и Яндекс.Браузер. Устанавливается через «Загрузить распакованное».",
      faq_5_q: "Есть ли лимиты и паузы?", faq_5_a: "Да. Можно задать задержки между лайками, длинные паузы через N лайков и дневной лимит — чтобы поведение выглядело естественно.",
      faq_6_q: "Это бесплатно и какая лицензия?", faq_6_a: "Полностью бесплатно и с открытым кодом под лицензией GNU GPL-3.0. Код доступен на GitHub — можно проверить, изменить и собрать самому.",
      tags_eyebrow: "Ключевые слова", tags_title: "Ищут именно это",
      tags_sub: "Популярные запросы вокруг автолайков в Pure — по ним этот проект и находят.",
      cta_title: "Готовы лайкать на автопилоте?", cta_sub: "Установите бесплатно с GitHub за пару минут и запустите первый проход в Dry-run.",
      cta_install: "Открыть на GitHub", cta_docs: "Читать README",
      footer_tagline: "Автолайки для Pure · open-source", footer_license: "Лицензия GPL-3.0", footer_releases: "Релизы",
      footer_disclaimer: "Проект не связан с Pure и создан в образовательных целях. Pure — товарный знак соответствующего владельца. Автоматизация может нарушать условия использования сервиса; используйте на свой страх и риск. Лицензия GNU GPL-3.0.",
      doc_title: "Pure Auto-Liker — автолайки для Pure на автопилоте · pure.app бот"
    }
  };

  function detectLang() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q === "ru" || q === "en") return q;
      var saved = localStorage.getItem("pl_lang");
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) {}
    return "ru";
  }

  function applyLang(lang) {
    var D = DICT[lang] || DICT.en;
    document.documentElement.lang = lang;
    document.title = D.doc_title;
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-i18n");
      if (D[key] != null) nodes[i].textContent = D[key];
    }
    var btn = document.getElementById("langBtn");
    if (btn) btn.textContent = lang === "ru" ? "EN" : "RU";
  }

  function setLang(lang) {
    try { localStorage.setItem("pl_lang", lang); } catch (e) {}
    applyLang(lang);
  }

  function renderTags() {
    var host = document.getElementById("tagsCloud");
    if (!host) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < TAGS.length; i++) {
      var s = document.createElement("span");
      s.className = "tag";
      s.textContent = TAGS[i];
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  function setupReveal() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els = document.querySelectorAll(".reveal");
    if (reduce || typeof IntersectionObserver === "undefined") {
      for (var i = 0; i < els.length; i++) els[i].classList.add("in");
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target;
          var d = el.getAttribute("data-reveal-delay") || 0;
          el.style.transitionDelay = d + "ms";
          el.classList.add("in");
          io.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  function setupFaq() {
    var items = document.querySelectorAll("#faqList .faq-item");
    items.forEach(function (item) {
      var q = item.querySelector(".faq-q");
      q.addEventListener("click", function () {
        var isOpen = item.classList.contains("open");
        items.forEach(function (o) { o.classList.remove("open"); });
        if (!isOpen) item.classList.add("open");
      });
    });
  }

  function fetchVersion() {
    var el = document.getElementById("versionStat");
    if (!el) return;
    var norm = function (v) { v = String(v); return v.charAt(0).toLowerCase() === "v" ? v : "v" + v; };
    fetch("https://api.github.com/repos/" + REPO + "/releases/latest")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.tag_name) { el.textContent = norm(d.tag_name); return null; }
        return fetch("https://api.github.com/repos/" + REPO + "/tags")
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (tags) {
            if (Array.isArray(tags) && tags[0] && tags[0].name) el.textContent = norm(tags[0].name);
          });
      })
      .catch(function () {});
  }

  function init() {
    renderTags();
    applyLang(detectLang());
    setupReveal();
    setupFaq();
    fetchVersion();
    var btn = document.getElementById("langBtn");
    if (btn) btn.addEventListener("click", function () {
      setLang(document.documentElement.lang === "ru" ? "en" : "ru");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
