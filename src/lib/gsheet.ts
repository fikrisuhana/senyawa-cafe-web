import { google } from "googleapis";
import { prisma } from "./db";

/**
 * Ekspor otomatis ke Google Sheet pakai SERVICE ACCOUNT (tanpa OAuth interaktif).
 * Aktif kalau env GOOGLE_SA_JSON_B64 (base64 JSON key) di-set. Spreadsheet dibuat
 * otomatis, di-share ke OWNER_EMAIL, id disimpan di Setting 'gsheet_id'.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const TX_HEADER = [
  "kode", "hari_usaha", "waktu", "kasir", "tipe", "metode",
  "subtotal", "diskon", "voucher", "total", "modal", "status",
];

function creds(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  const raw = b64 ? Buffer.from(b64, "base64").toString("utf8") : process.env.GOOGLE_SA_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (j.client_email && j.private_key) {
      return { client_email: j.client_email, private_key: j.private_key };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function sheetEnabled(): boolean {
  return !!creds();
}

function jwt() {
  const c = creds();
  if (!c) return null;
  return new google.auth.JWT({ email: c.client_email, key: c.private_key, scopes: SCOPES });
}

async function getSetting(key: string): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? "";
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export function sheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/** Email service account (buat ditampilkan di web: owner share sheet ke email ini). */
export function serviceAccountEmail(): string {
  return creds()?.client_email || "";
}

/** Ambil ID dari URL Google Sheet (atau kembalikan apa adanya kalau sudah ID). */
export function extractSheetId(input: string): string {
  const s = (input || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

/** ID sheet aktif: dari Setting DB (bisa diubah web) → fallback env GSHEET_ID. */
export async function currentSheetId(): Promise<string> {
  return ((await getSetting("gsheet_id")) || process.env.GSHEET_ID || "").trim();
}

/** Simpan/ganti sheet dari URL atau ID (dipanggil dari admin web). */
export async function setSheetIdFrom(input: string): Promise<string> {
  const id = extractSheetId(input);
  await setSetting("gsheet_id", id);
  return id;
}

/** Pastikan tab Dashboard & Transaksi ada di spreadsheet (owner bikin sheet kosong). */
async function ensureTabs(id: string) {
  const auth = jwt();
  if (!auth) return;
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const titles = (meta.data.sheets || []).map((s) => s.properties?.title || "");
  const need = ["Dashboard", "Transaksi"].filter((t) => !titles.includes(t));
  if (need.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: need.map((t) => ({ addSheet: { properties: { title: t } } })) },
    });
  }
}

/**
 * Ambil id spreadsheet dari env GSHEET_ID (atau Setting) + pastikan tab-nya ada.
 * Service account TIDAK membuat file (tak punya kuota Drive) — owner yang bikin sheet
 * lalu share ke email service account, id-nya dipasang di GSHEET_ID.
 */
export async function getOrCreateSheet(): Promise<string | null> {
  const auth = jwt();
  if (!auth) return null;
  const id = (process.env.GSHEET_ID || (await getSetting("gsheet_id")) || "").trim();
  if (!id) return null;
  await ensureTabs(id);
  return id;
}

async function _writeHeaderAndDashboard(id: string) {
  const auth = jwt();
  if (!auth) return;
  const sheets = google.sheets({ version: "v4", auth });

  // Locale EN: rumus di bawah pakai koma pemisah argumen — di locale id (desimal
  // koma) Google Sheet menolaknya dengan #ERROR!. Set sekali, aman untuk selalu.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{ updateSpreadsheetProperties: { properties: { locale: "en_US" }, fields: "locale" } }],
    },
  });

  // Header Transaksi.
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'Transaksi'!A1",
    valueInputOption: "RAW",
    requestBody: { values: [TX_HEADER] },
  });

  // Dashboard REKAP INTERAKTIF — pilih tanggal di B4 (kosong = hari ini),
  // semua rumus ikut tanggal itu (kolom Transaksi: B hari_usaha, F metode,
  // J total, K modal, L status).
  // D = tanggal efektif: =IF($B$4="",TODAY(),$B$4)
  const D = 'IF($B$4="",TODAY(),$B$4)';
  const hari = (off: number) => `TEXT(${D}-${off},"yyyy-mm-dd")`;
  const hariIni = hari(0);
  const bulanTerpilih = `TEXT(${D},"yyyy-mm")&"*"`;
  const sum = (col: string, ...cond: string[]) => `SUMIFS(Transaksi!${col},${cond.join(",")})`;
  const aktif = `Transaksi!L:L,"ACTIVE"`;
  const rows: (string | number)[][] = [
    ["📊 RUANG SENYAWA — LAPORAN POS", ""],
    ["Pilih tanggal laporan di sel B4 (kosongkan = hari ini). Selain B4, jangan diedit.", ""],
    ["", ""],
    ["📅 Tanggal laporan", ""],
    ["", ""],
    ["■ RINGKASAN HARI TERPILIH", ""],
    ["Omzet", `=${sum("J:J", `Transaksi!B:B,${hariIni}`, aktif)}`],
    ["Transaksi", `=COUNTIFS(Transaksi!B:B,${hariIni},${aktif})`],
    ["Rata-rata / transaksi", `=IFERROR(${sum("J:J", `Transaksi!B:B,${hariIni}`, aktif)}/COUNTIFS(Transaksi!B:B,${hariIni},${aktif}),0)`],
    ["Modal (HPP)", `=${sum("K:K", `Transaksi!B:B,${hariIni}`, aktif)}`],
    ["Untung kotor", `=${sum("J:J", `Transaksi!B:B,${hariIni}`, aktif)}-${sum("K:K", `Transaksi!B:B,${hariIni}`, aktif)}`],
    ["Dibatalkan (VOID)", `=COUNTIFS(Transaksi!B:B,${hariIni},Transaksi!L:L,"VOID")`],
    ["", ""],
    ["■ METODE PEMBAYARAN (hari terpilih)", ""],
    ["  Tunai", `=${sum("J:J", `Transaksi!B:B,${hariIni}`, 'Transaksi!F:F,"TUNAI"', aktif)}`],
    ["  QRIS", `=${sum("J:J", `Transaksi!B:B,${hariIni}`, 'Transaksi!F:F,"QRIS"', aktif)}`],
    ["  Transfer", `=${sum("J:J", `Transaksi!B:B,${hariIni}`, 'Transaksi!F:F,"TRANSFER"', aktif)}`],
    ["  Lainnya", `=${sum("J:J", `Transaksi!B:B,${hariIni}`, aktif)}-${sum("J:J", `Transaksi!B:B,${hariIni}`, 'Transaksi!F:F,"TUNAI"', aktif)}-${sum("J:J", `Transaksi!B:B,${hariIni}`, 'Transaksi!F:F,"QRIS"', aktif)}-${sum("J:J", `Transaksi!B:B,${hariIni}`, 'Transaksi!F:F,"TRANSFER"', aktif)}`],
    ["", ""],
    ["■ KAS & ABSENSI (hari terpilih)", ""],
    ["Kas masuk (MASUK)", `=SUMIFS(Kas!F:F,Kas!A:A,${hariIni},Kas!C:C,"MASUK")`],
    ["Kas keluar (KELUAR)", `=SUMIFS(Kas!F:F,Kas!A:A,${hariIni},Kas!C:C,"KELUAR")`],
    ["Kehadiran (orang×shift)", `=COUNTIF(Absensi!A:A,${hariIni})`],
    ["", ""],
    ["■ TREN 7 HARI (berakhir tanggal terpilih)", "OMZET", "TRX"],
    ...[6, 5, 4, 3, 2, 1, 0].map(
      (off) => a7(off),
    ),
    ["", ""],
    ["■ BULAN TERPILIH", ""],
    ["Omzet", `=${sum("J:J", `Transaksi!B:B,${bulanTerpilih}`, aktif)}`],
    ["Transaksi", `=COUNTIFS(Transaksi!B:B,${bulanTerpilih},${aktif})`],
    ["Untung kotor", `=${sum("J:J", `Transaksi!B:B,${bulanTerpilih}`, aktif)}-${sum("K:K", `Transaksi!B:B,${bulanTerpilih}`, aktif)}`],
    ["", ""],
    ["■ SEMUA WAKTU", ""],
    ["Total omzet", `=${sum("J:J", aktif)}`],
    ["Total transaksi", "=COUNTA(Transaksi!A2:A)"],
    ["Total dibatalkan (VOID)", '=COUNTIF(Transaksi!L:L,"VOID")'],
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'Dashboard'!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  // Format B4 sebagai tanggal biar gampang diklik-kalendernya.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: await _dashboardSheetId(id, sheets), startRowIndex: 3, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 2 },
            cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}

function a7(off: number): (string | number)[] {
  const D = 'IF($B$4="",TODAY(),$B$4)';
  const h = `TEXT(${D}-${off},"yyyy-mm-dd")`;
  return [
    `=${h}`,
    `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${h},Transaksi!L:L,"ACTIVE")`,
    `=COUNTIFS(Transaksi!B:B,${h},Transaksi!L:L,"ACTIVE")`,
  ];
}

async function _dashboardSheetId(id: string, sheets: any): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const s = (meta.data.sheets || []).find((x: any) => x.properties?.title === "Dashboard");
  return s?.properties?.sheetId ?? 0;
}

/** Tambah 1 transaksi ke tab Transaksi. Fire-and-forget (tak ganggu POST transaksi). */
export async function appendTransactionToSheet(trxId: string): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const t = await prisma.transaction.findUnique({ where: { id: trxId } });
    if (!t) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: "'Transaksi'!A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          t.code, t.businessDate, new Date(t.createdAt).toISOString(), t.cashierName,
          t.orderType, t.payment, t.grossTotal, t.discount, t.voucherName || "",
          t.total, t.costTotal, t.status,
        ]],
      },
    });
  } catch (e) {
    console.error("appendTransactionToSheet gagal:", (e as Error).message);
  }
}

/** Tulis ulang seluruh tab Transaksi dari DB + refresh header/dashboard + katalog. */
export async function rebuildSheet(): Promise<string | null> {
  if (!sheetEnabled()) return null;
  const id = await getOrCreateSheet();
  if (!id) return null;
  const auth = jwt();
  if (!auth) return null;
  const sheets = google.sheets({ version: "v4", auth });

  const txs = await prisma.transaction.findMany({ orderBy: { createdAt: "asc" } });
  const rows = txs.map((t) => [
    t.code, t.businessDate, new Date(t.createdAt).toISOString(), t.cashierName,
    t.orderType, t.payment, t.grossTotal, t.discount, t.voucherName || "",
    t.total, t.costTotal, t.status,
  ]);

  await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: "'Transaksi'!A2:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'Transaksi'!A1",
    valueInputOption: "RAW",
    requestBody: { values: [TX_HEADER, ...rows] },
  });
  await _writeHeaderAndDashboard(id);
  await syncCatalogToSheet();
  await syncOpsToSheet();
  return id;
}

/**
 * Mirror OPERASIONAL (kas, absensi, restok) dari Postgres ke tab Sheet.
 * Ditulis ulang penuh — dipanggil tiap ada perubahan (fire-and-forget) & rebuild.
 */
export async function syncOpsToSheet(): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId: string = id;

    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const titles = (meta.data.sheets || []).map((s) => s.properties?.title || "");
    const need = ["Kas", "Absensi", "Restok_Log"].filter((t) => !titles.includes(t));
    if (need.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: need.map((t) => ({ addSheet: { properties: { title: t } } })) },
      });
    }

    async function writeTab(title: string, header: string[], rows: (string | number | null)[][]) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `'${title}'!A2:Z` });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${title}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header, ...rows] },
      });
    }

    const [kas, absen, restok] = await Promise.all([
      prisma.cashEntry.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.attendance.findMany({ orderBy: { clockIn: "asc" } }),
      prisma.stockMovement.findMany({
        where: { type: { in: ["RESTOCK", "IMPORT", "ADJUST"] } },
        orderBy: { createdAt: "asc" },
        include: { packaging: true },
      }),
    ]);

    await writeTab(
      "Kas",
      ["hari_usaha", "waktu", "tipe", "kategori", "keterangan", "nominal", "oleh"],
      kas.map((k) => [
        k.businessDate, new Date(k.createdAt).toISOString(), k.type, k.category,
        k.note || "", k.amount, k.userName || "",
      ]),
    );

    await writeTab(
      "Absensi",
      ["hari_usaha", "karyawan", "shift", "dicatat_oleh", "waktu"],
      absen.map((a) => [
        a.businessDate, a.employeeName, a.shift || "", a.recordedBy || "",
        new Date(a.clockIn).toISOString(),
      ]),
    );

    await writeTab(
      "Restok_Log",
      ["waktu", "bahan", "tipe", "perubahan", "stok_sesudah", "oleh", "catatan"],
      restok.map((r) => [
        new Date(r.createdAt).toISOString(), r.packaging.name, r.type, r.delta,
        r.after, r.userName || "", r.note || "",
      ]),
    );
  } catch (e) {
    console.error("syncOpsToSheet gagal:", (e as Error).message);
  }
}

/**
 * Mirror KATALOG (menu/bahan/voucher/karyawan) dari Postgres ke tab Sheet.
 * Ditulis ulang penuh (clear + update) — Sheet tetap sifatnya BACA (laporan owner);
 * satu pintu edit katalog = web admin. Dipanggil tiap perubahan katalog (fire-and-forget)
 * dan saat rebuild manual.
 */
export async function syncCatalogToSheet(): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId: string = id;

    // Pastikan tab katalog ada.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const titles = (meta.data.sheets || []).map((s) => s.properties?.title || "");
    const need = ["Menu", "Bahan", "Voucher", "Karyawan"].filter((t) => !titles.includes(t));
    if (need.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: need.map((t) => ({ addSheet: { properties: { title: t } } })) },
      });
    }

    async function writeTab(title: string, header: string[], rows: (string | number | boolean | null)[][]) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `'${title}'!A2:Z` });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${title}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header, ...rows] },
      });
    }

    const [menus, pkgs, vouchers, employees] = await Promise.all([
      prisma.menuItem.findMany({
        orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
        include: { stocks: { include: { packaging: true } }, variantGroups: { include: { options: true } } },
      }),
      prisma.packaging.findMany({ orderBy: { name: "asc" } }),
      prisma.voucher.findMany({ orderBy: { name: "asc" } }),
      prisma.employee.findMany({ orderBy: { name: "asc" } }),
    ]);

    await writeTab(
      "Menu",
      ["nama", "kategori", "harga", "modal", "aktif", "urutan", "bahan (per porsi)", "varian"],
      menus.map((m) => [
        m.name,
        m.category,
        m.price,
        m.cost,
        m.active ? "YA" : "TIDAK",
        m.sortOrder,
        m.stocks.map((s) => `${s.packaging.name} x${s.qty}`).join(", "),
        m.variantGroups
          .map((g) => `${g.name}: ${g.options.map((o) => `${o.name}${o.priceDelta ? ` +${o.priceDelta}` : ""}`).join(" / ")}`)
          .join("; "),
      ]),
    );

    await writeTab(
      "Bahan",
      ["nama", "satuan", "stok", "min_stok", "status"],
      pkgs.map((p) => [p.name, p.unit, p.stock, p.minStock, p.stock <= p.minStock ? "PERLU RESTOK" : "AMAN"]),
    );

    await writeTab(
      "Voucher",
      ["nama", "tipe", "nilai", "aktif", "kuota", "terpakai", "mulai", "selesai"],
      vouchers.map((v) => [
        v.name,
        v.type,
        v.value,
        v.active ? "YA" : "TIDAK",
        v.maxUses ?? "∞",
        v.usedCount,
        v.validFrom ? new Date(v.validFrom).toISOString().slice(0, 10) : "",
        v.validUntil ? new Date(v.validUntil).toISOString().slice(0, 10) : "",
      ]),
    );

    await writeTab(
      "Karyawan",
      ["nama", "aktif"],
      employees.map((e) => [e.name, e.active ? "YA" : "TIDAK"]),
    );
  } catch (e) {
    console.error("syncCatalogToSheet gagal:", (e as Error).message);
  }
}
