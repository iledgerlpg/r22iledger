// Biarkan variabel global kosong dulu di atas
let _user = null; 
let allData = [];
let searchTimeout = null;
let activeRowData = null;
const avatarBg = ['#0D47A1','#1565C0','#0288D1','#00838F','#558B2F','#6A1B9A','#D84315','#37474F'];

document.addEventListener('DOMContentLoaded', () => {
  // Pake setTimeout 0 supaya script page-template selesai ngerender Nav Bar dulu
  setTimeout(() => {
    
    // 🔴 FIX CRITICAL: Isi dulu variabel _user-nya dari helper!
    try {
      _user = getUser(); 
    } catch (e) {
      console.error("Fungsi getUser() tidak ditemukan atau error:", e);
    }

    // Ambil role dengan aman
    const currentRole = (_user && _user.role) ? _user.role.toString().trim().toUpperCase() : '';

    if (currentRole !== 'HRD') {
      const mainContent = document.getElementById('mainContent');
      if (mainContent) {
        mainContent.innerHTML = `
          <div style="text-align:center;padding:60px;background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-color)">
            <h2 style="color:var(--text-primary)">Akses Ditolak</h2>
            <p style="color:var(--text-secondary);margin-top:8px;">Halaman manajemen karyawan hanya dapat diakses oleh HRD.</p>
            <div style="margin-top:20px;padding:10px;background:rgba(239,68,68,0.1);color:#ef4444;border-radius:6px;font-size:12px;display:inline-block;font-family:monospace;">
              Debug Frontend: Akun lu terbaca sebagai rolenya "${(_user && _user.role) || 'KOSONG/GAK ADA'}"
            </div>
          </div>`;
      }
      return;
    }
    
    // Kalau lolos proteksi, baru load data karyawan
    loadData();
  }, 0);
});;
async function loadData() {
  const res = await callAPI('getKaryawan', {
    search: document.getElementById('searchInput').value,
    status: document.getElementById('filterStatus').value
  });
  if (!res.success) { showToast('Gagal memuat data.','error'); return; }
  allData = res.data;
  document.getElementById('resultInfo').textContent = allData.length + ' karyawan';
  updateStats(allData);
  renderGrid(allData);
}

function updateStats(data) {
  const aktif = data.filter(d => d.status === 'ACTIVE').length;
  const nonaktif = data.filter(d => d.status !== 'ACTIVE').length;
  const totalGaji = data.filter(d => d.status === 'ACTIVE').reduce((s,d) => s + d.gaji, 0);
  document.getElementById('statTotal').textContent = data.length + ' orang';
  document.getElementById('statAktif').textContent = aktif + ' orang';
  document.getElementById('statNonaktif').textContent = nonaktif + ' orang';
  document.getElementById('statGaji').textContent = formatRupiah(totalGaji);
}

function renderGrid(data) {
  const container = document.getElementById('karyawanGrid');
  if (!data.length) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-secondary)"><h3 style="color:var(--text-primary)">Belum ada karyawan</h3><p style="margin-top:6px;font-size:13px">Klik "Tambah Karyawan" untuk mendaftarkan</p></div>';
    return;
  }
  container.innerHTML = data.map((k, i) => {
    const bg = avatarBg[i % avatarBg.length];
    const initials = k.nama.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    return `
    <div class="karyawan-card">
      <div class="karyawan-header-bar"></div>
      <div class="karyawan-body">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div class="karyawan-avatar" style="background:${bg}">${initials}</div>
          <div style="flex:1;min-width:0">
            <div class="karyawan-name">${k.nama}</div>
            <div class="karyawan-jabatan">${k.jabatan} · ${k.departemen}</div>
          </div>
          <span class="badge ${k.status === 'ACTIVE' ? 'badge-success' : 'badge-gray'}" style="flex-shrink:0">${k.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</span>
        </div>
        <div class="karyawan-details" style="margin-top:12px">
          <div class="kd-item"><div class="kd-label">NIK</div><div class="kd-value">${k.nik || '-'}</div></div>
          <div class="kd-item"><div class="kd-label">Masuk</div><div class="kd-value">${k.tanggalMasuk || '-'}</div></div>
          <div class="kd-item"><div class="kd-label">BPJS Kes</div><div class="kd-value">${k.noBPJSKES || '-'}</div></div>
          <div class="kd-item"><div class="kd-label">BPJS TK</div><div class="kd-value">${k.noBPJSTK || '-'}</div></div>
        </div>
      </div>
      <div class="karyawan-footer">
        <div class="gaji-display">${formatRupiah(k.gaji)}<span style="font-size:10px;font-weight:400;color:var(--text-secondary)">/bln</span></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm btn-icon" onclick='editRow(${JSON.stringify(k).replace(/'/g,"&#39;")})'>
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRow('${k.id}','${k.nama}')">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function saveData() {
  const id = document.getElementById('editId').value;
  const nik = document.getElementById('fNIK').value.trim();
  const nama = document.getElementById('fNama').value.trim();
  const jabatan = document.getElementById('fJabatan').value.trim();
  const gajiInput = document.getElementById('fGaji').value;

  if (!nik || !nama || !jabatan) { showToast('NIK, Nama, dan Jabatan wajib diisi.','error'); return; }

  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  // Logika Cerdas penentuan Tanggal Berlaku Gaji agar tidak merusak histori Laba Rugi
  let tanggalGajiBerlaku = document.getElementById('fTglMasuk').value; // Default data baru
  
  if (id && activeRowData) {
    // Jika gajinya sama (cuma edit profil biasa), kunci pakai tanggal lama agar data Riwayat_Gaji gak pindah bulan
    if (Number(gajiInput) === Number(activeRowData.gaji)) {
      tanggalGajiBerlaku = activeRowData.tanggalGajiBerlaku || formatDateToInput(activeRowData.tanggalMasuk);
    } else {
      // Jika memang gajinya diubah/naik, baru set berlaku per hari ini
      tanggalGajiBerlaku = new Date().toISOString().split('T')[0];
    }
  }

  const res = await callAPI(id ? 'updateKaryawan' : 'addKaryawan', {
    id, nik, namaKaryawan: nama,
    jenisKelamin: document.getElementById('fJK').value,
    noTelp: document.getElementById('fNoTelp').value,
    tempatLahir: document.getElementById('fTempatLahir').value,
    tanggalLahir: document.getElementById('fTglLahir').value,
    alamat: document.getElementById('fAlamat').value,
    jabatan, departemen: document.getElementById('fDepartemen').value,
    tanggalMasuk: document.getElementById('fTglMasuk').value,
    gaji: gajiInput,
    noBPJSKES: document.getElementById('fBPJSKES').value,
    noBPJSTK: document.getElementById('fBPJSTK').value,
    noRekening: document.getElementById('fNoRek').value,
    namaBank: document.getElementById('fNamaBank').value,
    status: id ? document.getElementById('fStatus').value : 'ACTIVE',
    tanggalKeluar: document.getElementById('fTglKeluar').value,
    tanggalGajiBerlaku: tanggalGajiBerlaku
  });

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';

  if (res.success) { showToast(res.message,'success'); closeModal('modalKaryawan'); resetForm(); loadData(); }
  else showToast(res.error,'error');
}

function editRow(row) {
  activeRowData = row; // FIX: Ikat data row ke variabel global saat modal edit dibuka
  
  document.getElementById('editId').value = row.id;
  document.getElementById('modalTitle').textContent = 'Edit Karyawan';
  document.getElementById('fNIK').value = row.nik;
  document.getElementById('fNama').value = row.nama;
  document.getElementById('fJK').value = row.jenisKelamin;
  document.getElementById('fNoTelp').value = row.noTelp || '';
  document.getElementById('fTempatLahir').value = row.tempatLahir || '';
  document.getElementById('fAlamat').value = row.alamat || '';
  document.getElementById('fJabatan').value = row.jabatan;
  document.getElementById('fDepartemen').value = row.departemen;
  document.getElementById('fGaji').value = row.gaji;
  document.getElementById('fBPJSKES').value = row.noBPJSKES || '';
  document.getElementById('fBPJSTK').value = row.noBPJSTK || '';
  document.getElementById('fNoRek').value = row.noRekening || '';
  document.getElementById('fNamaBank').value = row.namaBank || '';
  document.getElementById('fStatus').value = row.status;

  // Mapping format tanggal agar sukses masuk ke input HTML type="date"
  document.getElementById('fTglMasuk').value = formatDateToInput(row.tanggalMasuk);
  document.getElementById('fTglKeluar').value = formatDateToInput(row.tanggalKeluar);
  document.getElementById('fTglLahir').value = formatDateToInput(row.tanggalLahir);

  document.getElementById('editStatusField').style.display = 'block';
  openModal('modalKaryawan');
}

async function deleteRow(id, nama) {
  confirmAction(`Nonaktifkan karyawan "${nama}"?`, async () => {
    const res = await callAPI('deleteKaryawan', { id });
    if (res.success) { showToast('Karyawan dinonaktifkan.','success'); loadData(); }
    else showToast(res.error,'error');
  });
}

function resetForm() {
  activeRowData = null; // Reset data simpanan
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').textContent = 'Tambah Karyawan';
  document.getElementById('editStatusField').style.display = 'none';
  ['fNIK','fNama','fNoTelp','fTempatLahir','fAlamat','fJabatan','fGaji','fBPJSKES','fBPJSTK','fNoRek','fNamaBank','fTglLahir','fTglMasuk','fTglKeluar'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  document.getElementById('fJK').value = 'Laki-laki';
  document.getElementById('fDepartemen').value = 'Operasional';
}

function debounceSearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(loadData, 400); }

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Data Karyawan', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID') + ' (RAHASIA)', 14, 26);
  doc.autoTable({
    head: [['No','NIK','Nama','Jabatan','Dept','BPJS Kes','BPJS TK','Tgl Masuk','Gaji','Status']],
    body: allData.map((k,i) => [i+1, k.nik, k.nama, k.jabatan, k.departemen, k.noBPJSKES||'-', k.noBPJSTK||'-', k.tanggalMasuk||'-', formatRupiah(k.gaji), k.status]),
    startY: 32, styles:{fontSize:8}, headStyles:{fillColor:[13,71,161],textColor:255,fontStyle:'bold'}
  });
  doc.save('Karyawan_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.pdf');
}

/**
 * HELPER UTILITY: Mengonversi format tanggal string bawaan backend (misal DD/MM/YYYY)
 * menjadi YYYY-MM-DD standar agar diakui oleh form input date HTML5.
 */
function formatDateToInput(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) { // Format: DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else if (parts[0].length === 4) { // Format: YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
}
