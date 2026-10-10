/* Login page logic */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Logging in…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await apiLogin(email, password);
      setToken(data.token);
      location.href = 'index.html';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  });
});