# POS Cafe & Management System ☕

Aplikasi Kasir (POS), Manajemen Operasional, & Integrasi Google Sheets / Drive untuk **Ruang Senyawa**.

Built with **Next.js (App Router) + PostgreSQL + Prisma + TailwindCSS**.

---

## 🌟 Fitur Utama

- **2 Peran Akses**: `ADMIN` (pemilik/manajer) & `KASIR`.
- **Kasir (POS)**: Layar POS cepat (menu -> varian -> keranjang -> bayar -> struk thermal), rekap penjualan harian, absensi per shift.
- **Rekap Penjualan per Shift & Hari Usaha**: 
  - Penanganan tutup lewat tengah malam (contoh: `dayCutoffHour` jam 6 pagi).
  - **Dukungan Shift Terisolasi (Shift Pagi / Shift Malam)**: Omzet, transaksi, kas masuk/keluar, saldo laci, & item terjual terpisah bersih per shift.
- **Tema Visual**: **Dark Sage Green (`#356A58`)** untuk tampilan yang elegan & konsisten.
- **Manajemen Katalog & Stok**: CRUD Menu & HPP, stok bahan/kemasan, varian menu, dan voucher promo.

---

## 📊 Integrasi Multi-Spreadsheet Google Sheets & Drive (Server-Side)

Server Web mengelola integrasi otomatis dengan **3 File Spreadsheet Custom Pemilik Kafe**:

1. **`Menu & Harga | Ruang Senyawa` (Master Data)**
   - Mengimpor otomatis daftar menu, HPP (Hot/Ice/Kapsul 250ml), & Harga Jual.
2. **`(4) Rekap Harian - Ruang Senyawa` (Matriks Penjualan Harian)**
   - Mengisi otomatis porsi menu terjual per hari pada tab bulan aktif (`Agustus 2026`, `September 2026`...).
3. **`(3) BHP, Bahan Makmin - Ruang Senyawa` (Aset & Bahan Makmin)**
   - Meng-append setiap transaksi pembelian barang/bahan beserta **`Link Nota`**.

### 📸 Auto Upload Foto Nota ke Google Drive
- Saat menginput pengeluaran/restok di Web Admin, **foto nota diunggah langsung ke Google Drive pemilik** (via Google Drive OAuth 2.0).
- URL tampilan nota (`Link Nota`) otomatis tersisip di kolom J Spreadsheet tanpa membebani penyimpanan server!

### 🔄 Tombol Instant Sync Sheet di Web Admin
- Tombol **`[🔄 Sync Sheet]`** tersedia di **header atas Web Admin Dashboard** untuk melakukan sinkronisasi ulang kapan saja dengan sekali klik.

---

## 🚀 Panduan Jalankan Aplikasi

### Jalankan dengan Docker (Rekomendasi)
```bash
docker compose up -d --build
```
Akses di `http://localhost:3080`. Credential default:
- **Admin**: `admin` / `admin123`
- **Kasir**: `kasir` / `kasir123`

### Jalankan Lokal (Dev Mode)
```bash
npm install
npm run db:push
npm run dev
```

---

## 🚢 Deploy ke Server Produksi

Server live: `mint@172.16.1.5` (folder `~/pos-cafe`, hasil `git clone` repo ini) → publik di
**https://ruangsenyawa.iprime.web.id**. Container: `pos-cafe-app-1` (port 3080) + `pos-cafe-db-1` (Postgres).

**1. Dari laptop — commit & push ke GitHub:**
```bash
git add -A
git commit -m "pesan perubahan"
git push origin main
```

**2. Di server — tarik kode & build ulang** (bisa langsung dari laptop lewat SSH):
```bash
ssh mint@172.16.1.5 'cd ~/pos-cafe && git pull --ff-only origin main && docker compose up -d --build'
```
Saat container start, `docker-entrypoint.sh` otomatis menjalankan `prisma db push` (skema DB ikut
terbaru) + seed (aman, tidak menimpa data). Kalau build gagal, container lama tetap jalan.

**Opsional — backup DB dulu** (disarankan kalau ada perubahan skema / data penting):
```bash
ssh mint@172.16.1.5 'mkdir -p ~/pos-cafe-backups && docker exec pos-cafe-db-1 pg_dump -U poscafe poscafe | gzip > ~/pos-cafe-backups/backup-$(date +%Y%m%d-%H%M).sql.gz'
```

**Cek log kalau ada masalah:**
```bash
ssh mint@172.16.1.5 'docker logs --tail 50 pos-cafe-app-1'
```

> Jangan commit `.env`, `backups/`, atau file dump `*.sql(.gz)` — sudah di `.gitignore`.
> File `.env` di server (JWT_SECRET, Google SA, dll.) jangan diubah/ditimpa.

---

## ⏱️ Konsep "Hari Usaha" & Timezone
- **Zona Waktu**: Server berjalan pada `TZ=Asia/Jakarta` (WIB GMT+7).
- **Day Cutoff**: Transaksi sebelum jam `dayCutoffHour` (default 6 pagi) dihitung masuk ke hari usaha sebelumnya.
- **Shift Ranges**: Shift Pagi (`08:00 - 16:00`) & Shift Malam (`16:00 - 24:00`). Transaksi jam 08:00 pagi otomatis tepat tergolong ke Shift Pagi.
