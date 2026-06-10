let logPage = 1;

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupProfile();
  checkDarkMode();
});

function setupProfile() {
  document.getElementById('profileName').textContent = _user.name || '-';
  document.getElementById('profileEmail').textContent = _user.email || '-';
  document.getElementById('profileRole').textContent = _user.role || '-';
  document.getElementById('profileAvatar').textContent = (_user.name || '-').charAt(0).toUpperCase();
  document.getElementById('settNama').value = _user.name || '';
  document.getElementById('settEmail').value = _user.email || '';
}

async function loadSettings() {
  const res = await callAPI('getSettings', {});
  if (!res.success) return;
  const s = res.data;
  if (s.COMPANY_NAME) document.getElementById('sCompanyName').value = s.COMPANY_NAME;
  if (s.NOTIF_EMAIL) document.getElementById('sNotifEmail').value = s.NOTIF_EMAIL;
  if (s.TIMEZONE) document.getElementById('sTimezone').value = s.TIMEZONE;
  if (s.PAJAK_ALERT_ENABLED !== undefined) document.getElementById('sPajakAlert').checked = s.PAJAK_ALERT_ENABLED !== 'false';
  if (s.BBM_ALERT_ENABLED !== undefined) document.getElementById('sBBMAlert').checked = s.BBM_ALERT_ENABLED !== 'false';
  if (s.PERAWATAN_INTERVAL_KM) document.getElementById('sServiceKM').value = s.PERAWATAN_INTERVAL_KM;
  
  const companyNameEl = document.getElementById('companyName');
  if (companyNameEl && s.COMPANY_NAME) companyNameEl.textContent = s.COMPANY_NAME;
}

function switchPanel(panelId, btn) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
  btn.classList.add('active');
  if (panelId === 'panelLog') loadLog();
}

function handleDarkMode(checkbox) {
  document.documentElement.setAttribute('data-theme', checkbox.checked ? 'dark' : 'light');
  localStorage.setItem('il_theme', checkbox.checked ? 'dark' : 'light');
}

function checkDarkMode() {
  const theme = localStorage.getItem('il_theme') || 'light';
  document.getElementById('sDarkMode').checked = theme === 'dark';
}

async function saveProfile() {
  showToast('Profil disimpan.','success');
}

async function saveCompanySettings() {
  const res = await callAPI('updateSettings', {
    settings: {
      COMPANY_NAME: document.getElementById('sCompanyName').value,
      NOTIF_EMAIL: document.getElementById('sNotifEmail').value,
      TIMEZONE: document.getElementById('sTimezone').value
    }
  });
  if (res.success) showToast('Pengaturan perusahaan disimpan.','success');
  else showToast(res.error,'error');
}

async function saveNotifSettings() {
  const res = await callAPI('updateSettings', {
    settings: {
      PAJAK_ALERT_ENABLED: document.getElementById('sPajakAlert').checked ? 'true' : 'false',
      BBM_ALERT_ENABLED: document.getElementById('sBBMAlert').checked ? 'true' : 'false',
      PERAWATAN_INTERVAL_KM: document.getElementById('sServiceKM').value
    }
  });
  if (res.success) showToast('Pengaturan notifikasi disimpan.','success');
  else showToast(res.error,'error');
}

async function changePassword() {
  const old = document.getElementById('fOldPass').value;
  const nw = document.getElementById('fNewPass').value;
  const conf = document.getElementById('fConfPass').value;
  if (!old || !nw || !conf) { showToast('Semua field wajib diisi.','error'); return; }
  if (nw !== conf) { showToast('Konfirmasi password tidak cocok.','error'); return; }
  if (nw.length < 8) { showToast('Password minimal 8 karakter.','error'); return; }
  const res = await callAPI('changePassword', { oldPassword: old, newPassword: nw });
  if (res.success) {
    showToast('Password berhasil diubah.','success');
    ['fOldPass','fNewPass','fConfPass'].forEach(id => document.getElementById(id).value = '');
  } else showToast(res.error,'error');
}

async function loadLog() {
  const res = await callAPI('getActivityLog', {
    page: logPage,
    limit: 30,
    filterModule: document.getElementById('logModule').value
  });
  if (!res.success) return;
  
  const actionColors = { ADD: 'badge-success', UPDATE: 'badge-info', DELETE: 'badge-error', LOGIN: 'badge-gray', LOGOUT: 'badge-gray' };
  const tbody = document.getElementById('logBody');
  
  if (!res.data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary)">Belum ada log aktivitas</td></tr>';
    return;
  }
  
  tbody.innerHTML = res.data.map(l => `
    <tr>
      <td style="font-size:11px;white-space:nowrap">${l.tanggal}</td>
      <td style="font-size:12px">${(l.userEmail||'').split('@')[0]}</td>
      <td><span class="badge ${actionColors[l.aksi]||'badge-gray'}" style="font-size:10px">${l.aksi}</span></td>
      <td style="font-size:12px">${l.modul}</td>
      <td style="font-size:11px;color:var(--text-secondary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.dataBaru||l.dataLama||'-'}</td>
    </tr>`).join('');
  
  renderPagination('logPagination', logPage, res.totalPages, 'changeLogPage');
}

function changeLogPage(p) { logPage = p; loadLog(); }
</script>

<script>
document.addEventListener('DOMContentLoaded', () => initPage('settings'));
