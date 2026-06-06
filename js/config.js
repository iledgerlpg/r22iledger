// ============================================================
// iLedgerV2 - GitHub Pages Configuration
// ⚠️ GANTI APP_SCRIPT_URL dengan URL Apps Script kamu!
// ============================================================

const CONFIG = {
  // Ganti ini dengan URL deployment Apps Script kamu
  // Contoh: 'https://script.google.com/macros/s/AKfycbxXXXXXXX/exec'
  APP_SCRIPT_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_URL_KAMU/exec',

  APP_NAME: 'iLedgerV2',
  APP_VERSION: '2.0.0',
  SESSION_KEY: 'il_token',
  USER_KEY: 'il_user',
  THEME_KEY: 'il_theme',
};

// ============================================================
// API HELPER - Semua halaman pakai ini
// ============================================================
async function callAPI(action, payload = {}) {
  const token = localStorage.getItem(CONFIG.SESSION_KEY) || '';
  try {
    const res = await fetch(CONFIG.APP_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script butuh text/plain untuk avoid CORS preflight
      body: JSON.stringify({ action, token, ...payload })
    });
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, error: 'Gagal terhubung ke server. Periksa koneksi internet.' };
  }
}

// ============================================================
// SESSION HELPERS
// ============================================================
function getToken() { return localStorage.getItem(CONFIG.SESSION_KEY) || ''; }
function getUser() {
  try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || '{}'); }
  catch { return {}; }
}
function setSession(token, user) {
  localStorage.setItem(CONFIG.SESSION_KEY, token);
  localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(CONFIG.SESSION_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
}
function requireAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'login.html'; return false; }
  return true;
}

// ============================================================
// FORMAT HELPERS
// ============================================================
function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message, type = 'success', duration = 3500) {
  let tc = document.getElementById('toastContainer');
  if (!tc) {
    tc = document.createElement('div');
    tc.id = 'toastContainer';
    tc.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(tc);
  }
  const icons = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };
  const bg = { success:'#166534', error:'#991b1b', warning:'#92400e', info:'#1e40af' };
  const t = document.createElement('div');
  t.style.cssText = `padding:12px 18px;border-radius:10px;font-size:13px;font-weight:500;color:white;display:flex;align-items:center;gap:10px;min-width:260px;max-width:360px;pointer-events:all;box-shadow:0 8px 24px rgba(0,0,0,.2);background:${bg[type]||bg.info};animation:toastIn .3s ease;font-family:var(--font,'Plus Jakarta Sans',sans-serif)`;
  t.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="white" fill="none" stroke-width="2">${icons[type]||icons.info}</svg><span style="flex:1">${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:rgba(255,255,255,.7);font-size:16px;line-height:1;padding:0 0 0 6px">✕</button>`;
  tc.appendChild(t);
  setTimeout(() => t && t.parentElement && t.remove(), duration);
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('show'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('show'); document.body.style.overflow = ''; }
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function confirmAction(message, callback) {
  if (confirm(message)) callback();
}

// ============================================================
// THEME
// ============================================================
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(CONFIG.THEME_KEY, next);
}
function applyTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

// ============================================================
// SKELETON LOADING
// ============================================================
function showSkeleton(containerId, rows = 5, cols = 5) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array(rows).fill('').map(() =>
    `<tr>${Array(cols).fill('<td><div class="skeleton" style="height:15px;border-radius:4px"></div></td>').join('')}</tr>`
  ).join('');
}

// ============================================================
// PAGINATION
// ============================================================
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
  </button>`;

  const range = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) range.push(i);
  }

  let prev = null;
  range.forEach(p => {
    if (prev && p - prev > 1) html += '<span style="color:var(--gray-400,#94a3b8);padding:0 4px">...</span>';
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="${onPageChange}(${p})">${p}</button>`;
    prev = p;
  });

  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;

  el.innerHTML = html;
}

// ============================================================
// NAVIGATE
// ============================================================
function navigate(page) {
  window.location.href = page + '.html';
}

// Apply theme on load
applyTheme();

// Add toast animation CSS once
if (!document.getElementById('toastStyle')) {
  const s = document.createElement('style');
  s.id = 'toastStyle';
  s.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(s);
}
