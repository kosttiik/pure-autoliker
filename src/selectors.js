/*
 * Pure Auto-Liker — centralized selectors.
 * If a Pure release breaks button/filter detection, edit ONLY this file and
 * re-test with Dry-run first (it highlights hearts without clicking).
 *
 * styled-components class hashes (sc-*) change with every Pure release — never
 * rely on them as the primary anchor. SVG paths are stable across releases;
 * classes below are fallbacks only.
 */
(function () {
  window.__PURE = window.__PURE || {};

  window.__PURE.SEL = {
    feedListSelector: '#recommendations-list',
    scrollContainerSelector: '.ptr__children',

    // Every card contains a div with id="announcement-animation-<24hex>-" —
    // used as the stable deduplication key.
    announcementIdPrefix: 'announcement-animation-',

    // Like state is encoded in the heart's SVG path `d` prefix, not color/class.
    // Unliked outline heart = the button to click:
    likeHeartPathPrefixes: ['M16.0004 30.7899'],
    // Liked heart uses a different "comet tail" path — skip these:
    likedHeartPathPrefixes: ['M31.089 3.51995'],
    // Other buttons in the same group, explicitly excluded:
    nonLikePathPrefixes: ['M31.6004 16.102', 'M27.3996 4.2519'],

    // Primary filter-chip anchor: every chip's background is the branded SVG
    // blob with this path prefix.
    chipBlobPathPrefix: 'M87.6191',
    // Toast bubble background path — language-independent "already liked"
    // signal (the only toast Pure shows right after a like click).
    toastBlobPathPrefix: 'M20.2441',
    // Class fallbacks (observed July 2026, will go stale):
    filterBarSelector: '.sc-cXJujA',
    filterChipSelector: '.sc-goswLM',
    // Option rows of the location panel. The panel is NOT mounted in a portal
    // root — it is found structurally from its search input (see popupRoot).
    popupOptionSelector: '.sc-bsPwLR',

    text: {
      // Location chip labels used only to FIND the chip (fallback after the
      // flag-img check), so both site languages are merged into one list.
      locationLabels: [
        'Рядом', 'Соседи', 'Неподалёку', 'На горизонте', 'Далеко, но близко', 'Вся вселенная',
        'Nearby', 'Neighbors', 'Not far', 'On the horizon', 'Far, but close', 'Anywhere',
        'Москва', 'Санкт-Петербург', 'Лондон', 'Нью-Йорк', 'Париж', 'Лос-Анджелес',
        'Сидней', 'Берлин', 'Чикаго', 'Сингапур', 'Торонто', 'Дубай', 'Стамбул', 'Тбилиси',
        'Moscow', 'Saint Petersburg', 'London', 'New York', 'Paris', 'Los Angeles',
        'Berlin', 'Dubai', 'Istanbul', 'Singapore', 'Tbilisi'
      ],

      // Toast shown on a repeated like click — the only DOM signal of "already
      // liked". Checked in all site languages; the English variants are
      // unverified guesses (a miss only costs one redundant click, which is safe).
      alreadyLikedPhrases: ['Лайк уже был', 'Already liked', 'Like already sent']
    },

    // Containers the site renders popups/portals into.
    portalRoots: ['#popup-root', '#portal-root'],

    likeApiFragment: '/reactions/sent/likes'
  };
})();
