let allData = [], currentView = 'grid';
let selectedFotoBase64 = null, selectedFotoMime = null;
let searchTimeout = null; // FIX: Duplikat deklarasi sudah dihapus

let uploadState = {
  stnk: { base64: null, mime: null },
  kir: { base64: null, mime: null },
  barcode: { base64: null, mime: null }
};

// Gabungkan inisialisasi agar berjalan berurutan dengan aman
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof initPage === 'function') initPage('armada');
  setDefaultDT();
  await loadData();
});

function setDefaultDT() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  
  // Cek dulu apakah input fTimestamp ada di HTML
  const elTimestamp = document.getElementById('fTimestamp');
  if (elTimestamp) {
    elTimestamp.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  
  // Cek dulu apakah filterMonth ada di HTML
  const elFilterMonth = document.getElementById('filterMonth');
  if (elFilterMonth) {
    elFilterMonth.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  }
}
async function loadData() {
  showSkeleton('tableBody', 5);
  const res = await callAPI('getArmada', {
    search: document.getElementById('searchInput').value,
    status: document.getElementById('filterStatus').value
  });
  if (!res.success) { showToast('Gagal memuat data.','error'); return; }
  allData = res.data;
  document.getElementById('resultInfo').textContent = allData.length + ' armada';
  updateStats(allData);
  if (currentView === 'grid') renderGrid(allData);
  else renderList(allData);
}

function updateStats(data) {
  const active = data.filter(d => d.status === 'ACTIVE').length;
  const now = new Date();
  let stnkWarn = 0, late = 0;
  data.forEach(d => {
    if (d.tanggalSTNK) {
      const tgl = new Date(d.tanggalSTNK.split('/').reverse().join('-'));
      const diff = Math.floor((tgl - now) / 86400000);
      if (diff < 0) late++;
      else if (diff <= 30) stnkWarn++;
    }
  });
  document.getElementById('statTotal').textContent = data.length + ' unit';
  document.getElementById('statActive').textContent = active + ' unit';
  document.getElementById('statSTNK').textContent = stnkWarn + ' unit';
  document.getElementById('statLate').textContent = late + ' unit';
}

function cleanImageUrl(url) {
    if (!url) return '';
    if (url.includes('uc?export=view')) return url;
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
    const thumbUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w300`;
    const fullUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
    
    return `<a href="${fullUrl}" target="_blank" class="hover:opacity-80 transition">
                <img src="${thumbUrl}" class="h-12 w-12 object-cover rounded shadow mx-auto border border-gray-200" loading="lazy" />
            </a>`;
}

function renderGrid(data) {
  const container = document.getElementById('armadaGrid');
  if (!data.length) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary)"><svg viewBox="0 0 24 24" width="64" height="64" stroke="var(--gray-200)" fill="none" stroke-width="1"><rect x="1" y="3" width="15" height="13" rx="1"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:12px 0 6px">Belum ada armada</h3><p style="font-size:13px">Klik "Tambah Armada" untuk mendaftarkan kendaraan</p></div>';
    return;
  }
  container.innerHTML = data.map(a => {
    const stStatus = getStnkStatus(a.tanggalSTNK);
    const mainPhotoUrl = a.fotoURL || a.FotoSTNK || a.FotoKIR; 
    
    // OPTIMASI: Bungkus thumbnail utama dengan deteksi ID Google Drive
    const idFotoUtama = extractFileId(mainPhotoUrl);
    const srcFotoUtama = idFotoUtama ? `https://drive.google.com/thumbnail?id=${idFotoUtama}&sz=w300` : mainPhotoUrl;
    
    const photoHtml = mainPhotoUrl
      ? `<img src="${srcFotoUtama}" alt="${a.noPolisi}" onerror="this.parentElement.innerHTML='<div class=armada-photo-placeholder><svg viewBox=\'0 0 24 24\'><rect x=\'1\' y=\'3\' width=\'15\' height=\'13\' rx=\'1\'/></svg></div>'">`
      : `<div class="armada-photo-placeholder"><svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" fill="none" stroke-width="0.8"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>`;
    
    // Generate shortcut preview dokumen di dalam kartu grid
    let docBadges = '';
    [['FotoSTNK', 'STNK', 'badge-info'], ['FotoKIR', 'KIR', 'badge-success'], ['FotoBarcodeSubsidiTepat', 'Barcode', 'badge-gray']].forEach(([prop, label, cls]) => {
      if (a[prop]) {
        const idDoc = extractFileId(a[prop]);
        const fullDocUrl = idDoc ? `https://drive.google.com/thumbnail?id=${idDoc}&sz=w1200` : a[prop];
        docBadges += `<span class="badge ${cls} clickable-preview cursor-pointer" data-click-url="${fullDocUrl}" style="font-size:10px; padding:2px 6px; margin-right:4px;" title="Lihat ${label}">${label}</span>`;
      }
    });

    return `
    <div class="armada-card">
      <div class="armada-photo">
        ${photoHtml}
        <div class="armada-nopol">${a.noPolisi}</div>
        <div class="armada-status-dot ${a.status === 'ACTIVE' ? 'active' : 'inactive'}"></div>
      </div>
      <div class="armada-body">
        <div class="armada-name">${a.merk || '-'}</div>
        <div class="armada-type">${a.jenisKendaraan} · ${a.tahun || '-'}</div>
        <div class="armada-detail-grid">
          <div class="armada-detail-item"><div class="d-label">Pemilik</div><div class="d-value">${a.pemilik || '-'}</div></div>
          <div class="armada-detail-item"><div class="d-label">No. STNK</div><div class="d-value">${a.noSTNK || '-'}</div></div>
          <div class="armada-detail-item"><div class="d-label">Tgl STNK</div><div class="d-value">${a.tanggalSTNK || '-'}</div></div>
          <div class="armada-detail-item"><div class="d-label">Tgl KIR</div><div class="d-value">${a.tanggalKIR || '-'}</div></div>
        </div>
        <div style="margin-top:8px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:5px;">
          ${a.tanggalSTNK ? `<div><span class="stnk-status ${stStatus.cls}">${stStatus.text}</span></div>` : ''}
          <div style="display:flex;">${docBadges}</div>
        </div>
      </div>
      <div class="armada-footer">
        <button class="btn btn-outline btn-sm" style="flex:1" onclick='editRow(${JSON.stringify(a).replace(/'/g,"&#39;")})'>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteRow('${a.id}','${a.noPolisi}')">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  attachLightboxEvents(container);
}

function renderList(data) {
  const tbody = document.getElementById('armadaTableBody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-secondary)">Belum ada armada</td></tr>'; return; }
  tbody.innerHTML = data.map((a, i) => {
    
    // Generate link preview dokumen untuk tampilan tabel list
    let docLinks = [];
    [['FotoSTNK', 'STNK'], ['FotoKIR', 'KIR'], ['FotoBarcodeSubsidiTepat', 'Barcode']].forEach(([prop, label]) => {
      if (a[prop]) {
        const idDoc = extractFileId(a[prop]);
        const fullDocUrl = idDoc ? `https://drive.google.com/thumbnail?id=${idDoc}&sz=w1200` : a[prop];
        docLinks.push(`<span class="clickable-preview text-primary cursor-pointer underline" data-click-url="${fullDocUrl}" style="margin-right:5px; font-size:11px;">[${label}]</span>`);
      }
    });
    const docHtml = docLinks.length ? docLinks.join('') : '-';

    return `<tr>
      <td>${i+1}</td>
      <td style="font-weight:700">${a.noPolisi}</td>
      <td>${a.jenisKendaraan}</td>
      <td>${a.merk}</td>
      <td>${a.tahun}</td>
      <td>${a.pemilik}</td>
      <td>${a.tanggalSTNK || '-'}</td>
      <td>${a.tanggalKIR || '-'}</td>
      <td><div style="margin-bottom:4px;"><span class="badge ${a.status === 'ACTIVE' ? 'badge-success' : 'badge-gray'}">${a.status}</span></div><div>${docHtml}</div></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm btn-icon" onclick='editRow(${JSON.stringify(a).replace(/'/g,"&#39;")})'>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>
        </button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRow('${a.id}','${a.noPolisi}')">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');

  attachLightboxEvents(tbody);
}

// Fungsi pembantu reusable untuk mengaktifkan klik Lightbox dokumen
function attachLightboxEvents(parentElement) {
  parentElement.querySelectorAll('.clickable-preview').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation(); // Biar kartu grid gak ikut pemicu klik lain
      const targetUrl = this.getAttribute('data-click-url');
      if (targetUrl) {
        // Otomatis deteksi fungsi lightbox mana yang terpasang di sistem global lo
        if (typeof openLightbox === 'function') openLightbox(targetUrl);
        else if (typeof openLB === 'function') openLB(targetUrl);
      }
    });
  });
}

function getStnkStatus(tglStr) {
  if (!tglStr) return { cls: '', text: '' };
  const tgl = new Date(tglStr.split('/').reverse().join('-'));
  const diff = Math.floor((tgl - new Date()) / 86400000);
  if (diff < 0) return { cls: 'stnk-danger', text: '⛔ Terlambat ' + Math.abs(diff) + ' hari' };
  if (diff <= 30) return { cls: 'stnk-warning', text: '⚠️ ' + diff + ' hari lagi' };
  return { cls: 'stnk-aman', text: '✅ Aman' };
}

function setView(v) {
  currentView = v;
  document.getElementById('armadaGrid').style.display = v === 'grid' ? 'grid' : 'none';
  document.getElementById('armadaList').style.display = v === 'list' ? 'block' : 'none';
  document.getElementById('btnGrid').classList.toggle('active', v === 'grid');
  document.getElementById('btnList').classList.toggle('active', v === 'list');
  if (v === 'list') renderList(allData);
}

function handleFotoSelect(e, jenis) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadState[jenis].base64 = ev.target.result.split(',')[1]; 
    uploadState[jenis].mime = file.type;
    document.getElementById(`preview${jenis}Img`).src = ev.target.result;
    document.getElementById(`preview${jenis}`).style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeFoto(jenis) { 
  uploadState[jenis] = { base64: null, mime: null }; 
  document.getElementById(`preview${jenis}`).style.display = 'none'; 
  const fileInput = document.getElementById(`fFoto${jenis}`);
  if(fileInput) fileInput.value = '';
}

function setupEditPreview(jenis, url) {
    const previewBox = document.getElementById(`preview${jenis}`);
    const previewImg = document.getElementById(`preview${jenis}Img`);
    
    uploadState[jenis] = { base64: null, mime: null };
    
    if (url) {
        // Optimasi link preview pada modal edit agar tembus pembatasan Drive
        const id = extractFileId(url);
        previewImg.src = id ? `https://drive.google.com/thumbnail?id=${id}&sz=w300` : url;
        previewBox.style.display = 'block';
    } else {
        previewImg.src = '';
        previewBox.style.display = 'none';
    }
}

async function saveData() {
  const id = document.getElementById('editId').value;
  const noPolisi = document.getElementById('fNopol').value.trim().toUpperCase();
  if (!noPolisi) { showToast('Nomor polisi wajib diisi.','error'); return; }
  
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  
  const res = await callAPI(id ? 'updateArmada' : 'addArmada', {
    id, noPolisi, jenisKendaraan: document.getElementById('fJenis').value,
    merk: document.getElementById('fMerk').value, tahun: document.getElementById('fTahun').value,
    pemilik: document.getElementById('fPemilik').value, noSTNK: document.getElementById('fNoSTNK').value,
    tanggalSTNK: document.getElementById('fTglSTNK').value,
    tanggalKIR: document.getElementById('fTglKIR').value,
    barcodeSubsidiTepat: document.getElementById('fBarcode').value,
    status: id ? document.getElementById('fStatus').value : 'ACTIVE',
    
    fotoSTNKBase64: uploadState.stnk.base64, fotoSTNKMimeType: uploadState.stnk.mime,
    fotoKIRBase64: uploadState.kir.base64, fotoKIRMimeType: uploadState.kir.mime,
    fotoBarcodeBase64: uploadState.barcode.base64, fotoBarcodeMimeType: uploadState.barcode.mime
  });
  
  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';
  
  if (res.success) { showToast(res.message, 'success'); closeModal('modalAdd'); resetForm(); loadData(); }
  else showToast(res.error, 'error');
}

function editRow(row) {
  document.getElementById('editId').value = row.id;
  document.getElementById('modalTitle').textContent = 'Edit Armada';
  document.getElementById('fNopol').value = row.noPolisi;
  document.getElementById('fJenis').value = row.jenisKendaraan;
  document.getElementById('fMerk').value = row.merk;
  document.getElementById('fTahun').value = row.tahun;
  document.getElementById('fPemilik').value = row.pemilik;
  document.getElementById('fNoSTNK').value = row.noSTNK;
  document.getElementById('fTglSTNK').value = row.tanggalSTNK ? row.tanggalSTNK.split('/').reverse().join('-') : '';
  document.getElementById('fTglKIR').value = row.tanggalKIR ? row.tanggalKIR.split('/').reverse().join('-') : '';
  document.getElementById('fBarcode').value = row.barcodeSubsidiTepat || '';
  document.getElementById('fStatus').value = row.status;
  document.getElementById('editStatusGroup').style.display = 'block';
  
  setupEditPreview('stnk', row.FotoSTNK);
  setupEditPreview('kir', row.FotoKIR);
  setupEditPreview('barcode', row.FotoBarcodeSubsidiTepat);

  openModal('modalAdd');
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').textContent = 'Tambah Armada';
  ['fNopol','fMerk','fTahun','fPemilik','fNoSTNK','fTglSTNK','fTglKIR','fBarcode'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('editStatusGroup').style.display = 'none';
  ['stnk', 'kir', 'barcode'].forEach(jenis => removeFoto(jenis));
}

function debounceSearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(loadData, 400); }

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Data Armada', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 14, 26);
  doc.autoTable({
    head: [['No','No Polisi','Jenis','Merk','Tahun','Pemilik','STNK','KIR','Status']],
    body: allData.map((a,i) => [i+1, a.noPolisi, a.jenisKendaraan, a.merk, a.tahun, a.pemilik, a.tanggalSTNK||'-', a.tanggalKIR||'-', a.status]),
    startY: 32, styles:{fontSize:9}, headStyles:{fillColor:[13,71,161],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[245,249,255]}
  });
  doc.save('Armada_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.pdf');
}
