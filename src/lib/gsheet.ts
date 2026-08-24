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

  // Dashboard REKAP INTERAKTIF — B4 = DROPDOWN periode (Hari ini / 7 hari /
  // 14 hari / 1 bulan / 2 bulan / Tanggal tertentu). Kalau "Tanggal tertentu",
  // tanggal diisi di B5. Helper H1/H2 = tanggal mulai & akhir periode.
  // (kolom Transaksi: B hari_usaha, F metode, J total, K modal, L status)
  const isRange = `OR($B$4="7 hari",$B$4="14 hari",$B$4="1 bulan",$B$4="2 bulan")`;
  const minusN = `IFS($B$4="7 hari",6,$B$4="14 hari",13,$B$4="1 bulan",29,$B$4="2 bulan",59,TRUE,0)`;
  const startD = `IF(${isRange},TODAY()-${minusN},IF($B$5="",TODAY(),$B$5))`;
  const endD = `IF(${isRange},TODAY(),IF($B$5="",TODAY(),$B$5))`;
  const inPeriod = `Transaksi!B:B,">="&DATEVALUE(TEXT($H$1,"yyyy-mm-dd")),Transaksi!B:B,"<="&DATEVALUE(TEXT($H$2,"yyyy-mm-dd"))`;
  const sum = (col: string, ...cond: string[]) => `SUMIFS(Transaksi!${col},${cond.join(",")})`;
  const aktif = `Transaksi!L:L,"ACTIVE"`;
  const bulanAkhir = `Transaksi!B:B,">="&EOMONTH($H$2,-1)+1,Transaksi!B:B,"<="&EOMONTH($H$2,0)`;
  const rows: (string | number)[][] = [
    ["📊 RUANG SENYAWA — LAPORAN POS", "", "", "", "(mulai)", "", "", `=${startD}`, "(pilih tgl)"],
    ["Pilih PERIODE di B4 (dropdown). Kalau \"Tanggal tertentu\", pilih tanggalnya di B5. Selain B4/B5, jangan diedit.", "", "", "", "(sampai)", "", "", `=${endD}`, '=IFERROR(SORT(UNIQUE(FILTER(Transaksi!B2:B,Transaksi!B2:B<>""))),"")'],
    ["", ""],
    ["📅 Periode laporan", "Hari ini"],
    ["   atau pilih tanggal (utk \"Tanggal tertentu\")", ""],
    ["", ""],
    ["■ RINGKASAN PERIODE TERPILIH", ""],
    ["Omzet", `=${sum("J:J", inPeriod, aktif)}`],
    ["Transaksi", `=COUNTIFS(${inPeriod},${aktif})`],
    ["Rata-rata / transaksi", `=IFERROR(${sum("J:J", inPeriod, aktif)}/COUNTIFS(${inPeriod},${aktif}),0)`],
    ["Modal (HPP)", `=${sum("K:K", inPeriod, aktif)}`],
    ["Untung kotor", `=${sum("J:J", inPeriod, aktif)}-${sum("K:K", inPeriod, aktif)}`],
    ["Dibatalkan (VOID)", `=COUNTIFS(${inPeriod},Transaksi!L:L,"VOID")`],
    ["", ""],
    ["■ METODE PEMBAYARAN (periode terpilih)", ""],
    ["  Tunai", `=${sum("J:J", inPeriod, 'Transaksi!F:F,"TUNAI"', aktif)}`],
    ["  QRIS", `=${sum("J:J", inPeriod, 'Transaksi!F:F,"QRIS"', aktif)}`],
    ["  Transfer", `=${sum("J:J", inPeriod, 'Transaksi!F:F,"TRANSFER"', aktif)}`],
    ["  Lainnya", `=${sum("J:J", inPeriod, aktif)}-${sum("J:J", inPeriod, 'Transaksi!F:F,"TUNAI"', aktif)}-${sum("J:J", inPeriod, 'Transaksi!F:F,"QRIS"', aktif)}-${sum("J:J", inPeriod, 'Transaksi!F:F,"TRANSFER"', aktif)}`],
    ["", ""],
    ["■ KAS & ABSENSI (periode terpilih)", ""],
    ["Kas masuk (MASUK)", `=SUMIFS(Kas!F:F,Kas!A:A,">="&DATEVALUE(TEXT($H$1,"yyyy-mm-dd")),Kas!A:A,"<="&DATEVALUE(TEXT($H$2,"yyyy-mm-dd")),Kas!C:C,"MASUK")`],
    ["Kas keluar (KELUAR)", `=SUMIFS(Kas!F:F,Kas!A:A,">="&DATEVALUE(TEXT($H$1,"yyyy-mm-dd")),Kas!A:A,"<="&DATEVALUE(TEXT($H$2,"yyyy-mm-dd")),Kas!C:C,"KELUAR")`],
    ["Kehadiran (orang×shift)", `=COUNTIFS(Absensi!A:A,">="&DATEVALUE(TEXT($H$1,"yyyy-mm-dd")),Absensi!A:A,"<="&DATEVALUE(TEXT($H$2,"yyyy-mm-dd")))`],
    ["", ""],
    ["■ TREN 7 HARI (berakhir akhir periode)", "OMZET", "TRX"],
    ...[6, 5, 4, 3, 2, 1, 0].map((off) => a7(off)),
    ["", ""],
    ["■ BULAN DARI AKHIR PERIODE", ""],
    ["Omzet", `=${sum("J:J", bulanAkhir, aktif)}`],
    ["Transaksi", `=COUNTIFS(${bulanAkhir},${aktif})`],
    ["Untung kotor", `=${sum("J:J", bulanAkhir, aktif)}-${sum("K:K", bulanAkhir, aktif)}`],
    ["", ""],
    ["■ SEMUA WAKTU", ""],
    ["Total omzet", `=${sum("J:J", aktif)}`],
    ["Total transaksi", "=COUNTA(Transaksi!A2:A)"],
    ["Total dibatalkan (VOID)", '=COUNTIF(Transaksi!L:L,"VOID")'],
  ];
  // Bersihkan dulu (layout bisa berubah antar versi — sisa kolom lama tak tertinggal).
  await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: "'Dashboard'!A2:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'Dashboard'!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  const dashId = await _dashboardSheetId(id, sheets);
  // B4 = dropdown periode; B5 = tanggal (format date); H1/H2 helper tampil sbg tanggal.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 2 },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [
                  "Hari ini",
                  "7 hari",
                  "14 hari",
                  "1 bulan",
                  "2 bulan",
                  "Tanggal tertentu",
                ].map((v) => ({ userEnteredValue: v })),
              },
              showCustomUi: true,
              strict: true,
            },
          },
        },
        {
          // B5 = dropdown tanggal (daftar hari-usaha yang ADA transaksinya, dari kolom J).
          setDataValidation: {
            range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 },
            rule: {
              condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: "=Dashboard!J2:J" }] },
              showCustomUi: true,
              strict: true,
            },
          },
        },
        {
          repeatCell: {
            range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 },
            cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
        {
          repeatCell: {
            range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 7, endColumnIndex: 8 },
            cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}

function a7(off: number): (string | number)[] {
  const h = `TEXT($H$2-${off},"dd/mm")`;
  const d = `$H$2-${off}`; // date asli — cocok dgn kolom Transaksi!B (date)
  return [
    `=${h}`,
    `=SUMIFS(Transaksi!J:J,Transaksi!B:B,${d},Transaksi!L:L,"ACTIVE")`,
    `=COUNTIFS(Transaksi!B:B,${d},Transaksi!L:L,"ACTIVE")`,
  ];
}

async function _dashboardSheetId(id: string, sheets: any): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const s = (meta.data.sheets || []).find((x: any) => x.properties?.title === "Dashboard");
  return s?.properties?.sheetId ?? 0;
}

/**
 * Tab JADWAL SHIFT (matriks tanggal × shift, diisi manual owner di Sheet).
 * Server HANYA menyiapkan struktur: header shift (dari Setting web), kolom
 * tanggal otomatis mengikuti bulan terpilih (dropdown B1), dan dropdown bulan.
 * Sel isian nama TIDAK PERNAH ditimpa — tab ini bukan mirror, ini milik owner.
 */
export async function ensureJadwalTab(): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });

    // Buat tab kalau belum ada, lalu ambil meta TERBARU (untuk sheetId valid).
    let meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    if (!(meta.data.sheets || []).some((s) => s.properties?.title === "Jadwal")) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: "Jadwal" } } }] },
      });
      meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    }

    // Kolom ikut NAMA SHIFT dari Setting web (mis. Pagi, Malam).
    const shifts = ((await getSetting("shifts")) || "Pagi,Malam")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const header = ["Tanggal", ...shifts];

    // Kolom tanggal: formula per baris (mengikuti bulan di B1). Baris 4..34 = tgl 1..31.
    const dateRows = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      return [
        `=IF($B$1="","",IF(MONTH(DATE(YEAR(DATEVALUE($B$1&"-01")),MONTH(DATEVALUE($B$1&"-01")),${day}))<>MONTH(DATEVALUE($B$1&"-01")),"",TEXT(DATE(YEAR(DATEVALUE($B$1&"-01")),MONTH(DATEVALUE($B$1&"-01")),${day}),"dd/mm")))`,
        ...shifts.map(() => ""),
      ];
    });

    // Jangan timpa pilihan bulan owner: cek B1 dulu.
    const cur = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Jadwal!B1" });
    const b1 = (cur.data.values?.[0]?.[0] ?? "").toString();

    // Bersihkan area header dulu (sisa kolom/label versi lama tak tertinggal).
    // Hanya baris 1-3 — isian manual owner (baris 4+) tak disentuh.
    await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: "Jadwal!A1:Z3" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: "Jadwal!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["📅 JADWAL SHIFT", b1 || '=TEXT(TODAY(),"yyyy-mm")'],
          ["Pilih bulan di B1 (dropdown). Isi nama karyawan per tanggal × shift — kolom isian ini TIDAK ditimpa server. Tanggal otomatis mengikuti bulan.", ""],
          header,
          ...dateRows,
        ],
      },
    });

    // Helper daftar bulan (2 bln lalu s/d 12 bln depan) + dropdown B1 darinya.
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: "Jadwal!M1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ['=ARRAYFORMULA(TEXT(EDATE(EOMONTH(TODAY(),-2)+1,SEQUENCE(1,15)),"yyyy-mm"))'],
        ],
      },
    });

    const jadwalSheet = (meta.data.sheets || []).find((s) => s.properties?.title === "Jadwal");
    if (!jadwalSheet) return;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: { sheetId: jadwalSheet.properties?.sheetId ?? 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
              rule: {
                condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: "=Jadwal!M1:AA1" }] },
                showCustomUi: true,
                strict: true,
              },
            },
          },
        ],
      },
    });
  } catch (e) {
    console.error("ensureJadwalTab gagal:", (e as Error).message);
  }
}
export async function markVoidedInSheet(code: string): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "'Transaksi'!A2:A" });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => (r[0] || "") === code);
    if (idx < 0) return;
    const rowNum = idx + 2; // +1 header, +1 basis-1
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'Transaksi'!L${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [["VOID"]] },
    });
  } catch (e) {
    console.error("markVoidedInSheet gagal:", (e as Error).message);
  }
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
    valueInputOption: "USER_ENTERED", // tanggal jadi DATE asli
    requestBody: { values: [TX_HEADER, ...rows] },
  });
  await _writeHeaderAndDashboard(id);
  await syncCatalogToSheet();
  await syncOpsToSheet();
  await ensureJadwalTab(); // struktur jadwal shift (isian owner tak disentuh)
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
        valueInputOption: "USER_ENTERED", // hari_usaha jadi DATE asli
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
        valueInputOption: "USER_ENTERED", // hari_usaha jadi DATE asli
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
