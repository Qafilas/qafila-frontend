/* Qafila frontend API helper */

const API_BASE = localStorage.getItem('qafila_api_base') || 'https://qafila-backend.onrender.com';

function getToken() {
  return sessionStorage.getItem('qafila_token');
}

function setToken(token) {
  sessionStorage.setItem('qafila_token', token);
}

function clearToken() {
  sessionStorage.removeItem('qafila_token');
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    ...options,
    headers
  });

  if (res.status === 401) {
    clearToken();
    if (!location.pathname.endsWith('login.html')) {
      location.href = 'login.html';
    }
    throw new Error('unauthorized');
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function apiLogin(email, password) {
  const res = await fetch(API_BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'login failed');
  return data;
}