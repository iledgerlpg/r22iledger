let logPage = 1;

// ✅ Satu DOMContentLoaded — tunggu config.js siap sebelum init
document.addEventListener('DOMContentLoaded', () => {
  checkDarkMode();
  waitForUser();
});

function waitForUser() {
  if (typeof getUser !== 'function') {
    setTimeout(waitForUser, 100);
    return;
  }
  const user = getUser();
  if (!user || !user.name) {
    setTimeout(waitForUser, 100);
    return;
  }
  initPage('settings');
  setupProfile();
  loadSettings();
}

function setupProfile() {
  const user = getUser();
  document.getElementById('profileName').textContent    = user.name  || '-';
  document.getElementById('profileEmail').textContent   = user.email || '-';
  document.getElementById('profileRole').textContent    = user.role  || '-';
  document.getElementById('profileAvatar').textContent  = (user.name || '-').charAt(0).toUpperCase();
  document.getElementById('settNama').value             = user.name  || '';
  document.getElementById('settEmail').value            = user.email || '';
}

async function loadSettings() {
  const res = await callAPI('getSettings', {});
  if (!res.success) return;
  const s = res.data;

  if (s.COMPANY_NAME)                  document.getElementById('sCompanyName').value  = s.COMPANY_NAME;
  if (s.NOTIF_EMAIL)                   document.getElementById('sNotifEmail').value   = s.NOTIF_EMAIL;
  if (s.TIMEZONE)                      document.getElementById('sTimezone').value      = s.TIMEZONE;
  if (s.PAJAK_ALERT_ENABLED !== undefined)
    document.getElementById('sPajakAlert').checked = s.PAJAK_ALERT_ENABLED !== 'false';
  if (s.BBM_ALERT_ENABLED !== undefined)
    document.getElementById('sBBMAlert').checked   = s.BBM_ALERT_ENABLED   !== 'false';
  if (s.PERAWATAN_INTERVAL_KM)         document.getElementById('sServiceKM').value     = s.PERAWATAN_INTERVAL_KM;

  // Update nama perusahaan di header & brand sidebar jika ada
  const brandEl  = document.getElementById('brandCompanyName');
  const headerEl = document.getElementById('headerCompanyName');
  if (brandEl  && s.COMPANY_NAME) brandEl.textContent  = s.COMPANY_NAME;
  if (headerEl && s.COMPANY_NAME) headerEl.textContent = s.COMPANY_NAME;
}

function switchPanel(panelId, btn) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
  btn.classList.add('active');
  if (panelId === 'panelLog') { logPage = 1; loadLog(); }
}

// ─── Tampilan ────────────────────────────────────────────────────────────────

function handleDarkMode(checkbox) {
  const theme = checkbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('il_theme', theme);
}

function checkDarkMode() {
  const theme = localStorage.getItem('il_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme); // ✅ terapkan saat load
  document.getElementById('sDarkMode').checked = theme === 'dark';
}

// ─── Profil ───────────────────────────────────────────────────────────────────

async function saveProfile() {
  const nama = document.getElementById('settNama').value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong.', 'error'); return; }

  const res = await callAPI('updateProfile', { name: nama });
  if (res.success) {
    // Update cache lokal via getUser jika tersedia
    const user = getUser();
    if (user) user.name = nama;

    // Update tampilan di halaman settings
    document.getElementById('profileName').textContent   = nama;
    document.getElementById('profileAvatar').textContent = nama.charAt(0).toUpperCase();

    // Update navbar sidebar jika sudah di-mount
    const navName   = document.getElementById('navUserName');
    const navAvatar = document.getElementById('navUserAvatar');
    if (navName)   navName.textContent   = nama;
    if (navAvatar) navAvatar.textContent = nama.charAt(0).toUpperCase();

    showToast('Profil berhasil disimpan.', 'success');
  } else {
    showToast(res.error || 'Gagal menyimpan profil.', 'error');
  }
}

// ─── Perusahaan ───────────────────────────────────────────────────────────────

async function saveCompanySettings() {
  const res = await callAPI('updateSettings', {
    settings: {
      COMPANY_NAME: document.getElementById('sCompanyName').value.trim(),
      NOTIF_EMAIL:  document.getElementById('sNotifEmail').value.trim(),
      TIMEZONE:     document.getElementById('sTimezone').value
    }
  });
  if (res.success) {
    // Update brand sidebar & header secara langsung tanpa reload
    const newName  = document.getElementById('sCompanyName').value.trim();
    const brandEl  = document.getElementById('brandCompanyName');
    const headerEl = document.getElementById('headerCompanyName');
    if (brandEl  && newName) brandEl.textContent  = newName;
    if (headerEl && newName) headerEl.textContent = newName;
    showToast('Pengaturan perusahaan disimpan.', 'success');
  } else {
    showToast(res.error || 'Gagal menyimpan pengaturan.', 'error');
  }
}

// ─── Notifikasi ───────────────────────────────────────────────────────────────

async function saveNotifSettings() {
  const res = await callAPI('updateSettings', {
    settings: {
      PAJAK_ALERT_ENABLED:   document.getElementById('sPajakAlert').checked ? 'true' : 'false',
      BBM_ALERT_ENABLED:     document.getElementById('sBBMAlert').checked   ? 'true' : 'false',
      PERAWATAN_INTERVAL_KM: document.getElementById('sServiceKM').value
    }
  });
  if (res.success) showToast('Pengaturan notifikasi disimpan.', 'success');
  else             showToast(res.error || 'Gagal menyimpan notifikasi.', 'error');
}

// ─── Keamanan ─────────────────────────────────────────────────────────────────

async function changePassword() {
  const old  = document.getElementById('fOldPass').value;
  const nw   = document.getElementById('fNewPass').value;
  const conf = document.getElementById('fConfPass').value;

  if (!old || !nw || !conf) { showToast('Semua field wajib diisi.', 'error'); return; }
  if (nw !== conf)           { showToast('Konfirmasi password tidak cocok.', 'error'); return; }
  if (nw.length < 8)         { showToast('Password minimal 8 karakter.', 'error'); return; }

  const res = await callAPI('changePassword', { oldPassword: old, newPassword: nw });
  if (res.success) {
    showToast('Password berhasil diubah.', 'success');
    ['fOldPass', 'fNewPass', 'fConfPass'].forEach(id => document.getElementById(id).value = '');
  } else {
    showToast(res.error || 'Gagal mengganti password.', 'error');
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

async function loadLog() {
  const res = await callAPI('getActivityLog', {
    page:         logPage,
    limit:        30,
    filterModule: document.getElementById('logModule').value,
    search:       document.getElementById('logSearch').value.trim() // ✅ search dikirim ke API
  });
  if (!res.success) return;

  const actionColors = {
    ADD:    'badge-success',
    UPDATE: 'badge-info',
    DELETE: 'badge-error',
    LOGIN:  'badge-gray',
    LOGOUT: 'badge-gray'
  };

  const tbody = document.getElementById('logBody');

  if (!res.data || !res.data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary)">
          Belum ada log aktivitas
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(l => `
    <tr>
      <td style="font-size:11px;white-space:nowrap">${l.tanggal}</td>
      <td style="font-size:12px">${(l.userEmail || '').split('@')[0]}</td>
      <td><span class="badge ${actionColors[l.aksi] || 'badge-gray'}" style="font-size:10px">${l.aksi}</span></td>
      <td style="font-size:12px">${l.modul}</td>
      <td style="font-size:11px;color:var(--text-secondary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.dataBaru || l.dataLama || ''}">${l.dataBaru || l.dataLama || '-'}</td>
    </tr>
  `).join('');

  renderPagination('logPagination', logPage, res.totalPages, 'changeLogPage');
}

function changeLogPage(p) {
  logPage = p;
  loadLog();
}
