
let allUsers = [];
const avatarBg = ['#0D47A1','#1565C0','#0288D1','#00838F','#6A1B9A','#D84315'];

document.addEventListener('DOMContentLoaded', () => {
  if (_user.role !== 'HRD') {
    document.querySelector('.main-content').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-secondary)"><h2>Akses Ditolak</h2><p>Halaman ini hanya untuk HRD.</p></div>';
    return;
  }
  loadData();
});

async function loadData() {
  const res = await callAPI('getUsers', {});
  if (!res.success) { showToast('Gagal memuat data.','error'); return; }
  allUsers = res.data;
  const pending = allUsers.filter(u => u.status === 'PENDING').length;
  if (pending > 0) {
    document.getElementById('pendingBanner').style.display = 'flex';
    document.getElementById('pendingCount').textContent = pending;
    const badge = document.getElementById('pendingBadge');
    if (badge) { badge.style.display = 'inline'; badge.textContent = pending; }
  }
  filterUsers();
}

function filterUsers() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const st = document.getElementById('filterStatus').value;
  const filtered = allUsers.filter(u => {
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchS = !st || u.status === st;
    return matchQ && matchS;
  });
  renderUsers(filtered);
}

function renderUsers(data) {
  const container = document.getElementById('usersGrid');
  if (!data.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-color)">Tidak ada pengguna ditemukan.</div>';
    return;
  }
  container.innerHTML = data.map((u, i) => {
    const initials = u.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const bg = avatarBg[i % avatarBg.length];
    const statusBadge = {
      ACTIVE: 'badge-success', PENDING: 'badge-warning',
      REJECTED: 'badge-error', INACTIVE: 'badge-gray'
    }[u.status] || 'badge-gray';
    const statusLabel = { ACTIVE:'Aktif', PENDING:'Menunggu', REJECTED:'Ditolak', INACTIVE:'Nonaktif' }[u.status] || u.status;
    const roleBadge = u.role === 'HRD' ? 'badge-info' : 'badge-gray';

    const actions = u.status === 'PENDING' ? `
      <button class="btn btn-success btn-sm" onclick="approveUser('${u.userId}')">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Setujui
      </button>
      <button class="btn btn-danger btn-sm" onclick="openRejectModal('${u.userId}')">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Tolak
      </button>` : u.userId !== _user.userId ? `
      <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.userId}','${u.name}')">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        Hapus
      </button>` : '<span style="font-size:11px;color:var(--text-secondary)">Akun Anda</span>';

    return `
    <div class="user-card">
      <div class="user-avatar-lg" style="background:${bg}">${initials}</div>
      <div class="user-info-main">
        <div class="user-name-lg">${u.name}</div>
        <div class="user-email-lg">${u.email}</div>
        <div class="user-meta">
          <span class="badge ${statusBadge}">${statusLabel}</span>
          <span class="badge ${roleBadge}">${u.role}</span>
          ${u.lastLogin ? `<span style="font-size:11px;color:var(--text-secondary)">Login: ${u.lastLogin.split(' ')[0]}</span>` : ''}
          ${u.createdAt ? `<span style="font-size:11px;color:var(--text-secondary)">Daftar: ${u.createdAt.split(' ')[0]}</span>` : ''}
        </div>
      </div>
      <div class="user-actions">${actions}</div>
    </div>`;
  }).join('');
}

async function approveUser(userId) {
  const res = await callAPI('approveUser', { userId });
  if (res.success) { showToast('Pengguna berhasil disetujui.','success'); loadData(); }
  else showToast(res.error,'error');
}

function openRejectModal(userId) {
  document.getElementById('rejectUserId').value = userId;
  document.getElementById('rejectReason').value = '';
  openModal('modalReject');
}

async function confirmReject() {
  const userId = document.getElementById('rejectUserId').value;
  const reason = document.getElementById('rejectReason').value;
  const res = await callAPI('rejectUser', { userId, reason });
  if (res.success) { showToast('Pengguna ditolak.','success'); closeModal('modalReject'); loadData(); }
  else showToast(res.error,'error');
}

async function deleteUser(userId, nama) {
  confirmAction(`Hapus pengguna "${nama}"? Tindakan ini tidak dapat dibatalkan.`, async () => {
    const res = await callAPI('deleteUser', { userId });
    if (res.success) { showToast('Pengguna dihapus.','success'); loadData(); }
    else showToast(res.error,'error');
  });
}


<script>
document.addEventListener('DOMContentLoaded', () => initPage('userManagement'));
</script>
