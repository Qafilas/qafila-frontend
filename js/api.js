/* ============================================================
   Qafila — API client
   One place for the backend URL, the session token and fetch.
   ============================================================ */

(function () {
  const DEFAULT_API = 'https://qafila-backend.onrender.com';

  function store(kind) {
    try { return kind === 'local' ? window.localStorage : window.sessionStorage; }
    catch (_) { return null; }
  }

  function readKey(key) {
    const l = store('local'), s = store('session');
    return (l && l.getItem(key)) || (s && s.getItem(key)) || null;
  }

  /* The backend URL can be changed from Settings (useful for local testing). */
  function getApiBase() {
    const saved = (store('local') && store('local').getItem('qafila_api_base')) || '';
    return (saved || DEFAULT_API).replace(/\/+$/, '');
  }

  function setApiBase(url) {
    const l = store('local');
    if (!l) return;
    if (!url || url.replace(/\/+$/, '') === DEFAULT_API) l.removeItem('qafila_api_base');
    else l.setItem('qafila_api_base', url.replace(/\/+$/, ''));
  }

  function getToken() { return readKey('qafila_token'); }

  /* remember = true keeps the session after the browser closes */
  function setToken(token, remember) {
    clearToken();
    const s = store(remember ? 'local' : 'session');
    if (s) s.setItem('qafila_token', token);
  }

  function clearToken() {
    ['local', 'session'].forEach(k => { const s = store(k); if (s) s.removeItem('qafila_token'); });
  }

  /* Decode the JWT payload (name, email, exp) without verifying it. */
  function tokenPayload() {
    const t = getToken();
    if (!t) return null;
    try {
      const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (_) { return null; }
  }

  function tokenExpired() {
    const p = tokenPayload();
    return !p || (p.exp && p.exp * 1000 < Date.now());
  }

  function loginUrl() {
    return location.pathname.includes('/pages/') ? '../login.html' : 'login.html';
  }

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  async function request(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    let body = options.body;

    if (body !== undefined && typeof body !== 'string') {
      body = JSON.stringify(body);
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = getToken();
    if (token && options.auth !== false) headers['Authorization'] = 'Bearer ' + token;

    /* Render's free tier sleeps; the first request can take ~50 s. */
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), options.timeout || 70000);

    let res;
    try {
      res = await fetch(getApiBase() + path, {
        method: options.method || 'GET',
        headers,
        body,
        signal: ctrl.signal
      });
    } catch (err) {
      clearTimeout(timer);
      throw new ApiError(
        err.name === 'AbortError'
          ? 'The server took too long to answer. It may be waking up; try again in a moment.'
          : 'Cannot reach the Qafila server. Check your connection.',
        0
      );
    }
    clearTimeout(timer);

    if (res.status === 401 && options.auth !== false) {
      clearToken();
      if (!/login\.html$/.test(location.pathname)) {
        location.href = loginUrl() + '?expired=1';
      }
      throw new ApiError('Your session has ended. Sign in again.', 401);
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

    if (!res.ok) {
      const msg = data && data.error ? data.error : `Request failed (${res.status})`;
      throw new ApiError(msg.charAt(0).toUpperCase() + msg.slice(1), res.status, data);
    }
    return data;
  }

  const api = {
    get:   (p, o)    => request(p, Object.assign({}, o, { method: 'GET' })),
    post:  (p, b, o) => request(p, Object.assign({}, o, { method: 'POST', body: b === undefined ? {} : b })),
    put:   (p, b, o) => request(p, Object.assign({}, o, { method: 'PUT', body: b })),
    patch: (p, b, o) => request(p, Object.assign({}, o, { method: 'PATCH', body: b })),
    del:   (p, o)    => request(p, Object.assign({}, o, { method: 'DELETE' })),
    request
  };

  window.Qafila = Object.assign(window.Qafila || {}, {
    DEFAULT_API,
    api,
    ApiError,
    getApiBase,
    setApiBase,
    getToken,
    setToken,
    clearToken,
    tokenPayload,
    tokenExpired,
    loginUrl
  });
})();
