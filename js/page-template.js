// ============================================================
// iLedgerV2 - Page Template Helper
// Digunakan di semua halaman selain login/register
// ============================================================

/**
 * Memuat navbar dan menginisialisasi halaman
 * Panggil di setiap halaman: initPage('nama-halaman')
 */
async function initPage(pageName) {
  // 1. Cek auth
  if (!requireAuth()) return;

  // 2. Apply theme
  applyTheme();

  // 3. Load navbar
  try {
    const res = await fetch('navbar.html');
    const html = await res.text();
    document.getElementById('navbarMount').innerHTML = html;

    // Eksekusi script dalam navbar
    document.querySelectorAll('#navbarMount script').forEach(s => {
      const ns = document.createElement('script');
      ns.textContent = s.textContent;
      document.body.appendChild(ns);
    });
  } catch (e) {
    console.warn('Navbar gagal dimuat:', e);
  }

  // 4. Set active nav item
  setTimeout(() => {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageName);
    });
  }, 100);
}
