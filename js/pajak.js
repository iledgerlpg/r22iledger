
let allData = [], currentFilter = 'all';

document.addEventListener('DOMContentLoaded', loadData);

async function loadData() {
  const res = await callAPI('getPajak', {});
  if (!res.success) { showToast('Gagal memuat data.','error'); return; }
  allData = res.data;
  updateStats(allData);
  renderAlerts(allData);
  applyFilter();
}

function updateStats(data) {
  let aman = 0, warn = 0, late = 0;
  data.forEach(d => {
    const worst = getWorstStatus(d);
    if (worst === 'AMAN') aman++;
    else if (worst === 'SEGERA_JATUH_TEMPO') warn++;
    else if (worst === 'TERLAMBAT') late++;
  });
  document.getElementById('statAman').textContent = aman;
  document.getElementById('statWarn').textContent = warn;
  document.getElementById('statLate').textContent = late;
  document.getElementById('statTotal').textContent = data.length;
  
  const pajakBadge = document.getElementById('pajakBadge');
  if (pajakBadge && (warn + late) > 0) {
    pajakBadge.style.display = 'inline';
    pajakBadge.textContent = warn + late;
  }
}

function getWorstStatus(d) {
  const statuses = [d.statusSTNK, d.statusKIR, d.statusPajak].filter(s => s && s !== 'N/A');
  if (statuses.includes('TERLAMBAT')) return 'TERLAMBAT';
  if (statuses.includes('SEGERA_JATUH_TEMPO')) return 'SEGERA_JATUH_TEMPO';
  return 'AMAN';
}

function renderAlerts(data) {
  const strips = document.getElementById('alertStrips');
  const late = data.filter(d => getWorstStatus(d) === 'TERLAMBAT');
  const warn = data.filter(d => getWorstStatus(d) === 'SEGERA_JATUH_TEMPO');
  let html = '';
  if (late.length) html += `<div class="alert-strip alert-danger"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg><strong>${late.length} kendaraan terlambat:</strong> ${late.map(d => d.noPolisi).join(', ')}</div>`;
  if (warn.length) html += `<div class="alert-strip alert-warning"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg><strong>${warn.length} kendaraan segera jatuh tempo:</strong> ${warn.map(d => d.noPolisi).join(', ')}</div>`;
  strips.innerHTML = html;
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function applyFilter() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  let filtered = allData.filter(d => !q || d.noPolisi.toLowerCase().includes(q));
  
  if (currentFilter === 'warning') filtered = filtered.filter(d => getWorstStatus(d) === 'SEGERA_JATUH_TEMPO');
  else if (currentFilter === 'danger') filtered = filtered.filter(d => getWorstStatus(d) === 'TERLAMBAT');
  
  renderGrid(filtered);
}

function renderGrid(data) {
  const container = document.getElementById('pajakGrid');
  if (!data.length) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-secondary)"><h3 style="color:var(--text-primary)">Tidak ada data</h3><p style="font-size:13px;margin-top:6px">Tambahkan armada di menu Data Armada untuk melihat status pajak.</p></div>';
    return;
  }
  container.innerHTML = data.map(d => {
    const worst = getWorstStatus(d);
    const borderColor = worst === 'TERLAMBAT' ? 'var(--error)' : worst === 'SEGERA_JATUH_TEMPO' ? 'var(--warning)' : 'var(--border-color)';
    const topBg = worst === 'TERLAMBAT' ? '#fef2f2' : worst === 'SEGERA_JATUH_TEMPO' ? '#fffbeb' : 'var(--bg-card)';

    const stnkBadge = getStatusBadge(d.statusSTNK, d.diffSTNK);
    const kirBadge = getStatusBadge(d.statusKIR, d.diffKIR);

    const daysLeft = d.diffSTNK !== null ? d.diffSTNK : (d.diffKIR !== null ? d.diffKIR : null);
    const ringData = daysLeft !== null ? buildRing(daysLeft) : null;

    return `
    <div class="pajak-card" style="border-color:${borderColor}">
      <div class="pajak-card-top" style="background:${topBg}">
        <div style="display:flex;align-items:center;gap:10px">
          ${ringData ? `<div class="countdown-ring">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <circle class="ring-bg" cx="24" cy="24" r="20"/>
              <circle class="ring-fill" cx="24" cy="24" r="20"
                style="stroke:${ringData.color};stroke-dasharray:125.7;stroke-dashoffset:${ringData.offset}"/>
            </svg>
            <div class="ring-text">${Math.abs(daysLeft)}</div>
          </div>` : ''}
          <div>
            <div class="pajak-nopol">${d.noPolisi}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${worst === 'TERLAMBAT' ? '🚨 Terlambat' : worst === 'SEGERA_JATUH_TEMPO' ? '⚠️ Segera Jatuh Tempo' : '✅ Aman'}</div>
          </div>
        </div>
      </div>
      <div class="pajak-card-body">
        <div class="pajak-item">
          <div class="pi-label">STNK</div>
          <div class="pi-value">${d.tanggalSTNK || 'Belum diisi'}</div>
          <div class="pi-days">${stnkBadge}</div>
        </div>
        <div class="pajak-item">
          <div class="pi-label">KIR</div>
          <div class="pi-value">${d.tanggalKIR || 'Belum diisi'}</div>
          <div class="pi-days">${kirBadge}</div>
        </div>
      </div>
      <div class="pajak-card-footer">
        <button class="btn btn-outline btn-sm" onclick="editPajak('${d.id}','${d.noPolisi}','${d.tanggalSTNK||''}','${d.tanggalKIR||''}','${d.tanggalPajak||''}')">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Update Tanggal
        </button>
      </div>
    </div>`;
  }).join('');
}

function getStatusBadge(status, diff) {
  if (!status || status === 'N/A') return '<span class="status-badge status-na">-</span>';
  if (status === 'TERLAMBAT') return `<span class="status-badge status-danger">🚨 Terlambat ${diff !== null ? Math.abs(diff) + ' hari' : ''}</span>`;
  if (status === 'SEGERA_JATUH_TEMPO') return `<span class="status-badge status-warning">⚠️ ${diff} hari lagi</span>`;
  return `<span class="status-badge status-aman">✅ Aman (${diff} hari)</span>`;
}

function buildRing(days) {
  const maxDays = 365;
  const clampedDays = Math.max(0, Math.min(days, maxDays));
  const pct = clampedDays / maxDays;
  const circumference = 125.7;
  const offset = circumference - (pct * circumference);
  const color = days < 0 ? '#ef4444' : days <= 7 ? '#ef4444' : days <= 30 ? '#f59e0b' : '#10b981';
  return { offset, color };
}

function editPajak(id, noPolisi, tglSTNK, tglKIR, tglPajak) {
  document.getElementById('editPajakId').value = id;
  document.getElementById('modalEditTitle').textContent = 'Update Pajak – ' + noPolisi;
  document.getElementById('fTglSTNK').value = tglSTNK ? tglSTNK.split('/').reverse().join('-') : '';
  document.getElementById('fTglKIR').value = tglKIR ? tglKIR.split('/').reverse().join('-') : '';
  document.getElementById('fTglPajak').value = tglPajak ? tglPajak.split('/').reverse().join('-') : '';
  openModal('modalEdit');
}

async function savePajak() {
  const id = document.getElementById('editPajakId').value;
  const btn = document.getElementById('btnSavePajak');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  
  const res = await callAPI('updatePajak', {
    id,
    tanggalSTNK: document.getElementById('fTglSTNK').value,
    tanggalKIR: document.getElementById('fTglKIR').value,
    tanggalPajak: document.getElementById('fTglPajak').value
  });
  
  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';
  
  if (res.success) { showToast('Data pajak diperbarui.','success'); closeModal('modalEdit'); loadData(); }
  else showToast(res.error,'error');
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Status Pajak Kendaraan', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 14, 26);
  doc.autoTable({
    head: [['No','No Polisi','Tgl STNK','Tgl KIR','Status STNK','Status KIR']],
    body: allData.map((d,i) => [i+1, d.noPolisi, d.tanggalSTNK||'-', d.tanggalKIR||'-', d.statusSTNK, d.statusKIR]),
    startY: 32, styles:{fontSize:9},
    headStyles:{fillColor:[13,71,161],textColor:255,fontStyle:'bold'},
    bodyStyles:(row) => {
      const status = row.cells[4]?.raw;
      if (status === 'TERLAMBAT') return { fillColor: [254,226,226] };
      if (status === 'SEGERA_JATUH_TEMPO') return { fillColor: [254,243,199] };
    }
  });
  doc.save('PajakKendaraan_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.pdf');
}


<script>
document.addEventListener('DOMContentLoaded', () => initPage('pajak'));
</script>
