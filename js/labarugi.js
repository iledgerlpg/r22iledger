
let currentPeriod = 'monthly';
let lrChart = null;

document.addEventListener('DOMContentLoaded', () => {
  populateYearSelect();
  setDefaultSelects();
  loadData();
});

function populateYearSelect() {
  const sel = document.getElementById('selectYear');
  const now = new Date().getFullYear();
  for (let y = now; y >= now - 5; y--) {
    sel.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

function setDefaultSelects() {
  const now = new Date();
  document.getElementById('selectMonth').value = now.getMonth() + 1;
}

function setPeriod(p) {
  currentPeriod = p;
  document.getElementById('tabMonthly').classList.toggle('active', p === 'monthly');
  document.getElementById('tabYearly').classList.toggle('active', p === 'yearly');
  document.getElementById('selectMonth').style.display = p === 'monthly' ? 'block' : 'none';
  loadData();
}

async function loadData() {
  const year = document.getElementById('selectYear').value;
  const month = document.getElementById('selectMonth').value;
  
  document.getElementById('lrPeriode').textContent = 'Memuat...';
  
  const res = await callAPI('getLabaRugi', { period: currentPeriod, year: parseInt(year), month: parseInt(month) });
  if (!res.success) { showToast('Gagal memuat data.','error'); return; }
  
  const d = res.data;
  renderLabaRugi(d);
}

function renderLabaRugi(d) {
  document.getElementById('lrPeriode').textContent = d.periode;
  document.getElementById('lrNetPeriode').textContent = d.periode;
  document.getElementById('lrPendapatan').textContent = formatRupiah(d.totalPendapatan);
  document.getElementById('lrPengeluaran').textContent = formatRupiah(d.totalPengeluaran);
  
  const labaEl = document.getElementById('lrLaba');
  labaEl.textContent = formatRupiah(d.labaBersih);
  labaEl.className = 'lr-kpi-value ' + (d.labaBersih >= 0 ? 'positive' : 'negative');

  const netEl = document.getElementById('lrNetValue');
  netEl.textContent = formatRupiah(d.labaBersih);
  netEl.className = 'lr-net-value ' + (d.labaBersih >= 0 ? 'positive' : 'negative');

  // Pendapatan section
  document.getElementById('secPendapatanTotal').textContent = formatRupiah(d.totalPendapatan);
  document.getElementById('secPengeluaranTotal').textContent = formatRupiah(d.totalPengeluaran);
  document.getElementById('totalPendapatanLabel').textContent = formatRupiah(d.totalPendapatan);
  document.getElementById('totalPengeluaranLabel').textContent = formatRupiah(d.totalPengeluaran);

  const pendapatanRows = document.getElementById('pendapatanRows');
  if (d.pendapatanDetail && d.pendapatanDetail.length) {
    pendapatanRows.innerHTML = d.pendapatanDetail.map(p => {
      const pct = d.totalPendapatan > 0 ? ((p.total / d.totalPendapatan) * 100).toFixed(1) : 0;
      return `<div class="lr-item">
        <div class="lr-item-label">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--success)" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          ${p.uraian}
          <span class="lr-item-pct">${pct}%</span>
        </div>
        <div class="lr-item-value">${formatRupiah(p.total)}</div>
      </div>`;
    }).join('');
  } else {
    pendapatanRows.innerHTML = `<div class="lr-item" style="justify-content:center;color:var(--text-secondary);font-size:13px">Belum ada data pendapatan</div>`;
  }

  // Pengeluaran section
  const pengeluaranRows = document.getElementById('pengeluaranRows');
  if (d.pengeluaranByPos && d.pengeluaranByPos.length) {
    pengeluaranRows.innerHTML = d.pengeluaranByPos.map(p => {
      const pct = d.totalPengeluaran > 0 ? ((p.total / d.totalPengeluaran) * 100).toFixed(1) : 0;
      const barWidth = Math.min(100, parseFloat(pct));
      return `<div class="lr-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="lr-item-label">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--error)" fill="none" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/></svg>
            ${p.pos}
            <span class="lr-item-pct">${pct}%</span>
          </div>
          <div class="lr-item-value red">${formatRupiah(p.total)}</div>
        </div>
        <div style="height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${barWidth}%;background:linear-gradient(90deg,#ef4444,#f87171);border-radius:2px;transition:width .6s ease"></div>
        </div>
      </div>`;
    }).join('');

    // Render chart
    renderLRChart(d.pengeluaranByPos);
    document.getElementById('chartSection').style.display = 'block';
  } else {
    pengeluaranRows.innerHTML = `<div class="lr-item" style="justify-content:center;color:var(--text-secondary);font-size:13px">Belum ada data pengeluaran</div>`;
  }
}

function renderLRChart(posData) {
  const ctx = document.getElementById('chartLR').getContext('2d');
  if (lrChart) lrChart.destroy();
  const palette = ['#0D47A1','#1565C0','#1976D2','#42A5F5','#00BCD4','#26C6DA','#4DD0E1','#ef4444','#f59e0b','#10b981'];
  lrChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: posData.map(p => p.pos),
      datasets: [{ label: 'Pengeluaran', data: posData.map(p => p.total), backgroundColor: palette.slice(0, posData.length).map(c => c + 'CC'), borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + formatRupiah(c.parsed.x) } } },
      scales: { x: { ticks: { callback: v => 'Rp ' + (v/1000000).toFixed(1) + 'jt', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } }
    }
  });
}

function toggleSection(id) {
  const el = document.getElementById(id);
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  const chevron = document.getElementById('chevron' + id.replace('sec',''));
  if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont('helvetica','bold'); doc.setFontSize(20);
  doc.setTextColor(13, 71, 161);
  doc.text('LAPORAN LABA RUGI', 105, 20, { align: 'center' });
  doc.setFont('helvetica','normal'); doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(document.getElementById('lrPeriode').textContent, 105, 28, { align: 'center' });
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 105, 34, { align: 'center' });
  doc.line(14, 38, 196, 38);

  let y = 46;
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(0);
  doc.text('PENDAPATAN', 14, y); y += 6;

  const pendapatanRows = [];
  document.querySelectorAll('#pendapatanRows .lr-item').forEach(row => {
    const label = row.querySelector('.lr-item-label')?.textContent.trim().replace(/\s+/g,' ');
    const value = row.querySelector('.lr-item-value')?.textContent.trim();
    if (label && value) pendapatanRows.push([label, value]);
  });
  doc.autoTable({ body: pendapatanRows, startY: y, margin:{left:20,right:20}, styles:{fontSize:10}, didDrawPage: d => { y = d.cursor.y; } });
  y = (doc.lastAutoTable?.finalY || y) + 4;

  doc.setFillColor(240,253,244); doc.rect(14, y, 182, 10, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(22,163,74);
  doc.text('Total Pendapatan', 18, y + 7);
  doc.text(document.getElementById('totalPendapatanLabel').textContent, 196, y + 7, { align: 'right' });
  y += 18;

  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(0);
  doc.text('PENGELUARAN', 14, y); y += 6;

  const pengeluaranRows = [];
  document.querySelectorAll('#pengeluaranRows .lr-item').forEach(row => {
    const label = row.querySelector('.lr-item-label')?.textContent.trim().replace(/\s+/g,' ');
    const value = row.querySelector('.lr-item-value')?.textContent.trim();
    if (label && value) pengeluaranRows.push([label, value]);
  });
  doc.autoTable({ body: pengeluaranRows, startY: y, margin:{left:20,right:20}, styles:{fontSize:10} });
  y = (doc.lastAutoTable?.finalY || y) + 4;

  doc.setFillColor(254,242,242); doc.rect(14, y, 182, 10, 'F');
  doc.setFont('helvetica','bold'); doc.setTextColor(185,28,28);
  doc.text('Total Pengeluaran', 18, y + 7);
  doc.text(document.getElementById('totalPengeluaranLabel').textContent, 196, y + 7, { align: 'right' });
  y += 18;

  doc.setFillColor(13, 71, 161); doc.rect(14, y, 182, 16, 'F');
  doc.setFontSize(13); doc.setTextColor(255);
  doc.text('LABA BERSIH', 18, y + 11);
  doc.text(document.getElementById('lrNetValue').textContent, 196, y + 11, { align: 'right' });

  doc.save('LabaRugi_' + document.getElementById('lrPeriode').textContent.replace(/\s/g,'_') + '.pdf');
}


document.addEventListener('DOMContentLoaded', () => initPage('labarugi'));

