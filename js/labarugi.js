let currentPeriod = 'monthly';
let lrChart = null;
let globalDataRaw = null; // Menyimpan data aktif dari API untuk kebutuhan Export Excel/PDF

document.addEventListener('DOMContentLoaded', () => {
  populateYearSelect();
  setDefaultSelects();
  loadData();
  
  if (typeof initPage === 'function') initPage('labarugi');
  
  const fPembelian = document.getElementById('formPembelian');
  if (fPembelian) fPembelian.addEventListener('submit', handleSimpanPembelian);
});

function populateYearSelect() {
  const sel = document.getElementById('selectYear');
  if (!sel) return;
  const now = new Date().getFullYear();
  sel.innerHTML = ''; 
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

async function handleSimpanPembelian(event) {
  event.preventDefault();
  const tanggal = document.getElementById('beliTanggal').value;
  const qty = document.getElementById('beliQty').value;
  const nominal = document.getElementById('beliNominal').value;

  const res = await callAPI('simpanPembelian', { 
    tanggal, 
    qty: parseInt(qty), 
    nominal: parseInt(nominal) 
  });
  
  if (res.success) {
    showToast('Data pembelian berhasil disimpan!', 'success');
    document.getElementById('formPembelian').reset();
    loadData(); 
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
  
  globalDataRaw = res.data; 
  renderLabaRugi(res.data);
}

function renderLabaRugi(d) {
  if (!d) return;

  if (document.getElementById('lrPeriode')) document.getElementById('lrPeriode').textContent = d.periode;
  if (document.getElementById('lrNetPeriode')) document.getElementById('lrNetPeriode').textContent = d.periode;

  // =========================================================================
  // 1. URAIAN PENDAPATAN (LANGSUNG DIURAI PER BARIS DARI SHEET PEMASUKAN)
  // =========================================================================
  let totalPendapatan = 0;
  const pendapatanRows = document.getElementById('pendapatanRows');
  
  if (d.pendapatanByUraian && d.pendapatanByUraian.length) {
    pendapatanRows.innerHTML = d.pendapatanByUraian.map(p => {
      const nilaiNominal = p.nominal || 0; 
      totalPendapatan += nilaiNominal; 
      return `
        <div class="lr-item">
          <div class="lr-item-label">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--success)" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${p.uraian}
          </div>
          <div class="lr-item-value">${formatRupiah(nilaiNominal)}</div>
        </div>
      `;
    }).join('');
  } else {
    if (pendapatanRows) {
      pendapatanRows.innerHTML = `<div class="lr-item" style="justify-content:center;color:var(--text-secondary);font-size:13px">Belum ada data pendapatan</div>`;
    }
  }

  if (document.getElementById('secPendapatanTotal')) document.getElementById('secPendapatanTotal').textContent = formatRupiah(totalPendapatan);
  if (document.getElementById('totalPendapatanLabel')) document.getElementById('totalPendapatanLabel').textContent = formatRupiah(totalPendapatan);

  // =========================================================================
  // 2. PEMBELIAN (DARI SHEET PEMBELIAN)
  // =========================================================================
  const totalPembelian = d.totalPembelianSheet || d.totalHpp || 0; 
  const hppElement = document.getElementById('lrPembelianHPP');
  if (hppElement) hppElement.textContent = formatRupiah(totalPembelian);

  // 3. HITUNG LABA (RUGI) KOTOR
  const labaKotor = totalPendapatan - totalPembelian;
  const labaKotorEl = document.getElementById('lrLabaKotor');
  if (labaKotorEl) {
    labaKotorEl.textContent = formatRupiah(labaKotor);
    labaKotorEl.className = 'lr-kpi-value ' + (labaKotor >= 0 ? 'positive' : 'negative');
  }

  // =========================================================================
  // 4. BIAYA OPERASIONAL (DARI SHEET PENGELUARAN - PER POS)
  // =========================================================================
  const pengeluaranRows = document.getElementById('pengeluaranRows');
  let totalBiaya = 0;

  // Toleransi multi-nama properti array pengeluaran dari backend + fallback kalkulasi otomatis (.reduce)
  const dataBiaya = d.pengeluaranByPos || d.biayaByKategori || d.pengeluaranByUraian || [];
  const baseTotalPengeluaran = d.totalPengeluaran || d.totalBiaya || dataBiaya.reduce((sum, item) => sum + (item.total || item.nominal || 0), 0);

  if (dataBiaya.length) {
    pengeluaranRows.innerHTML = dataBiaya.map(p => {
      const nilaiBiaya = p.total || p.nominal || 0;
      const namaPos = p.pos || p.kategori || p.uraian || 'Operasional';
      totalBiaya += nilaiBiaya;
      
      const pct = baseTotalPengeluaran > 0 ? ((nilaiBiaya / baseTotalPengeluaran) * 100).toFixed(1) : 0;
      const barWidth = Math.min(100, parseFloat(pct));
      
      return `<div class="lr-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="lr-item-label">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--error)" fill="none" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/></svg>
            ${namaPos}
            <span class="lr-item-pct">${pct}%</span>
          </div>
          <div class="lr-item-value red">${formatRupiah(nilaiBiaya)}</div>
        </div>
        <div style="height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${barWidth}%;background:linear-gradient(90deg,#ef4444,#f87171);border-radius:2px;transition:width .6s ease"></div>
        </div>
      </div>`;
    }).join('');

    // Mapping data agar struktur key property Chart.js seragam (.pos & .total)
    const normalizedChartData = dataBiaya.map(p => ({
      pos: p.pos || p.kategori || p.uraian || 'Operasional',
      total: p.total || p.nominal || 0
    }));

    renderLRChart(normalizedChartData);
    if (document.getElementById('chartSection')) document.getElementById('chartSection').style.display = 'block';
  } else {
    if (pengeluaranRows) {
      pengeluaranRows.innerHTML = `<div class="lr-item" style="justify-content:center;color:var(--text-secondary);font-size:13px">Belum ada data pengeluaran</div>`;
    }
    if (document.getElementById('chartSection')) document.getElementById('chartSection').style.display = 'none';
  }

  if (document.getElementById('secPengeluaranTotal')) document.getElementById('secPengeluaranTotal').textContent = formatRupiah(totalBiaya);
  if (document.getElementById('totalPengeluaranLabel')) document.getElementById('totalPengeluaranLabel').textContent = formatRupiah(totalBiaya);

  // =========================================================================
  // 5. HITUNG LABA (RUGI) USAHA FINAL (DUPLIKASI SUDAH DIBERSIHKAN)
  // =========================================================================
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
  const bgColors = posData.map((_, i) => palette[i % palette.length] + 'CC');

  lrChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: posData.map(p => p.pos),
      datasets: [{ 
        label: 'Pengeluaran', 
        data: posData.map(p => p.total), 
        backgroundColor: bgColors, 
        borderRadius: 6, 
        borderSkipped: false 
      }]
    },
    options: {
      responsive: true, 
      maintainAspectRatio: false, 
      indexAxis: 'y',
      plugins: { 
        legend: { display: false }, 
        tooltip: { callbacks: { label: c => ' ' + formatRupiah(c.parsed.x) } } 
      },
      scales: { 
        x: { ticks: { callback: v => 'Rp ' + (v/1000000).toFixed(1) + 'jt', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } }, 
        y: { ticks: { font: { size: 11 } }, grid: { display: false } } 
      }
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
// EXPORT EXCEL MULTI-SHEET DINAMIS 
// =========================================================================
function exportExcel() {
  if (!globalDataRaw) {
    showToast('Data tidak tersedia untuk di-export.', 'error');
    return;
  }

  const d = globalDataRaw;
  const wb = XLSX.utils.book_new();
  const dataBiaya = d.pengeluaranByPos || d.biayaByKategori || d.pengeluaranByUraian || [];

  // --- SHEET 1: LABA RUGI ---
  const lrRows = [
    ["LAPORAN LABA RUGI USAHA"],
    ["Periode: " + (d.periode || '')],
    [],
    ["PENDAPATAN", ""]
  ];

  let totalPendapatan = 0;
  if (d.pendapatanByUraian && d.pendapatanByUraian.length) {
    d.pendapatanByUraian.forEach(p => {
      const nilaiNominal = p.nominal || 0;
      totalPendapatan += nilaiNominal;
      lrRows.push([`  - ${p.uraian}`, nilaiNominal]);
    });
  }
  lrRows.push(["JUMLAH PENDAPATAN", totalPendapatan]);
  lrRows.push([]);
  
  const totalPembelian = d.totalPembelianSheet || d.totalHpp || 0;
  const labaKotor = totalPendapatan - totalPembelian;

  lrRows.push(["HARGA POKOK PEMBELIAN", ""]);
  lrRows.push(["  - Total Pembelian", totalPembelian]);
  lrRows.push([]);
  lrRows.push(["LABA (RUGI) KOTOR", labaKotor]);
  lrRows.push([]);
  lrRows.push(["BIAYA OPERASIONAL", ""]);

  let totalBiaya = 0;
  if (dataBiaya.length) {
    dataBiaya.forEach(p => {
      const nilaiBiaya = p.total || p.nominal || 0;
      const namaPos = p.pos || p.kategori || p.uraian || 'Operasional';
      totalBiaya += nilaiBiaya;
      lrRows.push([`  - ${namaPos}`, nilaiBiaya]);
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
    ["Periode: " + (d.periode || '')],
    [],
    ["Nama Pos Pengeluaran / Biaya", "Total Pengeluaran (Rp)"]
  ];

  if (dataBiaya.length) {
    dataBiaya.forEach(p => {
      globalExpenseRows.push([p.pos || p.kategori || p.uraian || 'Operasional', p.total || p.nominal || 0]);
    });
  }
  globalExpenseRows.push(["TOTAL KESELURUHAN BIAYA", totalBiaya]);

  const wsGlobal = XLSX.utils.aoa_to_sheet(globalExpenseRows);
  XLSX.utils.book_append_sheet(wb, wsGlobal, "Data Pengeluaran Global");

  // --- SHEET 3 DST: POS MASUK INDIVIDUAL ---
  if (d.pendapatanByUraian) {
    d.pendapatanByUraian.forEach(p => {
      const safeSheetName = p.uraian.replace(/[/\\?*:[\]]/g, "").substring(0, 23);
      const wsIncomeCenter = XLSX.utils.aoa_to_sheet([
        [`RINCIAN DATA MASUK: ${p.uraian.toUpperCase()}`],
        ["Periode: " + (d.periode || '')],
        [],
        ["Uraian Pemasukan", "Total Nominal (Rp)"],
        [p.uraian, p.nominal || 0]
      ]);
      XLSX.utils.book_append_sheet(wb, wsIncomeCenter, `In_${safeSheetName}`);
    });
  }

  // --- SHEET GRUP BIAYA ---
  if (dataBiaya.length) {
    dataBiaya.forEach(p => {
      const namaPos = p.pos || p.kategori || p.uraian || 'Operasional';
      const safeSheetName = namaPos.replace(/[/\\?*:[\]]/g, "").substring(0, 23);
      const wsCostCenter = XLSX.utils.aoa_to_sheet([
        [`RINCIAN ALOKASI BIAYA: ${namaPos.toUpperCase()}`],
        ["Periode: " + (d.periode || '')],
        [],
        ["Nama Pos", "Total Akumulasi Terpakai"],
        [namaPos, p.total || p.nominal || 0]
      ]);
      XLSX.utils.book_append_sheet(wb, wsCostCenter, `Out_${safeSheetName}`);
    });
  }

  const fileExcelName = `Laporan_LabaRugi_Dinamis_${(d.periode || 'Undated').replace(/\s/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileExcelName);
}

// =========================================================================
// EXPORT PDF DINAMIS
// =========================================================================
function exportPDF() {
  if (!globalDataRaw) {
    showToast('Data tidak tersedia untuk di-export.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const d = globalDataRaw;
  const dataBiaya = d.pengeluaranByPos || d.biayaByKategori || d.pengeluaranByUraian || [];
  
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
  let totalPendapatan = 0;
  
  if (d.pendapatanByUraian && d.pendapatanByUraian.length) {
    d.pendapatanByUraian.forEach(p => {
      const nilaiNominal = p.nominal || 0;
      totalPendapatan += nilaiNominal;
      pendapatanRows.push([p.uraian, formatRupiah(nilaiNominal)]);
    });
  }
  pendapatanRows.push(["JUMLAH PENDAPATAN", formatRupiah(totalPendapatan)]);

  doc.autoTable({ 
    body: pendapatanRows, 
    startY: y, 
    margin:{left:20,right:20}, 
    styles:{fontSize:10}, 
    didDrawPage: data => { y = data.cursor.y; } 
  });
  y = (doc.lastAutoTable?.finalY || y) + 6;

  const totalPembelian = d.totalPembelianSheet || d.totalHpp || 0;
  const labaKotor = totalPendapatan - totalPembelian;

  doc.setFont('helvetica','bold'); doc.text('2. HARGA POKOK PEMBELIAN', 14, y); y += 6;
  doc.autoTable({ 
    body: [["Total Pembelian (Berdasarkan Sheet Pembelian)", formatRupiah(totalPembelian)]], 
    startY: y, 
    margin:{left:20,right:20}, 
    styles:{fontSize:10} 
  });
  y = (doc.lastAutoTable?.finalY || y) + 6;

  doc.setFillColor(227,242,253); doc.rect(14, y, 182, 10, 'F');
  doc.setFont('helvetica','bold'); doc.setTextColor(13, 71, 161);
  doc.text('LABA (RUGI) KOTOR', 18, y + 7);
  doc.text(formatRupiah(labaKotor), 196, y + 7, { align: 'right' });
  y += 18;

  doc.setFont('helvetica','bold'); doc.setTextColor(0);
  doc.text('3. BIAYA OPERASIONAL', 14, y); y += 6;

  const pengeluaranRowsData = [];
  let totalBiaya = 0;
  if (dataBiaya.length) {
    dataBiaya.forEach(p => {
      const nilaiBiaya = p.total || p.nominal || 0;
      totalBiaya += nilaiBiaya;
      pengeluaranRowsData.push([p.pos || p.kategori || p.uraian || 'Operasional', formatRupiah(nilaiBiaya)]);
    });
  }
  pengeluaranRowsData.push(["TOTAL BIAYA", formatRupiah(totalBiaya)]);

  doc.autoTable({ body: pengeluaranRowsData, startY: y, margin:{left:20,right:20}, styles:{fontSize:10} });
  y = (doc.lastAutoTable?.finalY || y) + 6;

  const labaUsaha = labaKotor - totalBiaya;
  doc.setFillColor(labaUsaha >= 0 ? 27 : 185, labaUsaha >= 0 ? 94 : 28, labaUsaha >= 0 ? 32 : 28); doc.rect(14, y, 182, 14, 'F');
  doc.setFontSize(12); doc.setTextColor(255);
  doc.text('LABA (RUGI) USAHA', 18, y + 9);
  doc.text(formatRupiah(labaUsaha), 196, y + 9, { align: 'right' });

  const pName = document.getElementById('lrPeriode')?.textContent || 'Periode';
  doc.save('LabaRugi_' + pName.replace(/\s/g,'_') + '.pdf');
}

function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

// Fungsi toast bawaan sistem
function showToast(msg, type) {
  console.log(`[${type.toUpperCase()}] ${msg}`);
  if(typeof window.showToastLocal === 'function') window.showToastLocal(msg, type);
}
