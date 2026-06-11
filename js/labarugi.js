let currentPeriod = 'monthly';
let lrChart = null;
let globalDataRaw = null; // Menyimpan data aktif dari API untuk kebutuhan Export Excel/PDF

document.addEventListener('DOMContentLoaded', () => {
  populateYearSelect();
  setDefaultSelects();
  loadData();
});

function populateYearSelect() {
  const sel = document.getElementById('selectYear');
  if (!sel) return;
  const now = new Date().getFullYear();
  sel.innerHTML = ''; // Clear existing
  for (let y = now; y >= now - 5; y--) {
    sel.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

function setDefaultSelects() {
  const selMonth = document.getElementById('selectMonth');
  if (!selMonth) return;
  const now = new Date();
  selMonth.value = now.getMonth() + 1;
}

function setPeriod(p) {
  currentPeriod = p;
  document.getElementById('tabMonthly')?.classList.toggle('active', p === 'monthly');
  document.getElementById('tabYearly')?.classList.toggle('active', p === 'yearly');
  
  const selMonth = document.getElementById('selectMonth');
  if (selMonth) {
    selMonth.style.display = p === 'monthly' ? 'block' : 'none';
  }
  loadData();
}

// Fungsi Handler untuk Form Input Pembelian LPG 3 Kg
async function handleSimpanPembelian(event) {
  event.preventDefault();
  const tanggal = document.getElementById('beliTanggal').value;
  const qty = document.getElementById('beliQty').value;
  const nominal = document.getElementById('beliNominal').value;

  // Memanggil API simpan data pembelian ke database
  const res = await callAPI('simpanPembelian', { 
    tanggal, 
    qty: parseInt(qty), 
    nominal: parseInt(nominal) 
  });
  
  if (res.success) {
    showToast('Data pembelian berhasil disimpan!', 'success');
    document.getElementById('formPembelian').reset();
    loadData(); // Reload data laporan agar langsung ter-update
  } else {
    showToast('Gagal menyimpan data pembelian.', 'error');
  }
}

async function loadData() {
  const year = document.getElementById('selectYear').value;
  const month = document.getElementById('selectMonth').value;
  
  const periodLabel = document.getElementById('lrPeriode');
  if (periodLabel) periodLabel.textContent = 'Memuat...';
  
  const res = await callAPI('getLabaRugi', { period: currentPeriod, year: parseInt(year), month: parseInt(month) });
  if (!res.success) { showToast('Gagal memuat data.', 'error'); return; }
  
  globalDataRaw = res.data; // Simpan ke scope global untuk kebutuhan unduh berkas
  renderLabaRugi(res.data);
}

function renderLabaRugi(d) {
  // Set label periode aktif
  if (document.getElementById('lrPeriode')) document.getElementById('lrPeriode').textContent = d.periode;
  if (document.getElementById('lrNetPeriode')) document.getElementById('lrNetPeriode').textContent = d.periode;

  // 1. SEKSI PENDAPATAN
  // Mengambil item pendapatan spesifik (LPG Refill & Transport Fee) dari detail data API
  const penjualanLpg = d.penjualanLpg3kg || 0;
  const transportFee = d.transportFee || 0;
  const totalPendapatan = penjualanLpg + transportFee;

  if (document.getElementById('secPendapatanTotal')) document.getElementById('secPendapatanTotal').textContent = formatRupiah(totalPendapatan);
  if (document.getElementById('totalPendapatanLabel')) document.getElementById('totalPendapatanLabel').textContent = formatRupiah(totalPendapatan);

  const pendapatanRows = document.getElementById('pendapatanRows');
  if (pendapatanRows) {
    pendapatanRows.innerHTML = `
      <div class="lr-item">
        <div class="lr-item-label">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--success)" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Penjualan Refill LPG 3 Kg. Pertamina
        </div>
        <div class="lr-item-value">${formatRupiah(penjualanLpg)}</div>
      </div>
      <div class="lr-item">
        <div class="lr-item-label">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--success)" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Penerimaan Transport Fee
        </div>
        <div class="lr-item-value">${formatRupiah(transportFee)}</div>
      </div>
    `;
  }

  // 2. SEKSI HARGA POKOK PEMBELIAN (AMBIL BERDASARKAN FILTER TANGGAL/BULAN)
  const totalPembelian = d.pembelianLpg3kgPeriode || 0;
  const hppElement = document.getElementById('lrPembelianHPP');
  if (hppElement) hppElement.textContent = formatRupiah(totalPembelian);

  // 3. HITUNG LABA (RUGI) KOTOR = Pendapatan - Pembelian
  const labaKotor = totalPendapatan - totalPembelian;
  const labaKotorEl = document.getElementById('lrLabaKotor');
  if (labaKotorEl) {
    labaKotorEl.textContent = formatRupiah(labaKotor);
    labaKotorEl.className = 'lr-kpi-value ' + (labaKotor >= 0 ? 'positive' : 'negative');
  }

  // 4. SEKSI BIAYA / PENGELUARAN OPERASIONAL
  const pengeluaranRows = document.getElementById('pengeluaranRows');
  let totalBiaya = 0;

  if (d.pengeluaranByPos && d.pengeluaranByPos.length) {
    pengeluaranRows.innerHTML = d.pengeluaranByPos.map(p => {
      totalBiaya += p.total;
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

    // Render grafik Chart.js bawaan
    renderLRChart(d.pengeluaranByPos);
    if (document.getElementById('chartSection')) document.getElementById('chartSection').style.display = 'block';
  } else {
    if (pengeluaranRows) {
      pengeluaranRows.innerHTML = `<div class="lr-item" style="justify-content:center;color:var(--text-secondary);font-size:13px">Belum ada data pengeluaran</div>`;
    }
    if (document.getElementById('chartSection')) document.getElementById('chartSection').style.display = 'none';
  }

  if (document.getElementById('secPengeluaranTotal')) document.getElementById('secPengeluaranTotal').textContent = formatRupiah(totalBiaya);
  if (document.getElementById('totalPengeluaranLabel')) document.getElementById('totalPengeluaranLabel').textContent = formatRupiah(totalBiaya);

  // 5. HITUNG LABA (RUGI) USAHA = LABA RUGI KOTOR - BIAYA
  const labaUsaha = labaKotor - totalBiaya;

  const labaEl = document.getElementById('lrLaba');
  if (labaEl) {
    labaEl.textContent = formatRupiah(labaUsaha);
    labaEl.className = 'lr-kpi-value ' + (labaUsaha >= 0 ? 'positive' : 'negative');
  }

  const netEl = document.getElementById('lrNetValue');
  if (netEl) {
    netEl.textContent = formatRupiah(labaUsaha);
    netEl.className = 'lr-net-value ' + (labaUsaha >= 0 ? 'positive' : 'negative');
  }
}

function renderLRChart(posData) {
  const chartEl = document.getElementById('chartLR');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');
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
  if (!el) return;
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  const chevron = document.getElementById('chevron' + id.replace('sec',''));
  if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
}

// =========================================================================
// FUNGSI EXPORT EXCEL MULTI-SHEET (Wajib Sheet LR, Global, & 1 Sheet 1 Pos)
// =========================================================================
function exportExcel() {
  if (!globalDataRaw) {
    showToast('Data tidak tersedia untuk di-export.', 'error');
    return;
  }

  const d = globalDataRaw;
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: LABA RUGI ---
  const penjualanLpg = d.penjualanLpg3kg || 0;
  const transportFee = d.transportFee || 0;
  const totalPendapatan = penjualanLpg + transportFee;
  const totalPembelian = d.pembelianLpg3kgPeriode || 0;
  const labaKotor = totalPendapatan - totalPembelian;
  let totalBiaya = 0;

  const lrRows = [
    ["LAPORAN LABA RUGI USAHA"],
    [`Periode: ${d.periode}`],
    [],
    ["PENDAPATAN", ""],
    ["  - Penjualan Refill LPG 3 Kg. Pertamina", penjualanLpg],
    ["  - Penerimaan Transport Fee", transportFee],
    ["JUMLAH PENDAPATAN", totalPendapatan],
    [],
    ["HARGA POKOK PEMBELIAN", ""],
    ["  - Pembelian LPG 3 Kg", totalPembelian],
    [],
    ["LABA (RUGI) KOTOR", labaKotor],
    [],
    ["BIAYA", ""]
  ];

  if (d.pengeluaranByPos) {
    d.pengeluaranByPos.forEach(p => {
      totalBiaya += p.total;
      lrRows.push([`  - ${p.pos}`, p.total]);
    });
  }
  
  lrRows.push(["TOTAL BIAYA", totalBiaya]);
  lrRows.push([]);
  lrRows.push(["LABA (RUGI) USAHA", labaKotor - totalBiaya]);

  const wsLR = XLSX.utils.aoa_to_sheet(lrRows);
  XLSX.utils.book_append_sheet(wb, wsLR, "Laba Rugi");

  // --- SHEET 2: DATA PENGELUARAN GLOBAL ---
  const globalExpenseRows = [
    ["DATA PENGELUARAN GLOBAL"],
    [`Periode: ${d.periode}`],
    [],
    ["Nama Pos Pengeluaran / Biaya", "Total Pengeluaran (Rp)"]
  ];

  if (d.pengeluaranByPos) {
    d.pengeluaranByPos.forEach(p => {
      globalExpenseRows.push([p.pos, p.total]);
    });
  }
  globalExpenseRows.push(["TOTAL KESELURUHAN BIAYA", totalBiaya]);

  const wsGlobal = XLSX.utils.aoa_to_sheet(globalExpenseRows);
  XLSX.utils.book_append_sheet(wb, wsGlobal, "Data Pengeluaran Global");

  // --- SHEET 3 DST: POS MASUK (1 SHEET = 1 POS MASUK / BIAYA) ---
  // Sheet individual untuk Penjualan LPG
  const wsLpg = XLSX.utils.aoa_to_sheet([
    ["RINCIAN POS MASUK: PENJUALAN REFILL LPG 3 KG"],
    [`Periode: ${d.periode}`],
    [],
    ["Uraian Pendapatan", "Total"],
    ["Penjualan Refill LPG 3 Kg. Pertamina", penjualanLpg]
  ]);
  XLSX.utils.book_append_sheet(wb, wsLpg, "Pos_Penjualan_LPG");

  // Sheet individual untuk Transport Fee
  const wsTransport = XLSX.utils.aoa_to_sheet([
    ["RINCIAN POS MASUK: PENERIMAAN TRANSPORT FEE"],
    [`Periode: ${d.periode}`],
    [],
    ["Uraian Pendapatan", "Total"],
    ["Penerimaan Transport Fee", transportFee]
  ]);
  XLSX.utils.book_append_sheet(wb, wsTransport, "Pos_Transport_Fee");

  // Sheet individual dinamis untuk setiap Pos Biaya Operasional
  if (d.pengeluaranByPos) {
    d.pengeluaranByPos.forEach(p => {
      // Hilangkan karakter ilegal excel untuk penamaan tab sheet (: \ / ? * [ ] dll)
      const safeSheetName = p.pos.replace(/[/\\?*:[\]]/g, "").substring(0, 25);
      const wsCostCenter = XLSX.utils.aoa_to_sheet([
        [`RINCIAN ALOKASI POS: ${p.pos.toUpperCase()}`],
        [`Periode: ${d.periode}`],
        [],
        ["Keterangan Pos", "Total Akumulasi Terpakai"],
        [p.pos, p.total]
      ]);
      XLSX.utils.book_append_sheet(wb, wsCostCenter, `Pos_${safeSheetName}`);
    });
  }

  // Download File Excel
  const fileExcelName = `Laporan_LabaRugi_LPG_${d.periode.replace(/\s/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileExcelName);
}

// =========================================================================
// UPDATE FUNGSI EXPORT PDF AGAR STRUKTURNYA RELEVAN DENGAN ALUR BARU
// =========================================================================
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFont('helvetica','bold'); doc.setFontSize(20);
  doc.setTextColor(13, 71, 161);
  doc.text('LAPORAN LABA RUGI OPERASIONAL', 105, 20, { align: 'center' });
  
  doc.setFont('helvetica','normal'); doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(document.getElementById('lrPeriode')?.textContent || '', 105, 28, { align: 'center' });
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 105, 34, { align: 'center' });
  doc.line(14, 38, 196, 38);

  let y = 46;
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(0);
  doc.text('1. PENDAPATAN', 14, y); y += 6;

  const pendapatanRows = [];
  const penjualanLpg = globalDataRaw?.penjualanLpg3kg || 0;
  const transportFee = globalDataRaw?.transportFee || 0;
  const totalPendapatan = penjualanLpg + transportFee;
  const totalPembelian = globalDataRaw?.pembelianLpg3kgPeriode || 0;
  const labaKotor = totalPendapatan - totalPembelian;

  pendapatanRows.push(["Penjualan Refill LPG 3 Kg. Pertamina", formatRupiah(penjualanLpg)]);
  pendapatanRows.push(["Penerimaan Transport Fee", formatRupiah(transportFee)]);
  pendapatanRows.push(["JUMLAH PENDAPATAN", formatRupiah(totalPendapatan)]);

  doc.autoTable({ body: pendapatanRows, startY: y, margin:{left:20,right:20}, styles:{fontSize:10}, didDrawPage: d => { y = d.cursor.y; } });
  y = (doc.lastAutoTable?.finalY || y) + 6;

  doc.setFont('helvetica','bold'); doc.text('2. HARGA POKOK PEMBELIAN', 14, y); y += 6;
  doc.autoTable({ body: [["Pembelian LPG 3 Kg (Berdasarkan Periode Tgl)", formatRupiah(totalPembelian)]], startY: y, margin:{left:20,right:20}, styles:{fontSize:10} });
  y = (doc.lastAutoTable?.finalY || y) + 6;

  doc.setFillColor(227,242,253); doc.rect(14, y, 182, 10, 'F');
  doc.setFont('helvetica','bold'); doc.setTextColor(13, 71, 161);
  doc.text('LABA (RUGI) KOTOR', 18, y + 7);
  doc.text(formatRupiah(labaKotor), 196, y + 7, { align: 'right' });
  y += 18;

  doc.setFont('helvetica','bold'); doc.setTextColor(0);
  doc.text('3. BIAYA OPERASIONAL', 14, y); y += 6;

  const pengeluaranRows = [];
  let totalBiaya = 0;
  if (globalDataRaw?.pengeluaranByPos) {
    globalDataRaw.pengeluaranByPos.forEach(p => {
      totalBiaya += p.total;
      pengeluaranRows.push([p.pos, formatRupiah(p.total)]);
    });
  }
  pengeluaranRows.push(["TOTAL BIAYA", formatRupiah(totalBiaya)]);

  doc.autoTable({ body: pengeluaranRows, startY: y, margin:{left:20,right:20}, styles:{fontSize:10} });
  y = (doc.lastAutoTable?.finalY || y) + 6;

  const labaUsaha = labaKotor - totalBiaya;
  doc.setFillColor(labaUsaha >= 0 ? 27 : 185, labaUsaha >= 0 ? 94 : 28, labaUsaha >= 0 ? 32 : 28); doc.rect(14, y, 182, 14, 'F');
  doc.setFontSize(12); doc.setTextColor(255);
  doc.text('LABA (RUGI) USAHA', 18, y + 9);
  doc.text(formatRupiah(labaUsaha), 196, y + 9, { align: 'right' });

  const pName = document.getElementById('lrPeriode')?.textContent || 'Periode';
  doc.save('LabaRugi_' + pName.replace(/\s/g,'_') + '.pdf');
}

// Helper utility untuk melengkapi sisa halaman web
function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function showToast(msg, type) {
  console.log(`[${type.toUpperCase()}] ${msg}`);
  if(typeof window.showToastLocal === 'function') window.showToastLocal(msg, type);
}

// Integrasi DOM Binder bawaan sistem multi-page
document.addEventListener('DOMContentLoaded', () => {
  if(typeof initPage === 'function') initPage('labarugi');
  
  // Daftarkan event listener form pembelian jika elemennya eksis di halaman html
  const fPembelian = document.getElementById('formPembelian');
  if(fPembelian) fPembelian.addEventListener('submit', handleSimpanPembelian);
});
