# POS Cafe ☕

Aplikasi kasir & keuangan cafe sederhana. Next.js (App Router) + PostgreSQL + Prisma + Docker.

> Template awal — dibuat untuk disesuaikan bareng tim. Lihat [`docs/SPEC.md`](docs/SPEC.md)
> untuk cakupan & arah pengembangan.

## Fitur
- **2 peran**: `ADMIN` (pemilik) & `KASIR`.
- **Kasir**: layar POS (pilih menu → keranjang → bayar → struk), lihat penjualan hari ini, absensi shift.
- **Rekap penjualan**: per **hari usaha** (tutup lewat tengah malam ditangani), bisa pilih rentang tanggal. Untung kotor hanya tampil untuk admin.
- **Admin – Menu**: CRUD menu (kopi/makanan/dll) + atur harga & modal, aktif/nonaktif, kaitkan kemasan.
- **Admin – Stok kemasan**: hanya bahan yang dihitung (cup, wadah makan, dll). Setiap penjualan otomatis memotong stok kemasan. Update stok manual: **unduh template Excel → edit di Excel → unggah lagi**.
- **Admin – Absensi**: rekap jam kerja kasir.
- **Admin – User** & **Pengaturan** (nama cafe, jam buka/tutup, jam pemisah hari usaha, footer struk).

## Jalankan dengan Docker (paling gampang)
```bash
docker compose up -d --build
```
Buka `http://<host>:3080`. Login default:
- Admin: `admin` / `admin123`
- Kasir: `kasir` / `kasir123`

> Ganti `JWT_SECRET` di `docker-compose.yml` sebelum dipakai serius, dan ganti password default.

## Jalankan lokal (tanpa Docker)
Butuh PostgreSQL jalan. Salin `.env.example` → `.env`, sesuaikan `DATABASE_URL`, lalu:
```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

## Konsep "hari usaha"
Cafe buka 9 pagi–1 pagi, jadi 1 hari kerja melewati tengah malam. Setelan **`dayCutoffHour`**
(default `6`) memisahkan hari: transaksi sebelum jam 6 pagi dihitung sebagai hari kemarin.
Bisa diubah di menu **Pengaturan**. Server diset `TZ=Asia/Jakarta`.

## Impor stok dari Excel
Kolom yang dibaca (huruf besar/kecil bebas): `nama`, `satuan`, `stok`, `stok_min`.
Stok akan **di-set** sesuai isi file (bukan ditambah), dan tercatat di riwayat pergerakan stok.

## Deploy singkat (server dev `172.16.1.5`)
Lihat bagian akhir `docs/SPEC.md`. Ringkas:
```bash
rsync -az --exclude node_modules --exclude .next ./ mint@172.16.1.5:~/pos-cafe/
ssh mint@172.16.1.5 'cd ~/pos-cafe && docker compose up -d --build'
```
