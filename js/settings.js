/* Qafila settings page */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const profileForm    = document.getElementById('profile-form');
  const profileName    = document.getElementById('p-name');
  const profileEmail   = document.getElementById('p-email');
  const profileSubmit  = document.getElementById('profile-submit');
  const profileErr     = document.getElementById('profile-error');
  const profileOk      = document.getElementById('profile-success');

  const pwForm         = document.getElementById('password-form');
  const pwCurrent      = document.getElementById('pw-current');
  const pwNew          = document.getElementById('pw-new');
  const pwConfirm      = document.getElementById('pw-confirm');
  const pwSubmit       = document.getElementById('password-submit');
  const pwErr          = document.getElementById('password-error');
  const pwOk           = document.getElementById('password-success');

  const nodesList      = document.getElementById('nodes-list');
  const nodesCount     = document.getElementById('nodes-count');

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function timeAgo(ts) {
    if (!ts) return 'never';
    const sec = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function decodeToken() {
    try {
      const t = getToken();
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1]));
    } catch (_) { return null; }
  }

  /* ============================================================
     Prefill profile
     ============================================================ */

  function prefillProfile() {
    const payload = decodeToken();
    if (!payload) return;
    if (payload.name)  profileName.value  = payload.name;
    if (payload.email) profileEmail.value = payload.email;
  }

  /* ============================================================
     Save profile
     ============================================================ */

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileErr.hidden = true;
    profileOk.hidden  = true;
    profileSubmit.disabled = true;
    profileSubmit.textContent = 'Saving…';

    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: profileName.value.trim() })
      });

      profileOk.textContent = 'Profile updated.';
      profileOk.hidden = false;
    } catch (err) {
      /* Endpoint may not exist yet — show a soft notice */
      profileErr.textContent = 'Profile save endpoint not yet available on the backend.';
      profileErr.hidden = false;
    }

    profileSubmit.disabled = false;
    profileSubmit.textContent = 'Save changes';
  });

  /* ============================================================
     Change password
     ============================================================ */

  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    pwErr.hidden = true;
    pwOk.hidden  = true;

    if (pwNew.value !== pwConfirm.value) {
      pwErr.textContent = 'New passwords do not match.';
      pwErr.hidden = false;
      return;
    }

    if (pwNew.value.length < 8) {
      pwErr.textContent = 'New password must be at least 8 characters.';
      pwErr.hidden = false;
      return;
    }

    pwSubmit.disabled = true;
    pwSubmit.textContent = 'Updating…';

    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          current: pwCurrent.value,
          next: pwNew.value
        })
      });

      pwOk.textContent = 'Password updated.';
      pwOk.hidden = false;

      pwForm.reset();
    } catch (err) {
      pwErr.textContent = 'Password change endpoint not yet available on the backend.';
      pwErr.hidden = false;
    }

    pwSubmit.disabled = false;
    pwSubmit.textContent = 'Update password';
  });

  /* ============================================================
     Nodes list
     ============================================================ */

  async function loadNodes() {
    try {
      const [vehicles, nodes] = await Promise.all([
        apiFetch('/api/vehicles?all=1'),
        apiFetch('/api/nodes').catch(() => [])
      ]);

      nodesList.innerHTML = '';

      /* If the /nodes endpoint does not exist yet, fall back to vehicles */
      const items = [];
      if (Array.isArray(vehicles)) {
        vehicles.forEach(v => {
          if (v.node_id) {
            items.push({
              id: v.node_id,
              vehicle_plate: v.plate,
              last_seen: v.node_last_seen,
              signal: v.node_signal,
              lte: v.node_lte
            });
          }
        });
      }

      nodesCount.textContent = String(items.length);

      if (items.length === 0) {
        nodesList.appendChild(el('p', 'empty',
          'No nodes registered yet. Add a vehicle with a Node ID.'));
        return;
      }

      items.forEach(n => {
        const card = el('div', 'data-item');

        const left = el('div', 'data-item-left');
        left.appendChild(el('div', 'data-item-title', n.id));

        const sub = n.vehicle_plate ? `Vehicle ${n.vehicle_plate}` : 'Unassigned';
        left.appendChild(el('div', 'data-item-sub', sub));

        const right = el('div', 'data-item-right');

        let level = 'crit';
        if (n.last_seen) {
          const sec = (Date.now() - new Date(n.last_seen + 'Z').getTime()) / 1000;
          if (sec < 120) level = 'ok';
          else if (sec < 3600) level = 'warn';
          else level = 'crit';
        }

        const status = el('span', `node-status ${level}`);
        status.appendChild(el('span', 'dot'));
        status.appendChild(el('span', '',
          n.last_seen ? timeAgo(n.last_seen) : 'never seen'));
        right.appendChild(status);

        card.appendChild(left);
        card.appendChild(right);
        nodesList.appendChild(card);
      });
    } catch (err) {
      nodesList.innerHTML = '';
      nodesList.appendChild(el('p', 'empty', 'Failed to load nodes: ' + err.message));
    }
  }

  /* ============================================================
     Boot
     ============================================================ */

  requestAnimationFrame(() => {
    prefillProfile();
    loadNodes();
  });

  setInterval(loadNodes, 30000);
})();