
let allPosData = [], allMappingData = [];

document.addEventListener('DOMContentLoaded', () => {
  loadPos();
  loadMapping();
});

// ============================================================
// POS
async function loadPos() {
  const res = await callAPI('getPos', {});
  if (!res.success) return;
  allPosData = res.data;
  document.getElementById('posCount').textContent = allPosData.length;
  renderPos(allPosData);
}

function renderPos(data) {
  const container = document.getElementById('posGrid');
  if (!data.length) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary)">Belum ada pos. Klik "Tambah Pos" untuk memulai.</div>';
    return;
  }

  const kategoriColors = {
    Operasional: '#DBEAFE', Administrasi: '#FEF3C7', SDM: '#DCFCE7',
    Utilitas: '#F3E8FF', Umum: '#F1F5F9'
  };
  const kategoriText = {
    Operasional: '#1D4ED8', Administrasi: '#D97706', SDM: '#16A34A',
    Utilitas: '#7C3AED', Umum: '#475569'
  };

  container.innerHTML = data.map(p => {
    const bg = kategoriColors[p.kategori] || '#F1F5F9';
    const tc = kategoriText[p.kategori] || '#475569';
    return `
    <div class="pos-card">
      <div class="pos-name">${p.namaPos}</div>
      <div class="pos-kategori">
        <span style="background:${bg};color:${tc};padding:2px 10px;border-radius:10px;font-size:10px">${p.kategori}</span>
      </div>
      <div class="pos-keterangan">${p.keterangan || '<span style="color:var(--gray-300);font-style:italic">Tidak ada keterangan</span>'}</div>
      <div class="pos-footer">
        <span class="badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-gray'}">${p.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm btn-icon" onclick='editPos(${JSON.stringify(p).replace(/'/g,"&#39;")})' title="Edit">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deletePos('${p.id}','${p.namaPos}')" title="Hapus">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterPos() {
  const q = document.getElementById('searchPos').value.toLowerCase();
  const kat = document.getElementById('filterKategori').value;
  const st = document.getElementById('filterStatusPos').value;
  const filtered = allPosData.filter(p => {
    const matchQ = !q || p.namaPos.toLowerCase().includes(q) || (p.keterangan||'').toLowerCase().includes(q);
    const matchK = !kat || p.kategori === kat;
    const matchS = !st || p.status === st;
    return matchQ && matchK && matchS;
  });
  renderPos(filtered);
}

function showAddModal() {
  resetPosForm();
  openModal('modalPos');
}

function editPos(pos) {
  document.getElementById('editPosId').value = pos.id;
  document.getElementById('modalPosTitle').textContent = 'Edit Pos';
  document.getElementById('fPosNama').value = pos.namaPos;
  document.getElementById('fPosKategori').value = pos.kategori;
  document.getElementById('fPosKeterangan').value = pos.keterangan || '';
  document.getElementById('fPosStatus').value = pos.status;
  document.getElementById('statusGroup').style.display = 'block';
  openModal('modalPos');
}

async function savePos() {
  const id = document.getElementById('editPosId').value;
  const namaPos = document.getElementById('fPosNama').value.trim();
  if (!namaPos) { showToast('Nama pos wajib diisi.','error'); return; }

  const btn = document.getElementById('btnSavePos');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  const res = await callAPI(id ? 'updatePos' : 'addPos', {
    id, namaPos,
    kategori: document.getElementById('fPosKategori').value,
    keterangan: document.getElementById('fPosKeterangan').value,
    status: id ? document.getElementById('fPosStatus').value : 'ACTIVE'
  });

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';

  if (res.success) {
    showToast(res.message || 'Pos berhasil disimpan.', 'success');
    closeModal('modalPos'); resetPosForm();
    loadPos(); loadMapping(); // Refresh mapping pos list too
  } else showToast(res.error, 'error');
}

async function deletePos(id, nama) {
  confirmAction(`Nonaktifkan pos "${nama}"?`, async () => {
    const res = await callAPI('deletePos', { id });
    if (res.success) { showToast('Pos dinonaktifkan.','success'); loadPos(); }
    else showToast(res.error,'error');
  });
}

function resetPosForm() {
  document.getElementById('editPosId').value = '';
  document.getElementById('modalPosTitle').textContent = 'Tambah Pos';
  ['fPosNama','fPosKeterangan'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fPosKategori').value = 'Operasional';
  document.getElementById('statusGroup').style.display = 'none';
}

// ============================================================
// MAPPING
async function loadMapping() {
  const [mappingRes, posRes] = await Promise.all([
    callAPI('getPosMapping', {}),
    callAPI('getPos', { status: 'ACTIVE' })
  ]);

  if (mappingRes.success) {
    allMappingData = mappingRes.data;
    document.getElementById('mappingCount').textContent = allMappingData.length;
    renderMapping(allMappingData);
  }

  if (posRes.success) {
    const sel = document.getElementById('newMappingPos');
    sel.innerHTML = '<option value="">-- Pilih Pos --</option>';
    posRes.data.forEach(p => {
      sel.innerHTML += `<option value="${p.id}" data-name="${p.namaPos}">${p.namaPos}</option>`;
    });
  }
}

function renderMapping(data) {
  const container = document.getElementById('mappingList');
  if (!data.length) {
    container.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-secondary);font-size:13px">Belum ada mapping. Tambahkan keyword di atas.</div>';
    return;
  }
  container.innerHTML = data.map(m => `
    <div class="mapping-table-row">
      <span class="mapping-keyword">${m.keyword}</span>
      <span class="mapping-arrow">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </span>
      <span class="mapping-pos">${m.namaPos}</span>
      <span style="font-size:11px;color:var(--text-secondary);flex:1;text-align:right;padding-right:12px">${m.createdAt ? m.createdAt.split(' ')[0] : ''}</span>
      <button class="mapping-delete" onclick="deleteMapping('${m.id}','${m.keyword}')" title="Hapus">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`).join('');
}

function filterMapping() {
  const q = document.getElementById('searchMapping').value.toLowerCase();
  const filtered = allMappingData.filter(m =>
    m.keyword.toLowerCase().includes(q) || m.namaPos.toLowerCase().includes(q)
  );
  renderMapping(filtered);
}

async function addMapping() {
  const keyword = document.getElementById('newKeyword').value.trim().toLowerCase();
  const sel = document.getElementById('newMappingPos');
  const idPos = sel.value;
  const namaPos = sel.options[sel.selectedIndex]?.dataset.name || '';

  if (!keyword) { showToast('Keyword wajib diisi.','error'); return; }
  if (!idPos) { showToast('Pos tujuan wajib dipilih.','error'); return; }

  const res = await callAPI('addPosMapping', { keyword, idPos, namaPos });
  if (res.success) {
    showToast('Mapping berhasil ditambahkan.','success');
    document.getElementById('newKeyword').value = '';
    sel.value = '';
    loadMapping();
  } else showToast(res.error, 'error');
}

async function deleteMapping(id, keyword) {
  confirmAction(`Hapus mapping keyword "${keyword}"?`, async () => {
    const res = await callAPI('deletePosMapping', { id });
    if (res.success) { showToast('Mapping dihapus.','success'); loadMapping(); }
    else showToast(res.error,'error');
  });
}

// Smart Pos Live Test
let testTimeout = null;
function testSmartPos() {
  clearTimeout(testTimeout);
  testTimeout = setTimeout(async () => {
    const uraian = document.getElementById('demoUraian').value.trim();
    const result = document.getElementById('demoResult');
    if (!uraian || uraian.length < 2) { result.style.display = 'none'; return; }

    const res = await callAPI('detectPos', { uraian });
    result.style.display = 'block';
    if (res.success && res.data) {
      result.className = 'demo-result found';
      result.innerHTML = `✅ <strong>Pos Terdeteksi: ${res.data.namaPos}</strong> — sistem akan otomatis memilih pos ini saat input pengeluaran.`;
    } else {
      result.className = 'demo-result notfound';
      result.innerHTML = `⚠️ Tidak ada pos yang cocok. Tambahkan keyword baru di form di bawah.`;
    }
  }, 400);
}

// Tab switcher
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');

  const btnAdd = document.getElementById('btnAdd');
  const btnText = document.getElementById('btnAddText');
  if (tabId === 'tabMapping') {
    btnAdd.style.display = 'none';
  } else {
    btnAdd.style.display = 'flex';
    btnText.textContent = 'Tambah Pos';
  }
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Daftar Pos Pengeluaran', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 14, 26);
  doc.autoTable({
    head: [['No','Nama Pos','Kategori','Keterangan','Status']],
    body: allPosData.map((p,i) => [i+1, p.namaPos, p.kategori, p.keterangan||'-', p.status]),
    startY: 32, styles:{fontSize:10}, headStyles:{fillColor:[13,71,161],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[245,249,255]}
  });
  doc.save('Pos_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.pdf');
}
</script>

<script>
document.addEventListener('DOMContentLoaded', () => initPage('pos'));
