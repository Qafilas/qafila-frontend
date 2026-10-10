/* Qafila auth page logic — sign in + register */

(function () {
  /* If already signed in, go to dashboard */
  if (getToken()) {
    location.href = 'index.html';
    return;
  }

  const authGrid      = document.getElementById('auth-grid');
  const registerCard  = document.getElementById('register-card');

  /* ---------- Sign in ---------- */
  const loginForm = document.getElementById('login-form');
  const loginBtn  = document.getElementById('login-btn');
  const loginErr  = document.getElementById('login-error');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErr.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const data = await apiLogin(email, password);
      setToken(data.token);
      location.href = 'index.html';
    } catch (err) {
      loginErr.textContent = err.message || 'Sign in failed';
      loginErr.hidden = false;
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in';
    }
  });

  /* ---------- Register ---------- */
  const registerForm = document.getElementById('register-form');
  const registerBtn  = document.getElementById('register-btn');
  const registerErr  = document.getElementById('register-error');
  const registerOk   = document.getElementById('register-success');

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerErr.hidden = true;
    registerOk.hidden = true;

    const name      = document.getElementById('reg-name').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const password  = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;

    if (password !== password2) {
      registerErr.textContent = 'Passwords do not match';
      registerErr.hidden = false;
      return;
    }

    if (password.length < 8) {
      registerErr.textContent = 'Password must be at least 8 characters';
      registerErr.hidden = false;
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating…';

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });

      registerOk.textContent = 'Account created. Signing you in…';
      registerOk.hidden = false;

      /* Auto sign in */
      const data = await apiLogin(email, password);
      setToken(data.token);
      setTimeout(() => { location.href = 'index.html'; }, 700);
    } catch (err) {
      registerErr.textContent = err.message || 'Registration failed';
      registerErr.hidden = false;
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create account';
    }
  });

  /* ---------- Setup status ---------- */
  async function checkSetupStatus() {
    try {
      const res = await fetch(API_BASE + '/api/auth/setup-status');
      const data = await res.json();

      if (data.hasManager) {
        /* Manager already exists — hide register card, center sign in */
        registerCard.remove();
        authGrid.classList.add('single');
      }
    } catch (err) {
      /* If the check fails, keep both cards. Harmless. */
      console.warn('setup-status failed', err);
    }
  }

  checkSetupStatus();
})();