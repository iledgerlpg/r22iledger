
// ============================================================
// STATE
// ============================================================
let pg = 1, totalPg = 1;
let allPos = [], allKaryawan = [], allArmada = [], allMappings = [];
let notaB64 = null, notaMime = null, buktiB64 = null, buktiMime = null;
let searchTimeout = null, uraianDebounce = null;
let camStream = null, camTarget = null, facingMode = 'environment'; // environment = belakang
let selectedPosId = null, selectedPosName = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initPage('pengeluaran');
  setDefaultDT();
  await Promise.all([loadPos(), loadKaryawan(), loadArmada(), loadMappings()]);
  loadData();

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('#uraianWrap')) hidePosDropdown();
    if (!e.target.closest('#namaWrap')) hideNamaDropdown();
  });
});

function setDefaultDT() {
  const now = new Date(), p = n => String(n).padStart(2,'0');
  document.getElementById('fTimestamp').value =
    `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
  document.getElementById('filterMonth').value =
    `${now.getFullYear()}-${p(now.getMonth()+1)}`;
}

function cleanImageUrl(url) {
    if (!url) return '';
    
    // Jika sudah format direct link, biarkan saja
    if (url.includes('uc?export=view')) return url;
    
    // Jika format lama, baru kita konversi
    if (url.includes('drive.google.com')) {
        return url.replace('/view?usp=sharing', '/uc?export=view')
                  .replace('/file/d/', '/uc?id=')
                  .replace('/view', '');
    }
    return url;
}
function extractFileId(url) {
    if (!url) return null;
    const directId = url.match(/id=([A-Za-z0-9_-]+)/);
    const fileId = url.match(/\/d\/([A-Za-z0-9_-]+)/);
    return directId ? directId[1] : (fileId ? fileId[1] : null);
}

function renderThumb(url) {
    const id = extractFileId(url);
    if (!id) return '-';
    // Link thumbnail untuk preview, Link uc?export=view untuk full image
    const thumbUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w300`;
    const fullUrl = `https://drive.google.com/uc?export=view&id=${id}`;
    
    return `<a href="${fullUrl}" target="_blank" class="hover:opacity-80 transition">
                <img src="${thumbUrl}" class="h-12 w-12 object-cover rounded shadow mx-auto border border-gray-200" loading="lazy" />
            </a>`;
}





// ============================================================
// LOAD DATA SOURCES
// ============================================================
async function loadPos() {
  const r = await callAPI('getPos', { status: 'ACTIVE' });
  if (!r.success) return;
  allPos = r.data;
  
  // Populate filter select di halaman depan
const fs = document.getElementById('filterPos');
  if (fs) {
    fs.innerHTML = '<option value="">Semua Pos</option>'; 
    allPos.forEach(p => {
      fs.innerHTML += `<option value="${p.namaPos}">${p.namaPos}</option>`;
    });
  }
  
  // NOTE: Kode fPosVisible dihapus karena input Pos di Modal 
  // sekarang pakai sistem hidden input (fPosId) & auto-detect.
}

async function loadMappings() {
  const r = await callAPI('getPosMapping', {});
  if (!r.success) return;
  allMappings = r.data; // Format: [{keyword, idPos, namaPos}]
}

async function loadKaryawan() {
  const r = await callAPI('getKaryawan', {
    status: 'ACTIVE',
    fieldsOnly: 'nama,jabatan'  // ← wajib ada agar ADMIN diizinkan
  });
  allKaryawan = r.success ? r.data : [];
}
async function loadArmada() {
  const r = await callAPI('getArmada', { status: 'ACTIVE' });
  if (!r.success) return;
  allArmada = r.data;
  
  ['fArmada', 'fArmadaPrw', 'fArmadaPajak'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    // Reset default option dulu biar armada yang di-load gak duplikat
    sel.innerHTML = '<option value="">-- Pilih Armada --</option>';
    
    allArmada.forEach(a => {
      sel.innerHTML += `<option value="${a.id}" data-nopol="${a.noPolisi}">${a.noPolisi} – ${a.merk}</option>`;
    });
  });
}

// ============================================================
// LOAD TABLE DATA
// ============================================================
async function loadData() {
  showSkeleton('tableBody', 5, 9);
  const r = await callAPI('getPengeluaran', {
    page: pg, limit: document.getElementById('limitSelect').value,
    search: document.getElementById('searchInput').value,
    filterPos: document.getElementById('filterPos').value,
    filterMonth: document.getElementById('filterMonth').value
  });
  if (!r.success) { showToast('Gagal memuat data.', 'error'); return; }
  totalPg = r.totalPages || 1;
  document.getElementById('resultInfo').textContent = r.total + ' data';
  document.getElementById('pageInfo').textContent = `Hal ${r.page} dari ${totalPg}`;
  r.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  renderTable(r.data, r.page, parseInt(document.getElementById('limitSelect').value));
  renderPagination('paginationContainer', pg, totalPg, 'changePage');
  updateSummary(r.data);
}

function updateSummary(data) {
  const total = data.reduce((s,r) => s+r.nominal, 0);
  const max   = data.length ? Math.max(...data.map(r => r.nominal)) : 0;
  document.getElementById('sumTotal').textContent = formatRupiah(total);
  document.getElementById('sumCount').textContent = data.length + ' transaksi';
  document.getElementById('sumAvg').textContent   = formatRupiah(data.length ? Math.round(total/data.length) : 0);
  document.getElementById('sumMax').textContent   = formatRupiah(max);
}

function renderTable(data, page, limit) {
  const tbody = document.getElementById('tableBody');
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
      <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
      <h3>Belum ada pengeluaran</h3><p>Klik "Tambah Pengeluaran" untuk mencatat</p>
    </div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = data.map((r, i) => {
    const no = (page - 1) * limit + i + 1;
    
    // --- 1. HANDLING FOTO NOTA ---
    let nota = `<div class="no-nota"><svg viewBox="0 0 24 24" width="13" height="13" stroke="var(--gray-400)" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/></svg></div>`;
    if (r.fotoNotaURL) {
      const idNota = extractFileId(r.fotoNotaURL);
      
      // PERUBAHAN DI SINI: Pakai thumbnail sz=w1200 untuk Lightbox, sz=w300 untuk tabel
      const fullNota = idNota ? `https://drive.google.com/thumbnail?id=${idNota}&sz=w1200` : r.fotoNotaURL;
      const thumbNota = idNota ? `https://drive.google.com/thumbnail?id=${idNota}&sz=w300` : r.fotoNotaURL;
      
      nota = `<img class="nota-thumb clickable-preview cursor-pointer hover:opacity-80 transition" src="${thumbNota}" data-click-url="${fullNota}" loading="lazy" title="Lihat Nota">`;
    }

    // --- 2. HANDLING BUKTI TRANSFER ---
    let buktiTf = `<div class="no-nota"><svg viewBox="0 0 24 24" width="13" height="13" stroke="var(--gray-400)" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/></svg></div>`;
    if (r.buktiTransferURL) {
      const idBukti = extractFileId(r.buktiTransferURL);
      
      // PERUBAHAN DI SINI: Pakai thumbnail sz=w1200 untuk Lightbox, sz=w300 untuk tabel
      const fullBukti = idBukti ? `https://drive.google.com/thumbnail?id=${idBukti}&sz=w1200` : r.buktiTransferURL;
      const thumbBukti = idBukti ? `https://drive.google.com/thumbnail?id=${idBukti}&sz=w300` : r.buktiTransferURL;
      
      buktiTf = `<img class="nota-thumb clickable-preview cursor-pointer hover:opacity-80 transition" src="${thumbBukti}" data-click-url="${fullBukti}" loading="lazy" title="Lihat Bukti Transfer">`;
    }

    return `<tr>
      <td style="font-weight:600;color:var(--text-secondary)">${no}</td>
      <td style="font-size:12px;white-space:nowrap">${r.timestamp}</td>
      <td style="font-weight:500;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.nama}">${r.nama}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px" title="${r.uraian}">${r.uraian}</td>
      <td><span class="badge badge-info">${r.namaPos||'-'}</span></td>
      <td style="font-weight:700;white-space:nowrap">${formatRupiah(r.nominal)}</td>
      <td><span class="badge ${r.metodePembayaran==='Tunai'?'badge-success':'badge-gray'}">${r.metodePembayaran}</span></td>
      <td>${nota}</td>
      <td>${buktiTf}</td>
      <td><div style="display:flex;gap:5px">
        <button class="btn btn-outline btn-sm btn-icon" onclick='editRow(${JSON.stringify(r).replace(/'/g,"&#39;")})'>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="delRow('${r.id}','${r.uraian}')">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');

  // --- EVENT BINDING UNTUK LIGHTBOX ---
  tbody.querySelectorAll('.clickable-preview').forEach(img => {
    img.addEventListener('click', function() {
      const targetUrl = this.getAttribute('data-click-url');
      if (targetUrl) {
        openLB(targetUrl);
      }
    });
  });
}
function changePage(p) { pg = p; loadData(); window.scrollTo({top:0,behavior:'smooth'}); }
function debounceSearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { pg=1; loadData(); }, 400); }

// ============================================================
// NAMA DROPDOWN — Karyawan + Custom
// ============================================================
let namaMode = 'dropdown'; // 'dropdown' | 'custom'

function onNamaInput(val) {
  if (namaMode === 'custom') return; // ketik bebas
  showNamaDropdown(val);
}

function showNamaDropdown(filter = '') {
  const dd = document.getElementById('namaDropdown');
  const q  = filter.toLowerCase();

  const filtered = allKaryawan.filter(k =>
    !q || k.nama.toLowerCase().includes(q) || (k.jabatan||'').toLowerCase().includes(q)
  ).slice(0, 8);

  const colors = ['#0D47A1','#1565C0','#0288D1','#00838F','#558B2F','#6A1B9A'];
  let html = filtered.map((k, i) => {
    const initials = k.nama.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
    return `<div class="dd-item" onclick="selectNama('${k.nama.replace(/'/g,"\\'")}')" >
      <div class="dd-avatar" style="background:${colors[i%colors.length]}">${initials}</div>
      <div class="dd-label">
        <div style="font-weight:600;color:var(--text-primary)">${k.nama}</div>
        <div class="dd-sub">${k.jabatan||''}</div>
      </div>
    </div>`;
  }).join('');

  // Custom option
  html += `<div class="dd-item dd-custom" onclick="enableCustomNama()">
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Ketik nama lainnya (supplier/vendor)
  </div>`;

  if (!filtered.length && !q) {
    html = `<div class="dd-item dd-custom" onclick="enableCustomNama()">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Ketik nama supplier/vendor/lainnya
    </div>`;
  }

  dd.innerHTML = html;
  dd.classList.add('show');
}

function selectNama(nama) {
  document.getElementById('fNama').value = nama;
  namaMode = 'dropdown';
  document.getElementById('namaIsCustom').style.display = 'none';
  hideNamaDropdown();
}

function enableCustomNama() {
  namaMode = 'custom';
  const input = document.getElementById('fNama');
  input.value = '';
  input.placeholder = 'Ketik nama supplier/vendor...';
  input.focus();
  document.getElementById('namaIsCustom').style.display = 'block';
  hideNamaDropdown();
}

function hideNamaDropdown() {
  document.getElementById('namaDropdown').classList.remove('show');
}

// ============================================================
// URAIAN — Pos Keyword Dropdown
// ============================================================
function onUraianInput(val) {
  clearTimeout(uraianDebounce);
  uraianDebounce = setTimeout(() => {
    if (!val || val.length < 2) { hidePosDropdown(); return; }
    showPosDropdown(val);
    // Juga auto-detect lewat API
    autoDetectPos(val);
  }, 300);
}

function showPosDropdown(query) {
  const q = query.toLowerCase();
  // Filter allMappings yang keyword-nya ada di uraian
  const matched = allMappings.filter(m => q.includes(m.keyword.toLowerCase()));
  // Juga tampilkan semua pos sebagai fallback (tapi yang match duluan)
  const unmatchedPos = allPos.filter(p => !matched.find(m => m.idPos === p.id));

  const itemsEl = document.getElementById('posDropdownItems');
  let html = '';

  if (matched.length) {
    matched.forEach(m => {
      html += `<div class="pos-dd-item highlight" onclick="selectPos('${m.idPos}','${m.namaPos.replace(/'/g,"\\'")}')">
        <span class="pos-dd-keyword">${m.keyword}</span>
        <div>
          <div class="pos-dd-name">${m.namaPos}</div>
        </div>
        <span class="pos-dd-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
      </div>`;
    });
  }

  // Tampilkan pos lain yang tidak match
  if (!matched.length) {
    allPos.slice(0,6).forEach(p => {
      html += `<div class="pos-dd-item" onclick="selectPos('${p.id}','${p.namaPos.replace(/'/g,"\\'")}')">
        <div>
          <div class="pos-dd-name">${p.namaPos}</div>
          <div class="pos-dd-cat">${p.kategori||''}</div>
        </div>
      </div>`;
    });
  }

  if (!html) { hidePosDropdown(); return; }
  itemsEl.innerHTML = html;
  document.getElementById('posDropdown').classList.add('show');
}

function hidePosDropdown() {
  document.getElementById('posDropdown').classList.remove('show');
}

async function autoDetectPos(uraian) {
  const r = await callAPI('detectPos', { uraian });
  if (r.success && r.data && !selectedPosId) {
    // Auto-set pos jika belum dipilih
    selectPos(r.data.idPos, r.data.namaPos);
  }
}

function selectPos(idPos, namaPos) {
  selectedPosId = idPos;
  selectedPosName = namaPos;
  document.getElementById('fPosId').value = idPos;
  document.getElementById('posChipName').textContent = namaPos;
  document.getElementById('posSelectedBox').style.display = 'block';
  document.getElementById('posManualBox').style.display = 'none';
  hidePosDropdown();
  handlePosExtras(namaPos);
}
function clearPos() {
  selectedPosId = null; selectedPosName = null;
  document.getElementById('fPosId').value = '';
  document.getElementById('posSelectedBox').style.display = 'none';
  document.getElementById('posManualBox').style.display = 'block';
  ['bbmExtra','perawatanExtra','pajakExtra'].forEach(id => {
    document.getElementById(id).classList.remove('show');
  });
  // Reset pajak checkboxes
  ['cbSTNK','cbKIR','cbPajak'].forEach(id => { const el = document.getElementById(id); if(el) el.checked = false; });
  ['fieldSTNK','fieldKIR','fieldPajak'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display='none'; });
  ['fTglSTNK','fTglKIR','fTglPajak','fPrwKet','fNextService'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('pajakCurrentStatus').style.display = 'none';
  document.getElementById('fArmadaPajak').value = '';
  
}



function handlePosExtras(name) {
  const n = name.toLowerCase();

  const isBBM   = n.includes('bbm');
  const isPrw   = n.includes('perawatan');
  const isPajak = n.includes('pajak');

  document.getElementById('bbmExtra').classList.toggle('show', isBBM);
  document.getElementById('perawatanExtra').classList.toggle('show', isPrw);
  document.getElementById('pajakExtra').classList.toggle('show', isPajak);
}

function calcBBM() {
  const l = parseFloat(document.getElementById('fLiter').value)||0;
  const h = parseFloat(document.getElementById('fHargaL').value)||0;
  if (l*h > 0) { document.getElementById('fNominal').value = l*h; showNominalPreview(); }
}

function showNominalPreview() {
  const v = parseFloat(document.getElementById('fNominal').value)||0;
  const el = document.getElementById('nominalPreview');
  el.style.display = v > 0 ? 'block' : 'none';
  el.textContent = formatRupiah(v);
}

// ============================================================
// FILE UPLOAD — Gallery
// ============================================================
function handleFile(e, type) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 10*1024*1024) { showToast('File terlalu besar (max 10MB).','error'); return; }
  processImageFile(file, type);
}

function processImageFile(file, type) {
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    const b64 = src.split(',')[1];
    const mime = file.type || 'image/jpeg';
    setMediaPreview(type, src, b64, mime);
  };
  reader.readAsDataURL(file);
}

function setMediaPreview(type, src, b64, mime) {
  if (type === 'nota') {
    notaB64 = b64; notaMime = mime;
    document.getElementById('previewNotaImg').src = src;
    document.getElementById('previewNota').style.display = 'block';
    document.getElementById('notaBtns').style.display = 'none';
  } else {
    buktiB64 = b64; buktiMime = mime;
    document.getElementById('previewBuktiImg').src = src;
    document.getElementById('previewBukti').style.display = 'block';
    document.getElementById('buktiBtns').style.display = 'none';
  }
}

function removeFile(type) {
  if (type === 'nota') {
    notaB64 = null; notaMime = null;
    document.getElementById('previewNota').style.display = 'none';
    document.getElementById('notaBtns').style.display = 'flex';
    document.getElementById('notaFileInput').value = '';
  } else {
    buktiB64 = null; buktiMime = null;
    document.getElementById('previewBukti').style.display = 'none';
    document.getElementById('buktiBtns').style.display = 'flex';
    document.getElementById('buktiFileInput').value = '';
  }
}

function retakePhoto(type) {
  removeFile(type);
}

// ============================================================
// KAMERA
// ============================================================
async function openCamera(target) {
  camTarget = target;
  document.getElementById('camTitle').textContent = target === 'nota' ? '📸 Ambil Foto Nota' : '📸 Ambil Foto Bukti Transfer';
  document.getElementById('camError').style.display = 'none';
  document.getElementById('camModal').classList.add('show');

  await startCamera();
}

async function startCamera() {
  // Stop existing stream
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }

  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    const video = document.getElementById('camVideo');
    video.srcObject = camStream;
    await video.play();
    document.getElementById('camError').style.display = 'none';
  } catch (err) {
    console.error('Camera error:', err);
    const errEl = document.getElementById('camError');
    if (err.name === 'NotAllowedError') {
      errEl.textContent = '⛔ Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.';
    } else if (err.name === 'NotFoundError') {
      errEl.textContent = '📷 Kamera tidak ditemukan di perangkat ini.';
    } else {
      errEl.textContent = '❌ Gagal membuka kamera: ' + err.message;
    }
    errEl.style.display = 'block';
  }
}

async function flipCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
}

function capturePhoto() {
  const video   = document.getElementById('camVideo');
  const canvas  = document.getElementById('camCanvas');
  if (!camStream || !video.videoWidth) {
    showToast('Kamera belum siap.', 'warning'); return;
  }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const src  = canvas.toDataURL('image/jpeg', 0.92);
  const b64  = src.split(',')[1];
  const mime = 'image/jpeg';

  setMediaPreview(camTarget, src, b64, mime);
  closeCamera();
  showToast('Foto berhasil diambil!', 'success', 2000);
}

function closeCamera() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  document.getElementById('camModal').classList.remove('show');
  camTarget = null;
}

// ============================================================
// SAVE / EDIT / DELETE
// ============================================================

function editRow(row) {
  document.getElementById('editId').value = row.id;
  document.getElementById('modalTitle').textContent = 'Edit Pengeluaran';
  document.getElementById('fTimestamp').value = row.timestamp ? row.timestamp.replace(' ','T').substring(0,16) : '';
  // Set nama
  namaMode = 'custom';
  document.getElementById('fNama').value = row.nama;
  document.getElementById('namaIsCustom').style.display = 'block';
  document.getElementById('fUraian').value = row.uraian;
  document.getElementById('fNominal').value = row.nominal;
  document.getElementById('fMetode').value = row.metodePembayaran || 'Tunai';
  // Set pos
  if (row.idPos) selectPos(row.idPos, row.namaPos);
  showNominalPreview();
  openModal('modalAdd');
}

async function delRow(id, uraian) {
  confirmAction(`Hapus pengeluaran "${uraian}"?`, async () => {
    const r = await callAPI('deletePengeluaran', { id });
    if (r.success) { showToast('Pengeluaran dihapus.','success'); loadData(); }
    else showToast(r.error,'error');
  });
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').textContent = 'Tambah Pengeluaran';
  ['fNama','fUraian','fNominal','fLiter','fHargaL'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('fMetode').value = 'Tunai';
  ['bbmExtra','perawatanExtra','pajakExtra'].forEach(id => {
    document.getElementById(id).classList.remove('show');
  });
  // Reset pajak checkboxes
  ['cbSTNK','cbKIR','cbPajak'].forEach(id => { const el = document.getElementById(id); if(el) el.checked = false; });
  ['fieldSTNK','fieldKIR','fieldPajak'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display='none'; });
  ['fTglSTNK','fTglKIR','fTglPajak','fPrwKet','fNextService'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('pajakCurrentStatus').style.display = 'none';
  document.getElementById('fArmadaPajak').value = '';
  
  document.getElementById('nominalPreview').style.display = 'none';
  namaMode = 'dropdown';
  document.getElementById('namaIsCustom').style.display = 'none';
  document.getElementById('fNama').placeholder = 'Pilih karyawan atau ketik nama supplier...';
  clearPos();
  // Reset harga BBM note
  currentRefHarga = 0;
  const jenisBBM = document.getElementById('fJenisBBM');
  if (jenisBBM) jenisBBM.value = '';
  const hargaNote = document.getElementById('bbmHargaNote');
  if (hargaNote) { hargaNote.textContent = '← Pilih jenis BBM, harga referensi Pertamina terisi otomatis'; hargaNote.style.color='var(--text-secondary)'; }
  const refChip = document.getElementById('bbmRefChip');
  if (refChip) refChip.style.display = 'none';
  const resetBtn = document.getElementById('btnResetHarga');
  if (resetBtn) resetBtn.style.display = 'none';
  const summary = document.getElementById('bbmSummary');
  if (summary) summary.style.display = 'none';
  removeFile('nota'); removeFile('bukti');
  setDefaultDT();
}

// ============================================================
// LIGHTBOX
// ============================================================
function openLB(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightbox').classList.add('show');
}

// ============================================================
// EXPORT PDF
// ============================================================
function exportPDF() {
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'landscape'});
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Laporan Pengeluaran', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: '+new Date().toLocaleString('id-ID'), 14, 26);
  const rows = [];
  document.querySelectorAll('#tableBody tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 7) rows.push([tds[0].textContent,tds[1].textContent,tds[2].textContent,tds[3].textContent,tds[4].textContent,tds[5].textContent,tds[6].textContent]);
  });
  doc.autoTable({
    head:[['No','Tanggal','Nama','Uraian','Pos','Nominal','Metode']],
    body: rows, startY:32, styles:{fontSize:9},
    headStyles:{fillColor:[13,71,161],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,249,255]}
  });
  doc.save('Pengeluaran_'+new Date().toLocaleDateString('id-ID').replace(/\//g,'-')+'.pdf');
}

// ============================================================
// BBM CALC
// ============================================================
function calcBBM() {
  const l = parseFloat(document.getElementById('fLiter').value) || 0;
  const h = parseFloat(document.getElementById('fHargaL').value) || 0;
  const total = l * h;
  const preview = document.getElementById('bbmTotalPreview');
  if (total > 0) {
    preview.style.display = 'flex';
    document.getElementById('bbmTotalVal').textContent = formatRupiah(total);
    // Auto-fill nominal
    document.getElementById('fNominal').value = total;
    showNominalPreview();
  } else {
    preview.style.display = 'none';
  }
}

// ============================================================
// PAJAK ARMADA CHANGE — Load current status
// ============================================================
async function onArmadaPajakChange() {
  const sel   = document.getElementById('fArmadaPajak');
  const id    = sel.value;
  const nopol = sel.options[sel.selectedIndex]?.dataset.nopol || '';
  if (!id) { document.getElementById('pajakCurrentStatus').style.display = 'none'; return; }

  // Fetch pajak data for this armada
  const r = await callAPI('getPajak', { search: nopol });
  if (!r.success || !r.data.length) {
    document.getElementById('pajakCurrentStatus').style.display = 'none'; return;
  }
  const d = r.data.find(p => p.idArmada === id) || r.data[0];

  document.getElementById('currSTNK').textContent  = d.tanggalSTNK  || 'Belum diisi';
  document.getElementById('currKIR').textContent   = d.tanggalKIR   || 'Belum diisi';
  document.getElementById('currPajak').textContent = d.tanggalPajak || 'Belum diisi';

  const renderStat = (status) => {
    if (!status || status === 'N/A') return '';
    if (status === 'TERLAMBAT')        return '<span class="status-pill status-late">🚨 Terlambat</span>';
    if (status === 'SEGERA_JATUH_TEMPO') return '<span class="status-pill status-warn">⚠️ Segera</span>';
    return '<span class="status-pill status-aman">✅ Aman</span>';
  };

  document.getElementById('statSTNK').innerHTML  = renderStat(d.statusSTNK);
  document.getElementById('statKIR').innerHTML   = renderStat(d.statusKIR);
  document.getElementById('statPajak').innerHTML = renderStat(d.statusPajak);

  // Store pajak ID for later update
  document.getElementById('fArmadaPajak').dataset.pajakId = d.id || '';
  document.getElementById('pajakCurrentStatus').style.display = 'block';
}

function togglePajakField(type) {
  const cb    = document.getElementById('cb' + type);
  const field = document.getElementById('field' + type);
  field.style.display = cb.checked ? 'block' : 'none';
}

// ============================================================
// OVERWRITE saveData to also sync BBM / Perawatan / Pajak
// ============================================================
// We'll redefine saveData below to handle the new modules

async function saveDataFull() {
  const id     = document.getElementById('editId').value;
  const ts     = document.getElementById('fTimestamp').value;
  const nama   = document.getElementById('fNama').value.trim();
  const uraian = document.getElementById('fUraian').value.trim();
  const idPos = document.getElementById('fPosId').value;
  const namaPos = selectedPosName || '';
  const nominal = document.getElementById('fNominal').value;

  if (!ts)     { showToast('Tanggal wajib diisi.','error'); return; }
  if (!nama)   { showToast('Nama penerima wajib diisi.','error'); return; }
  if (!uraian) { showToast('Uraian wajib diisi.','error'); return; }
  if (!idPos)  { showToast('Pos wajib dipilih.','error'); return; }
  if (!nominal || Number(nominal)<=0) { showToast('Nominal wajib diisi.','error'); return; }

  // Validate BBM if shown
  const bbmShown = document.getElementById('bbmExtra').classList.contains('show');
  if (bbmShown) {
    if (!document.getElementById('fArmada').value) { showToast('Pilih armada untuk BBM.','error'); return; }
    if (!document.getElementById('fLiter').value)  { showToast('Liter BBM wajib diisi.','error'); return; }
    if (!document.getElementById('fHargaL').value) { showToast('Harga per liter wajib diisi.','error'); return; }
  }

  // Validate Pajak if shown
  const pajakShown = document.getElementById('pajakExtra').classList.contains('show');
  if (pajakShown) {
    if (!document.getElementById('fArmadaPajak').value) { showToast('Pilih armada untuk update pajak.','error'); return; }
    const anyChecked = ['cbSTNK','cbKIR','cbPajak'].some(id => document.getElementById(id).checked);
    if (!anyChecked) { showToast('Centang minimal satu jenis pajak yang dibayar.','error'); return; }
  }

  const btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    // 1. Save pengeluaran utama
    const armSel = document.getElementById('fArmada');
    const nopol  = armSel.options[armSel.selectedIndex]?.dataset.nopol || '';

    const r = await callAPI(id ? 'updatePengeluaran' : 'addPengeluaran', {
      id, timestamp: ts, nama, uraian, idPos, namaPos,
      nominal: Number(nominal),
      metodePembayaran: document.getElementById('fMetode').value,
      noPolisi: nopol, idArmada: armSel.value,
      jenisBBM: document.getElementById('fJenisBBM').value,
      liter: document.getElementById('fLiter').value,
      hargaPerLiter: document.getElementById('fHargaL').value,
      fotoNotaBase64: notaB64, fotoNotaMimeType: notaMime,
      buktiBase64: buktiB64, buktiMimeType: buktiMime
    });

    if (!r.success) { showToast(r.error || 'Gagal menyimpan pengeluaran.','error'); return; }

    const pengeluaranId = r.id || id;
    const results = ['✅ Pengeluaran disimpan'];

    // 2. Sync BBM
    if (bbmShown && !id) {
      const liter        = parseFloat(document.getElementById('fLiter').value) || 0;
      const hargaPerLiter= parseFloat(document.getElementById('fHargaL').value) || 0;
      const armadaPilih  = document.getElementById('fArmada');
      const noPolBBM     = armadaPilih.options[armadaPilih.selectedIndex]?.dataset.nopol || '';

      const rBBM = await callAPI('addBBM', {
        tanggal: ts.split('T')[0],
        idArmada: armadaPilih.value,
        noPolisi: noPolBBM,
        jenisBBM: document.getElementById('fJenisBBM').value,
        liter, hargaPerLiter
      });
      results.push(rBBM.success ? '⛽ Data BBM tersimpan' : '⚠️ BBM gagal sync');
    }

    // 3. Sync Perawatan
    const prwShown = document.getElementById('perawatanExtra').classList.contains('show');
    if (prwShown && !id) {
      const armPrw   = document.getElementById('fArmadaPrw');
      const noPolPrw = armPrw.options[armPrw.selectedIndex]?.dataset.nopol || '';
      const rPrw = await callAPI('addPerawatan', {
        tanggal: ts.split('T')[0],
        idArmada: armPrw.value,
        noPolisi: noPolPrw,
        jenisPerawatan: document.getElementById('fJenisPrw').value,
        biaya: Number(nominal),
        keterangan: document.getElementById('fPrwKet').value,
        nextServiceDate: document.getElementById('fNextService').value
      });
      results.push(rPrw.success ? '🔧 Data Perawatan tersimpan' : '⚠️ Perawatan gagal sync');
    }

    // 4. Sync Pajak
    if (pajakShown && !id) {
      const armPajak = document.getElementById('fArmadaPajak');
      const pajakId  = armPajak.dataset.pajakId;

      if (pajakId) {
        const updateData = { id: pajakId };
        if (document.getElementById('cbSTNK').checked)  updateData.tanggalSTNK  = document.getElementById('fTglSTNK').value;
        if (document.getElementById('cbKIR').checked)   updateData.tanggalKIR   = document.getElementById('fTglKIR').value;
        if (document.getElementById('cbPajak').checked) updateData.tanggalPajak = document.getElementById('fTglPajak').value;

        const rPajak = await callAPI('updatePajak', updateData);
        results.push(rPajak.success ? '📋 Pajak Kendaraan terupdate' : '⚠️ Pajak gagal sync');
      } else {
        results.push('⚠️ Pajak: armada tidak ditemukan di database pajak');
      }
    }

    // Show all results
    showToast(results.join(' · '), 'success', 5000);
    closeModal('modalAdd');
    resetForm();
    pg = 1;
    loadData();

  } catch(e) {
    showToast('Terjadi error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';
  }
}


// ============================================================
// HARGA BBM REFERENSI PERTAMINA (Juni 2026)
// ============================================================
const BBM_PRICES = {
  'Solar':         6800,
  'Pertalite':     10000,
  'Pertamax':      12300,
  'Dexlite':       23000,
  'Pertamina Dex': 24800,
  'Custom':        0
};
let currentRefHarga = 0;

// Dipanggil saat jenis BBM berubah → isi harga referensi
function onJenisBBMChange() {
  const jenis  = document.getElementById('fJenisBBM').value;
  const price  = BBM_PRICES[jenis] || 0;
  currentRefHarga = price;

  const hargaEl  = document.getElementById('fHargaL');
  const noteEl   = document.getElementById('bbmHargaNote');
  const refChip  = document.getElementById('bbmRefChip');
  const resetBtn = document.getElementById('btnResetHarga');

  if (price > 0) {
    hargaEl.value = price;
    hargaEl.placeholder = '';
    refChip.textContent  = 'Ref: Rp ' + price.toLocaleString('id-ID') + '/L';
    refChip.style.display = 'inline';
    resetBtn.style.display = 'none'; // sama dengan ref, belum diubah
    noteEl.textContent = '✅ Harga referensi Pertamina Juni 2026 — bisa direvisi manual';
    noteEl.style.color = 'var(--success)';
  } else {
    hargaEl.value = '';
    hargaEl.placeholder = 'Masukkan harga per liter...';
    refChip.style.display = 'none';
    resetBtn.style.display = 'none';
    noteEl.textContent = 'Masukkan harga per liter secara manual';
    noteEl.style.color = 'var(--text-secondary)';
  }
  updateBBMCalc();
}

// Dipanggil saat user edit harga manual
function onHargaInput() {
  const price    = parseFloat(document.getElementById('fHargaL').value) || 0;
  const resetBtn = document.getElementById('btnResetHarga');
  // Tampilkan tombol reset jika harga berbeda dari referensi
  if (currentRefHarga > 0 && price !== currentRefHarga) {
    resetBtn.style.display = 'flex';
  } else {
    resetBtn.style.display = 'none';
  }
  updateBBMCalc();
}

// Reset ke harga referensi
function resetHargaToRef() {
  if (currentRefHarga > 0) {
    document.getElementById('fHargaL').value = currentRefHarga;
    document.getElementById('btnResetHarga').style.display = 'none';
    updateBBMCalc();
  }
}

// Core: Nominal (manual) ÷ Harga = Liter (readonly auto)
function updateBBMCalc() {
  const nominal = parseFloat(document.getElementById('fNominal').value) || 0;
  const harga   = parseFloat(document.getElementById('fHargaL').value)  || 0;
  const liter   = (nominal > 0 && harga > 0) ? nominal / harga : 0;

  // Update liter field (readonly)
  const literEl = document.getElementById('fLiter');
  if (liter > 0) {
    literEl.value = liter.toFixed(2);
    literEl.style.color = 'var(--info)';
  } else {
    literEl.value = '';
    literEl.placeholder = harga > 0 ? 'Isi nominal dulu...' : 'Pilih jenis BBM dulu...';
  }

  // Update summary card
  const summary = document.getElementById('bbmSummary');
  if (nominal > 0 && harga > 0) {
    summary.style.display = 'block';
    document.getElementById('bbmSumNominal').textContent = formatRupiah(nominal);
    document.getElementById('bbmSumHarga').textContent   = 'Rp ' + harga.toLocaleString('id-ID') + '/L';
    document.getElementById('bbmSumLiter').textContent   = liter.toFixed(2) + ' L';
  } else {
    summary.style.display = 'none';
  }
  showNominalPreview();
}

// Dipanggil saat nominal diubah
function onNominalChangeBBM() {
  showNominalPreview();
  const bbmShown = document.getElementById('bbmExtra').classList.contains('show');
  if (bbmShown) updateBBMCalc();
}


// Fungsi utama untuk menghitung jumlah liter
function hitungTotalLiter() {
    // Ambil nilai dari input Nominal dan Harga, ubah ke angka (float)
    const nominal = parseFloat(document.getElementById('fNominal').value) || 0;
    const hargaPerLiter = parseFloat(document.getElementById('fHargaL').value) || 0;
    const inputLiter = document.getElementById('fLiter');

    // Jika Nominal dan Harga sudah diisi lebih dari 0
    if (nominal > 0 && hargaPerLiter > 0) {
        // Rumus: Total Liter = Nominal / Harga per Liter
        const totalLiter = nominal / hargaPerLiter;
        
        // Tampilkan hasilnya di input fLiter, dibulatkan 2 angka di belakang koma
        inputLiter.value = totalLiter.toFixed(2);
        
        // Update summary UI di bawah form (opsional)
        if (document.getElementById('bbmSumNominal')) {
            document.getElementById('bbmSumNominal').innerText = 'Rp ' + nominal.toLocaleString('id-ID');
            document.getElementById('bbmSumHarga').innerText = 'Rp ' + hargaPerLiter.toLocaleString('id-ID');
            document.getElementById('bbmSumLiter').innerText = totalLiter.toFixed(2) + ' L';
            document.getElementById('bbmSummary').style.display = 'block';
        }
    } else {
        // Kosongkan liter dan sembunyikan summary jika input belum lengkap
        inputLiter.value = '';
        if (document.getElementById('bbmSummary')) {
            document.getElementById('bbmSummary').style.display = 'none';
        }
    }
}

