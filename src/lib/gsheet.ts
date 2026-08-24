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

  // Dashboard rumus LIVE (kolom Transaksi: B hari_usaha, F metode, J total, K modal, L status).
  const today = 'TEXT(TODAY(),"yyyy-mm-dd")';
  const bulan = 'TEXT(TODAY(),"yyyy-mm")&"*"';
  const rows: (string | number)[][] = [
    ["📊 RUANG SENYAWA — LAPORAN POS", ""],
    ["Terisi otomatis dari server. Jangan diedit manual.", ""],
    ["", ""],
    ["INDIKATOR", "NILAI"],
    ["Omzet hari ini", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${today},Transaksi!L:L,"ACTIVE")`],
    ["Transaksi hari ini", `=COUNTIFS(Transaksi!B:B,${today},Transaksi!L:L,"ACTIVE")`],
    ["Untung kotor hari ini", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${today},Transaksi!L:L,"ACTIVE")-SUMIFS(Transaksi!K:K,Transaksi!B:B,${today},Transaksi!L:L,"ACTIVE")`],
    ["  — Tunai", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${today},Transaksi!F:F,"TUNAI",Transaksi!L:L,"ACTIVE")`],
    ["  — QRIS", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${today},Transaksi!F:F,"QRIS",Transaksi!L:L,"ACTIVE")`],
    ["  — Transfer", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${today},Transaksi!F:F,"TRANSFER",Transaksi!L:L,"ACTIVE")`],
    ["", ""],
    ["Omzet bulan ini", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${bulan},Transaksi!L:L,"ACTIVE")`],
    ["Transaksi bulan ini", `=COUNTIFS(Transaksi!B:B,${bulan},Transaksi!L:L,"ACTIVE")`],
    ["Untung kotor bulan ini", `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${bulan},Transaksi!L:L,"ACTIVE")-SUMIFS(Transaksi!K:K,Transaksi!B:B,${bulan},Transaksi!L:L,"ACTIVE")`],
    ["", ""],
    ["Total omzet (semua)", '=SUMIF(Transaksi!L:L,"ACTIVE",Transaksi!J:J)'],
    ["Total transaksi", "=COUNTA(Transaksi!A2:A)"],
    ["Dibatalkan (VOID)", '=COUNTIF(Transaksi!L:L,"VOID")'],
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'Dashboard'!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
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
  return id;
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
