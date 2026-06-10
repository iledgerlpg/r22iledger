
let currentPage = 1, totalPages = 1;
let selectedBuktiBase64 = null, selectedBuktiMime = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDT();
  loadData();
});

function setDefaultDT() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('fTimestamp').value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('filterMonth').value = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
}

async function loadData() {
  showSkeleton('tableBody', 5);
  const res = await callAPI('getPemasukan', {
    page: currentPage, limit: document.getElementById('limitSelect').value,
    search: document.getElementById('searchInput').value,
    filterMonth: document.getElementById('filterMonth').value
  });
  if (!res.success) { showToast('Gagal memuat data.','error'); return; }
  totalPages = res.totalPages || 1;
  document.getElementById('resultInfo').textContent = `${res.total} data`;
  document.getElementById('pageInfo').textContent = `Hal ${res.page} dari ${totalPages}`;
  renderTable(res.data, res.page, parseInt(document.getElementById('limitSelect').value));
  renderPagination('paginationContainer', currentPage, totalPages, 'changePage');
  updateSummary(res.data);
}

function updateSummary(data) {
  const total = data.reduce((s,r) => s + r.nominal, 0);
  const max = data.length ? Math.max(...data.map(r => r.nominal)) : 0;
  document.getElementById('sumTotal').textContent = formatRupiah(total);
  document.getElementById('sumCount').textContent = data.length + ' transaksi';
  document.getElementById('sumAvg').textContent = formatRupiah(data.length ? Math.round(total / data.length) : 0);
  document.getElementById('sumMax').textContent = formatRupiah(max);
}

function renderTable(data, page, limit) {
  const tbody = document.getElementById('tableBody');
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><h3>Belum ada pendapatan</h3><p>Klik "Tambah Pendapatan" untuk mencatat</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((r, i) => {
    const no = (page - 1) * limit + i + 1;
    const buktiHtml = r.buktiTransferURL
      ? `<img class="nota-thumb" src="${r.buktiTransferURL}" onclick="openLightbox('${r.buktiTransferURL}')">`
      : '<span style="font-size:11px;color:var(--text-secondary)">-</span>';
    return `<tr>
      <td style="font-weight:600;color:var(--text-secondary)">${no}</td>
      <td style="white-space:nowrap;font-size:12px">${r.timestamp}</td>
      <td style="font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.nama}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${r.uraian}</td>
      <td style="font-weight:700;color:var(--success);white-space:nowrap">${formatRupiah(r.nominal)}</td>
      <td>${buktiHtml}</td>
      <td style="font-size:11px;color:var(--text-secondary)">${(r.createdBy||'').split('@')[0]}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm btn-icon" onclick='editRow(${JSON.stringify(r)})' title="Edit">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRow('${r.id}','${r.nama}')" title="Hapus">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function changePage(p) { currentPage = p; loadData(); }
function debounceSearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { currentPage = 1; loadData(); }, 400); }

function previewNominal() {
  const val = parseFloat(document.getElementById('fNominal').value) || 0;
  const el = document.getElementById('nomPreview');
  el.style.display = val > 0 ? 'block' : 'none';
  el.textContent = formatRupiah(val);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    selectedBuktiBase64 = ev.target.result.split(',')[1];
    selectedBuktiMime = file.type;
    document.getElementById('previewBuktiImg').src = ev.target.result;
    document.getElementById('previewBukti').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeFile() {
  selectedBuktiBase64 = null; selectedBuktiMime = null;
  document.getElementById('previewBukti').style.display = 'none';
  document.getElementById('previewBuktiImg').src = '';
}

async function saveData() {
  const id = document.getElementById('editId').value;
  const ts = document.getElementById('fTimestamp').value;
  const nama = document.getElementById('fNama').value.trim();
  const uraian = document.getElementById('fUraian').value.trim();
  const nominal = document.getElementById('fNominal').value;
  if (!ts || !nama || !uraian || !nominal || Number(nominal) <= 0) { showToast('Semua field wajib diisi.','error'); return; }
  
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  
  const res = await callAPI(id ? 'updatePemasukan' : 'addPemasukan', {
    id, timestamp: ts, nama, uraian, nominal: Number(nominal),
    buktiBase64: selectedBuktiBase64, buktiMimeType: selectedBuktiMime
  });
  
  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';
  
  if (res.success) { showToast(res.message, 'success'); closeModal('modalAdd'); resetForm(); loadData(); }
  else showToast(res.error,'error');
}

function editRow(row) {
  document.getElementById('editId').value = row.id;
  document.getElementById('modalTitle').textContent = 'Edit Pendapatan';
  document.getElementById('fTimestamp').value = row.timestamp?.replace(' ','T').substring(0,16) || '';
  document.getElementById('fNama').value = row.nama;
  document.getElementById('fUraian').value = row.uraian;
  document.getElementById('fNominal').value = row.nominal;
  previewNominal();
  openModal('modalAdd');
}

async function deleteRow(id, nama) {
  confirmAction(`Hapus pendapatan dari "${nama}"?`, async () => {
    const res = await callAPI('deletePemasukan', { id });
    if (res.success) { showToast('Pendapatan dihapus.','success'); loadData(); }
    else showToast(res.error,'error');
  });
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').textContent = 'Tambah Pendapatan';
  ['fNama','fUraian','fNominal'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('nomPreview').style.display = 'none';
  removeFile(); setDefaultDT();
}

function openLightbox(url) { document.getElementById('lightboxImg').src = url; document.getElementById('lightbox').classList.add('show'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Laporan Pendapatan', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 14, 26);
  const rows = [];
  document.querySelectorAll('#tableBody tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 5) rows.push([tds[0].textContent, tds[1].textContent, tds[2].textContent, tds[3].textContent, tds[4].textContent]);
  });
  doc.autoTable({ head:[['No','Tanggal','Nama','Uraian','Nominal']], body: rows, startY:32, styles:{fontSize:9}, headStyles:{fillColor:[16,185,129],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[240,253,244]} });
  doc.save('Pendapatan_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.pdf');
}



document.addEventListener('DOMContentLoaded', () => initPage('pemasukan'));

