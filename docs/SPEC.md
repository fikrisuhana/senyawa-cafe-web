# POS Cafe — Spesifikasi & Arah Program

Dokumen ringkas biar arah jelas dan gampang diselaraskan dengan versi tim besok.

## 1. Tujuan
Catat keuangan & operasional cafe: penjualan kopi + makanan, dengan kasir dan pemilik.

## 2. Peran
| Peran | Akses |
|------|-------|
| ADMIN (pemilik) | Semua: menu, harga, stok kemasan, user, pengaturan, rekap penjualan + untung, rekap absensi |
| KASIR | POS jualan, lihat penjualan (tanpa untung), absensi shift dirinya |

## 3. Modul
1. **POS / Kasir** — grid menu per kategori, keranjang, bayar (tunai/QRIS/transfer), cetak struk. Menu dengan kemasan menampilkan sisa porsi = `floor(stok_kemasan / qty_per_porsi)`.
2. **Rekap penjualan** — agregasi per hari usaha + rentang tanggal; breakdown kategori/metode/kasir; untung kotor (khusus admin).
3. **Menu (admin)** — CRUD, harga jual, modal (opsional untuk untung), kategori bebas, kaitan kemasan + qty per porsi, aktif/nonaktif.
4. **Stok kemasan (admin)** — hanya bahan yang dihitung (cup, wadah). Potong otomatis saat jual. Update manual via Excel (download → edit → upload) atau penyesuaian +/− / set langsung. Semua tercatat di `StockMovement`.
5. **Absensi** — kasir clock-in/clock-out per shift; admin lihat rekap jam kerja.
6. **User & Pengaturan** — kelola akun; nama cafe, jam buka/tutup, `dayCutoffHour`, footer struk.

## 4. Model data (Prisma)
`User`, `MenuItem` (→ `Packaging`), `Packaging`, `StockMovement`, `Transaction` + `TransactionItem`, `Attendance`, `Setting`. Lihat `prisma/schema.prisma`.

Catatan desain:
- `Transaction` menyimpan **snapshot** nama/harga/modal item → aman walau menu diubah nanti.
- `businessDate` disimpan sebagai string `YYYY-MM-DD` untuk grouping cepat.
- Stok = **integer** (kemasan bersifat butiran), beda dari template lama yang pakai resep bahan cair.

## 5. Keputusan yang diambil sekarang (bisa diubah tim)
- **Menu & harga dikelola di app** oleh admin (bukan Google Sheet). Spreadsheet dipakai khusus **impor stok kemasan manual**.
- Stok disederhanakan ke **kemasan** saja, bukan resep bahan penuh.
- Auth JWT httpOnly + bcrypt, role via middleware.
- Belum ada: multi-cabang, pajak/diskon, shift-cash drawer, laporan export PDF. Sisakan untuk iterasi.

## 6. Titik penyesuaian dengan versi tim (besok)
- Skema menu/harga temanmu → sesuaikan `MenuItem` + seed.
- Kalau stok mau resep bahan penuh → hidupkan lagi model `Ingredient`/`Recipe` (ada di template `kasir-app`).
- Format struk / printer thermal → sesuaikan `src/app/receipt/[code]/page.tsx`.

## 7. Deploy (server dev 172.16.1.5 / mint, tanpa password)
Port app: **3080** (80/443 sudah dipakai nginx-proxy global di server itu). Postgres internal (tanpa port host).
```bash
# dari mesin lokal
rsync -az --exclude node_modules --exclude .next --exclude .git ./ mint@172.16.1.5:~/pos-cafe/
ssh mint@172.16.1.5 'cd ~/pos-cafe && docker compose up -d --build && docker compose logs -f app'
```
Akses: `http://172.16.1.5:3080`.
