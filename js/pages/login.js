/* Qafila — sign in, create account, forgot and reset password */

(function () {
  const Q = window.Qafila;
  const $ = s => document.querySelector(s);

  const resetToken = Q.qs('reset');

  if (!resetToken && Q.getToken() && !Q.tokenExpired()) {
    location.replace('index.html');
    return;
  }

  /* Wake the server quietly so the first sign-in is quick. */
  Q.api.get('/api/health', { auth: false, timeout: 90000 }).catch(() => {});

  /* ---------- Views ---------- */
  const VIEWS = ['signin', 'register', 'forgot', 'sent', 'reset'];
  const TITLES = {
    signin: 'Sign in', register: 'Create account', forgot: 'Forgot password',
    sent: 'Check your email', reset: 'Reset password'
  };

  function show(view, focus = true) {
    if (!VIEWS.includes(view)) view = 'signin';
    VIEWS.forEach(v => { $('#view-' + v).hidden = v !== view; });
    document.title = `${TITLES[view]} – Qafila`;
    if (focus) {
      const first = $(`#view-${view} input:not([type=checkbox])`) || $(`#view-${view} .btn`);
      if (first) setTimeout(() => first.focus(), 0);
    }
  }

  function route() {
    if (resetToken && !location.hash) return show('reset');
    const v = (location.hash || '#signin').slice(1);
    show(v === 'reset' && !resetToken ? 'signin' : v);
  }
  window.addEventListener('hashchange', route);

  /* ---------- Helpers ---------- */
  function err(el, msg) { el.textContent = msg; el.hidden = false; }
  function clearErr(...els) { els.forEach(e => { e.hidden = true; }); }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* Remember the last email used on this device */
  try {
    const last = localStorage.getItem('qafila_last_email');
    if (last) { $('#signin-email').value = last; $('#signin-remember').checked = true; }
  } catch (_) {}

  /* Show / hide password */
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.for);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      btn.textContent = reveal ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      input.focus();
    });
  });

  /* Caps Lock warning on the sign-in password */
  const caps = $('#view-signin .caps-note');
  ['keydown', 'keyup'].forEach(t => $('#signin-password').addEventListener(t, e => {
    if (e.getModifierState) caps.hidden = !e.getModifierState('CapsLock');
  }));

  /* Password strength + rules */
  function rules(pw) {
    return { len: pw.length >= 8, letter: /[A-Za-z]/.test(pw), number: /\d/.test(pw) };
  }
  function score(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    return Math.max(1, s);
  }
  function wireStrength(inputSel, meterSel, rulesSel, confirmSel, matchSel) {
    const input = $(inputSel), meter = $(meterSel), list = $(rulesSel), confirm = $(confirmSel), match = $(matchSel);
    const paint = () => {
      const pw = input.value;
      const s = score(pw);
      meter.dataset.score = pw ? s : 0;
      const r = rules(pw);
      list.querySelectorAll('li').forEach(li => li.classList.toggle('met', !!r[li.dataset.rule]));
      paintMatch();
    };
    const paintMatch = () => {
      if (!confirm.value) { match.hidden = true; return; }
      const same = confirm.value === input.value;
      match.hidden = false;
      match.textContent = same ? 'Passwords match.' : 'Passwords do not match yet.';
      match.className = 'field-hint ' + (same ? 't-ok' : 't-warn');
    };
    input.addEventListener('input', paint);
    confirm.addEventListener('input', paintMatch);
  }
  wireStrength('#reg-password', '#reg-strength', '#reg-rules', '#reg-password2', '#reg-match');
  wireStrength('#reset-password', '#reset-strength', '#reset-rules', '#reset-password2', '#reset-match');

  function passwordIssue(pw, pw2) {
    const r = rules(pw);
    if (!r.len || !r.letter || !r.number) return 'Choose a password with at least 8 characters, including a letter and a number.';
    if (pw !== pw2) return 'The two passwords do not match.';
    return null;
  }

  /* Slow first request (server waking up): reassure, don't explain */
  function slowLabel(btn, text) {
    return setTimeout(() => { if (btn.disabled) Q.mount(btn, Q.h('span', { class: 'spin' }), text); }, 4000);
  }

  /* ---------- Sign in ---------- */
  $('#form-signin').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#signin-error');
    clearErr(errEl, $('#signin-ok'));
    const email = $('#signin-email').value.trim();
    const password = $('#signin-password').value;
    if (!email || !password) return err(errEl, 'Enter your email and password.');
    if (!EMAIL_RE.test(email)) return err(errEl, 'Enter a valid email address.');

    const btn = $('#signin-btn');
    Q.busy(btn, true, 'Signing in');
    const t = slowLabel(btn, 'Still signing in');
    try {
      const remember = $('#signin-remember').checked;
      const data = await Q.api.post('/api/auth/login', { email, password }, { auth: false });
      try {
        if (remember) localStorage.setItem('qafila_last_email', email);
        else localStorage.removeItem('qafila_last_email');
      } catch (_) {}
      Q.setToken(data.token, remember);
      location.replace('index.html');
    } catch (ex) {
      clearTimeout(t);
      Q.busy(btn, false);
      err(errEl, /invalid credentials/i.test(ex.message)
        ? 'The email or password is incorrect.'
        : ex.message);
      $('#signin-password').select();
    }
  });

  /* ---------- Create account ---------- */
  $('#form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#register-error');
    clearErr(errEl);
    const name = $('#reg-name').value.trim();
    const email = $('#reg-email').value.trim();
    const pw = $('#reg-password').value;
    const pw2 = $('#reg-password2').value;

    if (!name) return err(errEl, 'Enter your full name.');
    if (!EMAIL_RE.test(email)) return err(errEl, 'Enter a valid email address.');
    const issue = passwordIssue(pw, pw2);
    if (issue) return err(errEl, issue);

    const btn = $('#register-btn');
    Q.busy(btn, true, 'Creating account');
    const t = slowLabel(btn, 'Still creating your account');
    try {
      const data = await Q.api.post('/api/auth/register', { name, email, password: pw }, { auth: false });
      let token = data.token;
      if (!token) token = (await Q.api.post('/api/auth/login', { email, password: pw }, { auth: false })).token;
      Q.setToken(token, true);
      try { localStorage.setItem('qafila_last_email', email); } catch (_) {}
      location.replace('pages/import.html?welcome=1');
    } catch (ex) {
      clearTimeout(t);
      Q.busy(btn, false);
      err(errEl, ex.message);
    }
  });

  /* ---------- Forgot password ---------- */
  let lastResetEmail = '';

  async function sendReset(email, btn) {
    const base = location.href.split(/[?#]/)[0].replace(/\/[^/]*$/, '');
    Q.busy(btn, true, 'Sending');
    try {
      const r = await Q.api.post('/api/auth/forgot', { email, reset_base: base }, { auth: false });
      lastResetEmail = email;
      $('#sent-text').textContent =
        `If an account exists for ${email}, a reset link is on its way. The link expires in ${r.minutes || 30} minutes.`;
      return true;
    } finally {
      Q.busy(btn, false);
    }
  }

  $('#form-forgot').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#forgot-error');
    clearErr(errEl);
    const email = $('#forgot-email').value.trim();
    if (!EMAIL_RE.test(email)) return err(errEl, 'Enter the email address you sign in with.');
    try {
      await sendReset(email, $('#forgot-btn'));
      location.hash = '#sent';
    } catch (ex) {
      err(errEl, ex.message);
    }
  });

  /* Prefill the forgot form with whatever was typed on sign in */
  window.addEventListener('hashchange', () => {
    if (location.hash === '#forgot' && !$('#forgot-email').value) $('#forgot-email').value = $('#signin-email').value;
  });

  const resendBtn = $('#resend-btn');
  resendBtn.addEventListener('click', async () => {
    if (!lastResetEmail) { location.hash = '#forgot'; return; }
    try {
      await sendReset(lastResetEmail, resendBtn);
      Q.toast({ title: 'Reset link sent again', text: lastResetEmail });
      resendBtn.disabled = true;
      let n = 30;
      const tick = setInterval(() => {
        resendBtn.textContent = `Send again in ${--n} s`;
        if (n <= 0) { clearInterval(tick); resendBtn.disabled = false; resendBtn.textContent = "Didn't get it? Send again"; }
      }, 1000);
    } catch (ex) {
      Q.toast({ level: 'crit', title: 'Could not send', text: ex.message });
    }
  });

  /* ---------- Reset password (from the emailed link) ---------- */
  async function checkReset() {
    try {
      const r = await Q.api.get('/api/auth/reset/check?token=' + encodeURIComponent(resetToken), { auth: false });
      $('#reset-sub').textContent = `For ${r.email}. Use at least 8 characters, with a letter and a number.`;
      $('#form-reset').hidden = false;
      $('#reset-password').focus();
    } catch (ex) {
      $('#reset-title').textContent = 'This link has expired';
      $('#reset-sub').textContent = 'Reset links work once and expire after 30 minutes. Ask for a new one.';
      $('#reset-expired').hidden = false;
    }
  }

  $('#form-reset').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('#reset-error');
    clearErr(errEl);
    const pw = $('#reset-password').value;
    const issue = passwordIssue(pw, $('#reset-password2').value);
    if (issue) return err(errEl, issue);

    const btn = $('#reset-btn');
    Q.busy(btn, true, 'Saving');
    try {
      const r = await Q.api.post('/api/auth/reset', { token: resetToken, password: pw }, { auth: false });
      Q.clearToken();
      history.replaceState(null, '', location.pathname + '#signin');
      $('#signin-email').value = r.email || '';
      $('#signin-password').value = '';
      const ok = $('#signin-ok');
      ok.textContent = 'Your password has been changed. Sign in with your new password.';
      ok.hidden = false;
      show('signin');
      $('#signin-password').focus();
    } catch (ex) {
      Q.busy(btn, false);
      err(errEl, ex.message);
    }
  });

  /* ---------- Boot ---------- */
  if (Q.qs('expired')) {
    const e = $('#signin-error');
    e.textContent = 'Your session has ended. Sign in again.';
    e.hidden = false;
  }
  route();
  if (resetToken) checkReset();
})();
