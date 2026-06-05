/*
 * Работает в КОНТЕКСТЕ СТРАНИЦЫ (не isolated world).
 * Оборачивает window.fetch, чтобы ловить ответ на запрос лайка и сигналить
 * контент-скрипту через window.postMessage. Также сообщает об ошибках/капче
 * (403/429), чтобы движок мог авто-паузу сделать.
 */
(function () {
  if (window.__PURE_FETCH_PATCHED) return;
  window.__PURE_FETCH_PATCHED = true;

  const LIKE_FRAGMENT = '/reactions/sent/likes';

  function post(payload) {
    try {
      window.postMessage(Object.assign({ source: 'PURE_AUTO_LIKER' }, payload), '*');
    } catch (e) {}
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = (typeof input === 'string' ? input : (input && input.url)) || '';
    const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const isLike = url.indexOf(LIKE_FRAGMENT) !== -1 && method === 'POST';

    const p = origFetch.apply(this, arguments);
    if (!isLike) return p;

    return p.then(
      function (res) {
        post({
          type: 'PURE_LIKE_RESULT',
          ok: res.status === 201 || res.status === 200,
          status: res.status,
          blocked: res.status === 403 || res.status === 429
        });
        return res;
      },
      function (err) {
        post({ type: 'PURE_LIKE_RESULT', ok: false, status: 0, networkError: true });
        throw err;
      }
    );
  };
})();
