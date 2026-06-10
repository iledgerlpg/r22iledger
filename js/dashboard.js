
// Auth check
if (!requireAuth()) throw new Error('Not authenticated');

// Load navbar
fetch('navbar.html')
  .then(r => r.text())
  .then(html => {
    document.getElementById('navbarMount').innerHTML = html;
    // Execute scripts inside navbar
    document.querySelectorAll('#navbarMount script').forEach(s => {
      const ns = document.createElement('script');
      ns.textContent = s.textContent;
      document.body.appendChild(ns);
    });
  });

let currentFilter = 'monthly';
let trendChart, posChart, bbmChart, perawatanChart, pajakChart;

document.addEventListener('DOMContentLoaded', () => {
  // Set user info in header
  const user = getUser();
  if (user.name) {
    const h = new Date().getHours();
    const gr = h < 12 ? 'Selamat pagi' : h < 18 ? 'Selamat siang' : 'Selamat malam';
    document.getElementById('dashSubtitle').textContent = `${gr}, ${user.name.split(' ')[0]}! Berikut ringkasan bisnis Anda.`;
  }
  loadDashboard();
});

async function loadDashboard() {
  try {
    const [dash, pajak] = await Promise.all([
      callAPI('getDashboardData', { filter: currentFilter }),
      callAPI('getPajakReminders', {})
    ]);

    if (dash.success) {
      renderKPIs(dash.data.kpi);
      renderTrendChart(dash.data.trendData);
      renderPosChart(dash.data.pengeluaranByPos);
      renderLRSummary(dash.data.kpi);
      document.getElementById('lastUpdated').textContent = 'Update: ' + new Date().toLocaleTimeString('id-ID');
    }

    if (pajak.success) {
      renderReminders(pajak.data);
      if (pajak.data.length > 0) document.getElementById('notifDot').style.display = 'block';
    }

    loadCharts();
  } catch(e) {
    showToast('Gagal memuat dashboard.', 'error');
  }
}

function renderKPIs(kpi) {
  const cards = [
    { label:'Total Pendapatan', value: formatRupiah(kpi.totalPendapatan), bg:'#DBEAFE', c:'#1D4ED8', icon:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
    { label:'Total Pengeluaran', value: formatRupiah(kpi.totalPengeluaran), bg:'#FEE2E2', c:'#DC2626', icon:'<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>' },
    { label:'Laba Bersih', value: formatRupiah(kpi.labaBersih), bg: kpi.labaBersih >= 0 ? '#DCFCE7':'#FEE2E2', c: kpi.labaBersih >= 0 ? '#16A34A':'#DC2626', icon:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    { label:'Jumlah Armada', value: kpi.jumlahArmada+' Unit', bg:'#FEF3C7', c:'#D97706', icon:'<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
    { label:'Jumlah Karyawan', value: kpi.jumlahKaryawan+' Orang', bg:'#F0FDF4', c:'#16A34A', icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
    { label:'BBM Bulan Ini', value: formatRupiah(kpi.bbmBulanIni), bg:'#FFF7ED', c:'#EA580C', icon:'<path d="M3 22V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"/><rect x="6" y="9" width="5" height="4"/>' },
    { label:'Pengeluaran Bulan Ini', value: formatRupiah(kpi.pengeluaranBulanIni), bg:'#F5F3FF', c:'#7C3AED', icon:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>' },
    { label:'Filter Aktif', value: {daily:'Harian',weekly:'Mingguan',monthly:'Bulanan',yearly:'Tahunan'}[currentFilter], bg:'#EFF6FF', c:'#2563EB', icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  ];
  document.getElementById('kpiGrid').innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-icon" style="background:${c.bg};color:${c.c}">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8">${c.icon}</svg>
      </div>
      <div><div class="kpi-label">${c.label}</div><div class="kpi-value sm">${c.value}</div></div>
    </div>`).join('');
}

function renderTrendChart(data) {
  const ctx = document.getElementById('chartTrend').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type:'line',
    data: { labels: data.months, datasets: [
      { label:'Pendapatan', data: data.pendapatanData, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.08)', fill:true, tension:.4, pointRadius:3 },
      { label:'Pengeluaran', data: data.pengeluaranData, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.08)', fill:true, tension:.4, pointRadius:3 }
    ]},
    options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{position:'top',labels:{usePointStyle:true,font:{size:11}}}, tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+formatRupiah(c.parsed.y)}} },
      scales:{ x:{grid:{display:false},ticks:{font:{size:10}}}, y:{ticks:{callback:v=>'Rp'+(v/1000000).toFixed(1)+'jt',font:{size:10}},grid:{color:'rgba(0,0,0,.04)'}} }
    }
  });
}

function renderPosChart(posData) {
  const ctx = document.getElementById('chartPos').getContext('2d');
  if (posChart) posChart.destroy();
  if (!posData || !posData.length) return;
  const palette = ['#0D47A1','#1565C0','#1976D2','#42A5F5','#00BCD4','#26C6DA','#80DEEA','#4DD0E1'];
  posChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels: posData.map(p=>p.pos), datasets:[{ data: posData.map(p=>p.total), backgroundColor: palette.slice(0,posData.length), borderWidth:2, borderColor:'#fff' }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{ legend:{position:'bottom',labels:{font:{size:10},usePointStyle:true}}, tooltip:{callbacks:{label:c=>' '+c.label+': '+formatRupiah(c.parsed)}} }
    }
  });
}

function renderLRSummary(kpi) {
  const lr = document.getElementById('lrSummary');
  const lab = kpi.labaBersih >= 0 ? 'var(--success)' : 'var(--error)';
  lr.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px">
      <span style="color:var(--text-secondary)">Total Pendapatan</span>
      <span style="font-weight:700;color:var(--success)">${formatRupiah(kpi.totalPendapatan)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px">
      <span style="color:var(--text-secondary)">Total Pengeluaran</span>
      <span style="font-weight:700;color:var(--error)">${formatRupiah(kpi.totalPengeluaran)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:15px;font-weight:800">
      <span>Laba Bersih</span>
      <span style="color:${lab}">${formatRupiah(kpi.labaBersih)}</span>
    </div>`;
}

function renderReminders(data) {
  const el = document.getElementById('reminderList');
  if (!data || !data.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px">✅ Tidak ada reminder saat ini</div>';
    return;
  }
  el.innerHTML = data.slice(0,4).map(r => {
    const isDanger = r.statusSTNK === 'TERLAMBAT' || r.statusKIR === 'TERLAMBAT';
    const cls = isDanger ? 'danger' : 'warning';
    const diff = r.diffSTNK !== null ? r.diffSTNK : r.diffKIR;
    const diffText = diff === null ? '' : diff < 0 ? Math.abs(diff)+' hari terlambat' : diff+' hari lagi';
    return `<div class="reminder-item ${cls}">
      <span class="rem-dot ${cls}"></span>
      <div class="rem-detail">
        <div class="rem-title">${r.noPolisi}</div>
        <div class="rem-desc">STNK: ${r.tanggalSTNK||'-'} · KIR: ${r.tanggalKIR||'-'}</div>
      </div>
      <span class="rem-days ${cls}">${diffText}</span>
    </div>`;
  }).join('');
}

async function loadCharts() {
  const [bbm, perawatan, pajak] = await Promise.all([
    callAPI('getDashboardCharts', { chartType:'bbm', period: currentFilter }),
    callAPI('getDashboardCharts', { chartType:'perawatan', period: currentFilter }),
    callAPI('getDashboardCharts', { chartType:'pajak', period: currentFilter })
  ]);
  if (bbm.success) renderBBMChart(bbm.data);
  if (perawatan.success) renderPerawatanChart(perawatan.data);
  if (pajak.success) renderPajakChart(pajak.data);
}

function renderBBMChart(d) {
  const ctx = document.getElementById('chartBBM').getContext('2d');
  if (bbmChart) bbmChart.destroy();
  bbmChart = new Chart(ctx, { type:'bar', data:{ labels:d.labels, datasets:[{ label:'Liter', data:d.liter, backgroundColor:'rgba(234,88,12,.7)', borderRadius:4, yAxisID:'y' }, { label:'Biaya', data:d.biaya, type:'line', borderColor:'#0D47A1', backgroundColor:'transparent', tension:.4, yAxisID:'y1' }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{font:{size:10}}}}, scales:{ y:{grid:{display:false},ticks:{font:{size:9}}}, y1:{position:'right',grid:{display:false},ticks:{callback:v=>(v/1000000).toFixed(1)+'jt',font:{size:9}}}, x:{grid:{display:false},ticks:{font:{size:9}}} } } });
}

function renderPerawatanChart(d) {
  const ctx = document.getElementById('chartPerawatan').getContext('2d');
  if (perawatanChart) perawatanChart.destroy();
  const pal = ['#0D47A1','#1976D2','#42A5F5','#00BCD4','#4DB6AC','#AED581'];
  perawatanChart = new Chart(ctx, { type:'polarArea', data:{ labels:d.labels, datasets:[{ data:d.values, backgroundColor:pal.map(c=>c+'CC') }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{font:{size:9}}} } } });
}

function renderPajakChart(d) {
  const ctx = document.getElementById('chartPajak').getContext('2d');
  if (pajakChart) pajakChart.destroy();
  pajakChart = new Chart(ctx, { type:'doughnut', data:{ labels:['Aman','Segera','Terlambat'], datasets:[{ data:[d.aman,d.segeraJatuhTempo,d.terlambat], backgroundColor:['#10b981','#f59e0b','#ef4444'], borderWidth:2, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{position:'bottom',labels:{font:{size:9},usePointStyle:true}} } } });
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  loadDashboard();
}
