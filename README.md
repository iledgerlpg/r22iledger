# iLedgerV2 — GitHub Pages Version

## ⚡ Setup (3 Langkah)

### 1. Set URL Apps Script

Buka **`js/config.js`** → ganti baris ini:

```javascript
APP_SCRIPT_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_URL_KAMU/exec',
```

Ganti `GANTI_DENGAN_URL_KAMU` dengan URL deployment Apps Script kamu.

---

### 2. Upload ke GitHub

```
iLedgerV2-GitHub/
├── index.html
├── login.html
├── dashboard.html
├── pengeluaran.html
├── pemasukan.html
├── pos.html
├── armada.html
├── bbm.html
├── perawatan.html
├── pajak.html
├── karyawan.html
├── labarugi.html
├── settings.html
├── userManagement.html
├── registerPT.html
├── forgotPassword.html
├── resetPassword.html
├── navbar.html
├── manifest.json
├── service-worker.js
├── css/
│   └── style.css
└── js/
    ├── config.js
    └── page-template.js
```

Upload **semua file** ke root repository GitHub kamu.

---

### 3. Aktifkan GitHub Pages

1. Buka repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → folder: **/ (root)**
4. Klik **Save**
5. URL aplikasi: `https://username.github.io/nama-repo/`

---

## 🔧 Update URL Apps Script

Setiap kali redeploy Apps Script (dapat URL baru), update **`js/config.js`** dan push ke GitHub.

---

## ✅ Fitur

- Login / Register PT / Lupa Password
- Dashboard dengan Charts (Chart.js)
- Pengeluaran + Smart Pos Detection
- Pendapatan
- Kelola Pos + Mapping
- Data Armada (grid & list view)
- BBM Management
- Perawatan Armada
- Pajak Kendaraan + Countdown
- Laba Rugi + PDF Export
- Kelola Karyawan (HRD only)
- User Management + Approval
- Pengaturan + Audit Log
- Dark Mode
- PWA (installable)
- Responsive (mobile + desktop)

---

## ⚠️ Penting

- Pastikan Apps Script deploy dengan **"Who has access: Anyone"**
- Apps Script sudah otomatis allow CORS dari GitHub Pages
- Semua data tersimpan di Google Spreadsheet, bukan di GitHub
