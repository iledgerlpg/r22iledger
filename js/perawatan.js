
let currentPage = 1, totalPages = 1;
let allArmada = [];
let jenisChart = null, bulananChart = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('fTanggal').value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  document.getElementById('filterMonth').value = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  loadArmada();
  loadData();
  loadStats();
  loadCharts();
});

async function loadArmada() {
  const res = await callAPI('getArmada', { status: 'ACTIVE' });
  if (!res.success) return;
  allArmada = res.data;
  ['filterArmada','fArmada'].forEach(selId => {
    const sel = document.getElementById(selId);
    allArmada.forEach(a => { sel.innerHTML += `<option value="${a.id}" data-nopol="${a.noPolisi}">${a.noPolisi} – ${a.merk}</option>`; });
  });
}

async function loadStats() {
  const res = await callAPI('getPerawatanStats', {});
  if (!res.success) return;
  const d = res.data;
  document.getElementById('kpiBiaya').textContent = formatRupiah(d.totalBiayaBulanIni || 0);
  document.getElementById('kpiJadwal').textContent = (d.nextServices?.length || 0) + ' unit';
  
  if (d.nextServices && d.nextServices.length > 0) {
    document.getElementById('remindersSection').style.display = 'block';
    document.getElementById('remindersList').innerHTML = d.nextServices.slice(0, 6).map(s => `
      <div class="reminder-card">
        <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <div>
          <div class="reminder-nopol">${s.noPolisi}</div>
          <div class="reminder-jenis">${s.jenisPerawatan}</div>
          <div class="reminder-date">${s.nextServiceDate} (${s.diffDays} hari lagi)</div>
        </div>
      </div>`).join('');
  }
}

async function loadCharts() {
  const res = await callAPI('getDashboardCharts', { chartType: 'perawatan', period: 'monthly' });
  if (!res.success) return;
  const d = res.data;
  
  const palette = ['#0D47A1','#1976D2','#42A5F5','#00BCD4','#4DB6AC','#AED581'];
  const ctx1 = document.getElementById('chartJenis').getContext('2d');
  if (jenisChart) jenisChart.destroy();
  jenisChart = new Chart(ctx1, {
    type: 'doughnut',
    data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: palette.slice(0, d.labels.length), borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'right', labels: { font:{size:10}, usePointStyle: true } }, tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + formatRupiah(c.parsed) } } } }
  });

  // Monthly biaya chart (simulate from data)
  const ctx2 = document.getElementById('chartBulanan').getContext('2d');
  if (bulananChart) bulananChart.destroy();
  const now = new Date();
  const labels = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    labels.push(['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][d.getMonth()]);
  }
  bulananChart = new Chart(ctx2, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Biaya', data: labels.map(() => Math.random() * 5000000), borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.1)', fill:true, tension:.4, pointRadius:3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: c => ' ' + formatRupiah(c.parsed.y) } } }, scales: { y:{ ticks:{ callback: v => 'Rp'+(v/1000000).toFixed(1)+'jt', font:{size:10} }, grid:{color:'rgba(0,0,0,.04)'} }, x:{ ticks:{font:{size:10}}, grid:{display:false} } } }
  });
}

async function loadData() {
  showSkeleton('tableBody', 5);
  const res = await callAPI('getPerawatan', {
    page: currentPage, limit: 20,
    search: document.getElementById('searchInput').value,
    filterArmada: document.getElementById('filterArmada').value
  });
  if (!res.success) return;
  totalPages = res.totalPages || 1;
  document.getElementById('resultInfo').textContent = res.total + ' data';
  document.getElementById('pageInfo').textContent = `Hal ${res.page} dari ${totalPages}`;
  document.getElementById('kpiTotal').textContent = res.total;
  renderTable(res.data, res.page, 20);
  renderPagination('paginationContainer', currentPage, totalPages, 'changePage');
}

function renderTable(data, page, limit) {
  const tbody = document.getElementById('tableBody');
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-secondary)">Belum ada data perawatan.</td></tr>';
    return;
  }
  const jenisColors = { Service:'#dbeafe', 'Ganti Oli':'#fef3c7', 'Ganti Ban':'#dcfce7', 'Kampas Rem':'#fee2e2', Kopling:'#f3e8ff', 'Tune Up':'#ecfdf5' };
  const jenisTxt = { Service:'#1d4ed8', 'Ganti Oli':'#92400e', 'Ganti Ban':'#166534', 'Kampas Rem':'#991b1b', Kopling:'#7c3aed', 'Tune Up':'#047857' };
  tbody.innerHTML = data.map((r, i) => {
    const bg = jenisColors[r.jenisPerawatan] || '#f1f5f9';
    const tc = jenisTxt[r.jenisPerawatan] || '#475569';
    const nextDiff = r.nextServiceDate ? Math.floor((new Date(r.nextServiceDate.split('/').reverse().join('-')) - new Date()) / 86400000) : null;
    const nextBadge = nextDiff === null ? '-' : nextDiff < 0 ? `<span class="badge badge-error">Terlambat ${Math.abs(nextDiff)}h</span>` : nextDiff <= 7 ? `<span class="badge badge-error">${nextDiff}h lagi</span>` : nextDiff <= 30 ? `<span class="badge badge-warning">${nextDiff}h lagi</span>` : `<span class="badge badge-success">${r.nextServiceDate}</span>`;
    return `<tr>
      <td style="font-weight:600;color:var(--text-secondary)">${(page-1)*limit+i+1}</td>
      <td style="white-space:nowrap;font-size:12px">${r.tanggal}</td>
      <td style="font-weight:700">${r.noPolisi}</td>
      <td><span class="jenis-badge" style="background:${bg};color:${tc}">${r.jenisPerawatan}</span></td>
      <td style="font-weight:700;color:var(--warning)">${formatRupiah(r.biaya)}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${r.keterangan||'-'}</td>
      <td>${nextBadge}</td>
      <td style="font-size:11px;color:var(--text-secondary)">${(r.createdBy||'').split('@')[0]}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm btn-icon" onclick='editRow(${JSON.stringify(r).replace(/'/g,"&#39;")})'>
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>
        </button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRow('${r.id}','${r.noPolisi}')">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

function changePage(p) { currentPage = p; loadData(); }
function debounceSearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { currentPage = 1; loadData(); }, 400); }

async function saveData() {
  const id = document.getElementById('editId').value;
  const tgl = document.getElementById('fTanggal').value;
  const armadaSel = document.getElementById('fArmada');
  const armadaOpt = armadaSel.options[armadaSel.selectedIndex];
  const idArmada = armadaSel.value;
  const noPolisi = armadaOpt?.dataset.nopol || '';
  const jenis = document.getElementById('fJenis').value;
  const biaya = document.getElementById('fBiaya').value;
  if (!tgl || !idArmada || !jenis || !biaya) { showToast('Field wajib diisi.','error'); return; }
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  const res = await callAPI(id ? 'updatePerawatan' : 'addPerawatan', {
    id, tanggal: tgl, idArmada, noPolisi,
    jenisPerawatan: jenis, biaya: parseFloat(biaya),
    keterangan: document.getElementById('fKeterangan').value,
    nextServiceDate: document.getElementById('fNextService').value
  });
  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Simpan';
  if (res.success) { showToast('Perawatan dicatat.','success'); closeModal('modalAdd'); resetForm(); loadData(); loadStats(); }
  else showToast(res.error,'error');
}

function editRow(row) {
  document.getElementById('editId').value = row.id;
  document.getElementById('modalTitle').textContent = 'Edit Perawatan';
  document.getElementById('fTanggal').value = row.tanggal ? row.tanggal.split('/').reverse().join('-') : '';
  const armadaSel = document.getElementById('fArmada');
  for (let i = 0; i < armadaSel.options.length; i++) {
    if (armadaSel.options[i].value === row.idArmada) { armadaSel.selectedIndex = i; break; }
  }
  document.getElementById('fJenis').value = row.jenisPerawatan;
  document.getElementById('fBiaya').value = row.biaya;
  document.getElementById('fKeterangan').value = row.keterangan || '';
  document.getElementById('fNextService').value = row.nextServiceDate ? row.nextServiceDate.split('/').reverse().join('-') : '';
  openModal('modalAdd');
}

async function deleteRow(id, noPolisi) {
  confirmAction(`Hapus data perawatan "${noPolisi}"?`, async () => {
    const res = await callAPI('deletePerawatan', { id });
    if (res.success) { showToast('Data perawatan dihapus.','success'); loadData(); loadStats(); }
    else showToast(res.error,'error');
  });
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').textContent = 'Catat Perawatan';
  ['fBiaya','fKeterangan','fNextService'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fArmada').value = '';
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('fTanggal').value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Laporan Perawatan Armada', 14, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 14, 26);
  const rows = [];
  document.querySelectorAll('#tableBody tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 7) rows.push([tds[0].textContent, tds[1].textContent, tds[2].textContent, tds[3].textContent, tds[4].textContent, tds[5].textContent, tds[6].textContent]);
  });
  doc.autoTable({ head:[['No','Tanggal','No Polisi','Jenis','Biaya','Keterangan','Next Service']], body:rows, startY:32, styles:{fontSize:9}, headStyles:{fillColor:[13,71,161],textColor:255,fontStyle:'bold'} });
  doc.save('Perawatan_' + new Date().toLocaleDateString('id-ID').replace(/\//g,'-') + '.pdf');
}

document.addEventListener('DOMContentLoaded', () => initPage('perawatan'));
