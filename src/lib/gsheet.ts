import { google } from "googleapis";
import { Readable } from "stream";
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

async function _sheetIdByTitle(id: string, sheets: any, title: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const s = (meta.data.sheets || []).find((x: any) => x.properties?.title === title);
  return s?.properties?.sheetId ?? 0;
}

/**
 * Upload foto NOTA belanja ke Google Drive pakai service account — file TIDAK
 * disimpan di server. Syarat (set dari web): owner bikin folder di Drive-nya
 * (mis. "Nota POS"), share ke email SA sebagai Editor, lalu tempel URL foldernya
 * di Admin → Pengaturan (disimpan di Setting 'drive_folder_id').
 * File masuk folder owner (quota owner) → otomatis kelihatan di Drive owner;
 * webViewLink-nya dipakai di kolom "nota" tab Belanja Sheet.
 */
export async function uploadNotaToDrive(
  fileName: string,
  mimeType: string,
  buf: Buffer,
): Promise<{ url: string; name: string }> {
  const auth = jwt();
  if (!auth) throw new Error("Service account Google belum dikonfigurasi");
  // SA TIDAK punya storage quota di My Drive-nya sendiri — file HARUS masuk folder
  // milik akun asli (owner) yang di-share ke SA sebagai Editor. Tanpa itu Google
  // menolak: "Service Accounts do not have storage quota".
  const folderId = await currentDriveFolderId();
  if (!folderId) {
    throw new Error(
      `Folder nota belum diset — Admin → Pengaturan → tempel URL folder Drive yang di-share (Editor) ke ${auth.email}`,
    );
  }
  const drive = google.drive({ version: "v3", auth });
  const f = await drive.files.create({
    requestBody: { name: `nota-${Date.now()}-${fileName}`.slice(0, 150), parents: [folderId] },
    media: { mimeType, body: Readable.from(buf) },
    fields: "id,name,webViewLink",
  });
  if (!f.data.id || !f.data.webViewLink) throw new Error("Upload Drive gagal");
  return { url: f.data.webViewLink, name: f.data.name || fileName };
}

/**
 * Simpan folder nota dari URL/ID (dipanggil dari admin web). Sekalian VERIFIKASI:
 * folder harus bisa dibuka SA & SA boleh nulis (share Editor) — kalau tidak,
 * balikin error yang jelas biar owner tahu harus share dulu.
 */
export async function setDriveFolderFrom(input: string): Promise<{ id: string; name: string }> {
  const auth = jwt();
  if (!auth) throw new Error("Service account Google belum dikonfigurasi");
  const id = extractDriveFolderId(input);
  if (!id) throw new Error("URL / ID folder Drive kosong");
  const drive = google.drive({ version: "v3", auth });
  let meta;
  try {
    meta = await drive.files.get({ fileId: id, fields: "id,name,mimeType,capabilities/canAddChildren" });
  } catch {
    throw new Error(`Folder tidak bisa dibuka service account — share folder ke ${auth.email} sebagai Editor dulu`);
  }
  if (meta.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Yang ditempel bukan folder Google Drive");
  }
  if (meta.data.capabilities?.canAddChildren === false) {
    throw new Error(`Service account belum boleh menulis ke folder ini — share sebagai Editor ke ${auth.email}`);
  }
  await setSetting("drive_folder_id", id);
  return { id, name: meta.data.name || id };
}

/** Ambil ID dari URL Google Sheet (atau kembalikan apa adanya kalau sudah ID). */
export function extractSheetId(input: string): string {
  const s = (input || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

/** Ambil ID folder dari URL Google Drive (…/folders/ID) atau kembalikan apa adanya. */
export function extractDriveFolderId(input: string): string {
  const s = (input || "").trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

/** ID folder nota aktif: Setting DB (atur dari web) → fallback env DRIVE_FOLDER_ID. */
export async function currentDriveFolderId(): Promise<string> {
  return (((await getSetting("drive_folder_id")) || process.env.DRIVE_FOLDER_ID || "").trim());
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
    ["Biaya owner (belanja+gaji)", `=SUMIFS(Belanja!H:H,Belanja!A:A,">="&DATEVALUE(TEXT($H$1,"yyyy-mm-dd")),Belanja!A:A,"<="&DATEVALUE(TEXT($H$2,"yyyy-mm-dd")))`],
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
 * Tab JADWAL SHIFT — matriks Tanggal × Shift, ISI OTOMATIS dari data absensi
 * (siapa beneran absen per shift, dari HP/web). Kolom shift = nama shift di
 * Setting web. Ditulis ulang penuh tiap rebuild & tiap absensi berubah.
 */
export async function ensureJadwalTab(): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });

    let meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    if (!(meta.data.sheets || []).some((x) => x.properties?.title === "Jadwal")) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: "Jadwal" } } }] },
      });
    }

    // Kolom shift = Setting web (default Pagi,Malam).
    const shifts = ((await getSetting("shifts")) || "Pagi,Malam")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    // Bulan berjalan (server time).
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const atts = await prisma.attendance.findMany({ where: { businessDate: { startsWith: ym } } });
    // matrix: tanggal (int) -> shift -> nama[]
    const matrix = new Map<number, Map<string, string[]>>();
    for (const a of atts) {
      const d = Number((a.businessDate || "").slice(8, 10));
      if (!d) continue;
      const sh = a.shift || "(tanpa shift)";
      let row = matrix.get(d);
      if (!row) matrix.set(d, (row = new Map()));
      const names = row.get(sh) || [];
      if (!names.includes(a.employeeName)) names.push(a.employeeName);
      row.set(sh, names);
    }

    const rows: (string | number)[][] = [];
    for (let d = 1; d <= days; d++) {
      const row = matrix.get(d);
      rows.push([
        `${String(d).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`,
        ...shifts.map((sh) => (row?.get(sh) || []).join(", ")),
      ]);
    }

    await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: "Jadwal!A1:Z" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: "Jadwal!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [`📅 JADWAL SHIFT — ${ym} (isi OTOMATIS dari absensi)`],
          ["Baris = tanggal, kolom = shift, isi = karyawan yang absen shift itu. Riwayat bulan lain: tab Absensi / web."],
          ["Tanggal", ...shifts],
          ...rows,
        ],
      },
    });
  } catch (e) {
    console.error("ensureJadwalTab gagal:", (e as Error).message);
  }
}
/**
 * Tab REKAP HARIAN — satu baris per hari-usaha (kayak rekap manual owner):
 * omzet, per metode bayar, modal/HPP, untung, kas masuk/keluar, biaya owner,
 * dan estimasi uang tunai yang disisih owner hari itu. Ditulis ulang penuh
 * dari Postgres; dipanggil tiap ada transaksi/kas/belanja/void masuk.
 */
export async function syncRekapHarian(): Promise<void> {
  try {
    if (!sheetEnabled()) return;
    const id = await getOrCreateSheet();
    if (!id) return;
    const auth = jwt();
    if (!auth) return;
    const sheets = google.sheets({ version: "v4", auth });

    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    if (!(meta.data.sheets || []).some((x) => x.properties?.title === "Rekap_Harian")) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: "Rekap_Harian" } } }] },
      });
    }

    const [txs, kas, purchases] = await Promise.all([
      prisma.transaction.findMany({
        select: { businessDate: true, payment: true, total: true, discount: true, costTotal: true, status: true },
      }),
      prisma.cashEntry.findMany({ select: { businessDate: true, type: true, amount: true } }),
      prisma.purchase.findMany({ select: { businessDate: true, total: true } }),
    ]);

    type Day = {
      trx: number; omzet: number; tunai: number; qris: number; transfer: number; lain: number;
      diskon: number; modal: number; voidCount: number; kasIn: number; kasOut: number; biaya: number;
    };
    const days = new Map<string, Day>();
    const day = (d: string) => {
      let x = days.get(d);
      if (!x) {
        x = { trx: 0, omzet: 0, tunai: 0, qris: 0, transfer: 0, lain: 0, diskon: 0, modal: 0, voidCount: 0, kasIn: 0, kasOut: 0, biaya: 0 };
        days.set(d, x);
      }
      return x;
    };
    for (const t of txs) {
      const d = day(t.businessDate);
      if (t.status === "VOID") {
        d.voidCount++;
        continue;
      }
      d.trx++;
      d.omzet += t.total;
      d.diskon += t.discount;
      d.modal += t.costTotal;
      const p = (t.payment || "").toUpperCase();
      if (p.includes("TUNAI") || p.includes("CASH")) d.tunai += t.total;
      else if (p.includes("QRIS") || p.includes("QRI")) d.qris += t.total;
      else if (p.includes("TRANSFER")) d.transfer += t.total;
      else d.lain += t.total;
    }
    for (const k of kas) {
      const d = day(k.businessDate);
      if (k.type === "MASUK") d.kasIn += k.amount;
      else d.kasOut += k.amount;
    }
    for (const p of purchases) day(p.businessDate).biaya += p.total;

    const dates = [...days.keys()].filter(Boolean).sort();
    const rows = dates.map((d) => {
      const x = days.get(d)!;
      const untung = x.omzet - x.modal;
      const diambil = Math.max(0, x.tunai + x.kasIn - x.kasOut); // sisa tunai laci → est. diambil owner
      return [
        d, x.trx, x.omzet, x.tunai, x.qris, x.transfer, x.lain, x.diskon,
        x.modal, untung, x.voidCount, x.kasIn, x.kasOut, x.biaya, diambil,
      ];
    });

    await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: "'Rekap_Harian'!A1:Z" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: "'Rekap_Harian'!A1",
      valueInputOption: "USER_ENTERED", // tanggal jadi DATE asli
      requestBody: {
        values: [
          [
            "tanggal", "trx", "omzet", "tunai", "qris", "transfer", "lainnya",
            "diskon", "modal (hpp)", "untung", "void", "kas masuk", "kas keluar",
            "biaya owner", "est. diambil owner",
          ],
          ...rows,
        ],
      },
    });

    // Rapiin: header tebal + bekukan baris 1 + kolom angka format ribuan.
    const sid = await _sheetIdByTitle(id, sheets, "Rekap_Harian");
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
          ...(rows.length
            ? [{
                repeatCell: {
                  range: { sheetId: sid, startRowIndex: 1, endRowIndex: rows.length + 1, startColumnIndex: 1, endColumnIndex: 15 },
                  cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" } } },
                  fields: "userEnteredFormat.numberFormat",
                },
              }]
            : []),
        ],
      },
    });
  } catch (e) {
    console.error("syncRekapHarian gagal:", (e as Error).message);
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
    void syncRekapHarian(); // baris hari itu berubah (omzet/void)
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
    void syncRekapHarian(); // baris rekap hari itu berubah
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
  await ensureJadwalTab(); // matriks absensi per shift
  await syncRekapHarian(); // rekap per hari
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
    const need = ["Kas", "Absensi", "Restok_Log", "Belanja"].filter((t) => !titles.includes(t));
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

    const [kas, absen, restok, belanja] = await Promise.all([
      prisma.cashEntry.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.attendance.findMany({ orderBy: { clockIn: "asc" } }),
      prisma.stockMovement.findMany({
        where: { type: { in: ["RESTOCK", "IMPORT", "ADJUST"] } },
        orderBy: { createdAt: "asc" },
        include: { packaging: true },
      }),
      prisma.purchase.findMany({ orderBy: { createdAt: "asc" } }),
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
      "Belanja",
      ["hari_usaha", "waktu", "kategori", "barang", "qty", "satuan", "harga_satuan", "total", "oleh", "catatan", "nota"],
      belanja.map((b) => [
        b.businessDate, new Date(b.createdAt).toISOString(), b.category || "BELANJA", b.itemName, b.qty,
        b.unit || "", b.unitPrice, b.total, b.userName || "", b.note || "",
        b.notaUrl ? `=HYPERLINK("${b.notaUrl}","Lihat nota")` : "",
      ]),
    );

    await ensureJadwalTab(); // matriks absensi per shift ikut refresh
    await writeTab(
      "Restok_Log",
      ["waktu", "bahan", "tipe", "perubahan", "stok_sesudah", "oleh", "catatan"],
      restok.map((r) => [
        new Date(r.createdAt).toISOString(), r.packaging.name, r.type, r.delta,
        r.after, r.userName || "", r.note || "",
      ]),
    );
    await syncRekapHarian(); // kas/belanja berubah → rekap ikut
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
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        include: { stocks: { include: { packaging: true } }, variantGroups: { include: { options: true } } },
      }),
      prisma.packaging.findMany({ orderBy: { name: "asc" } }),
      prisma.voucher.findMany({ orderBy: { name: "asc" } }),
      prisma.employee.findMany({ orderBy: { name: "asc" } }),
    ]);

    // MENU & HARGA — gaya "menu kafe" (kayak contoh owner): judul besar, header
    // hijau tua teks putih, baris data diwarnain per kategori (minuman hijau /
    // cemilan kuning / makanan krem), harga format Rp, border tipis, freeze header.
    {
      const store = ((await getSetting("storeName")) || "Ruang Senyawa").toUpperCase();
      const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const now = new Date();
      const COLS = 8; // A..H
      const menuRows = menus.map((m, i) => [
        i + 1,
        m.name,
        m.category,
        m.cost,
        m.price,
        m.variantGroups
          .map((g) => `${g.name}: ${g.options.map((o) => (o.priceDelta ? `${o.name} +${o.priceDelta}` : o.name)).join(" / ")}`)
          .join("; "),
        m.stocks.map((s) => `${s.packaging.name} x${s.qty}`).join(", "),
        m.active ? "" : "TIDAK DIJUAL",
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "'Menu'!A1:Z" });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "'Menu'!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            ["MENU & HARGA"],
            [store],
            [`Update: ${BULAN[now.getMonth()]} ${now.getFullYear()}`],
            [],
            ["No.", "Nama Menu", "Jenis Menu", "HPP Menu", "Harga Menu", "Varian", "Bahan (per porsi)", "Keterangan"],
            ...menuRows,
          ],
        },
      });

      const hex = (h: number) => ({ red: ((h >> 16) & 255) / 255, green: ((h >> 8) & 255) / 255, blue: (h & 255) / 255 });
      const bandColor = (cat: string) => {
        const c = (cat || "").toLowerCase();
        const has = (...xs: string[]) => xs.some((x) => c.includes(x));
        if (has("minuman", "kopi", "teh", "susu", "es ")) return hex(0xd9ead3); // hijau muda
        if (has("cemilan", "snack", "dessert", "roti", "pastry", "manis")) return hex(0xfff2cc); // kuning muda
        if (has("berat", "makan", "nasi", "mie", "ayam", "daging")) return hex(0xfce5cd); // krem
        return hex(0xdeeaf6); // kategori lain → biru muda
      };
      // Baris data berurutan per kategori → gabung jadi band satu warna.
      const bands: { start: number; end: number; color: ReturnType<typeof bandColor> }[] = [];
      menus.forEach((m, i) => {
        const color = bandColor(m.category);
        const last = bands[bands.length - 1];
        const same =
          last &&
          last.color.red === color.red &&
          last.color.green === color.green &&
          last.color.blue === color.blue;
        if (same) last.end = 6 + i + 1;
        else bands.push({ start: 6 + i, end: 6 + i + 1, color });
      });

      const sid = await _sheetIdByTitle(sheetId, sheets, "Menu");
      const THIN = { style: "SOLID", width: 1, color: { red: 0.73, green: 0.73, blue: 0.73 } };
      const grid = (r0: number, r1: number, c0 = 0, c1 = COLS) => ({ sheetId: sid, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
      const requests: any[] = [
        { unmergeRanges: { ranges: [{ sheetId: sid }] } }, // layout bisa berubah antar versi
        // Reset format lama dulu (biar gak ada sisa warna/merge versi sebelumnya).
        { repeatCell: { range: grid(0, menuRows.length + 55), cell: { userEnteredFormat: {} }, fields: "userEnteredFormat" } },
        { mergeCells: { range: grid(0, 1), mergeType: "MERGE_ROWS" } },
        { mergeCells: { range: grid(1, 2), mergeType: "MERGE_ROWS" } },
        { mergeCells: { range: grid(2, 3), mergeType: "MERGE_ROWS" } },
        {
          repeatCell: {
            range: grid(0, 1),
            cell: { userEnteredFormat: { horizontalAlignment: "CENTER", textFormat: { bold: true, fontSize: 16 } } },
            fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat",
          },
        },
        {
          repeatCell: {
            range: grid(1, 2),
            cell: { userEnteredFormat: { horizontalAlignment: "CENTER", textFormat: { bold: true, fontSize: 12 } } },
            fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat",
          },
        },
        {
          repeatCell: {
            range: grid(2, 3),
            cell: {
              userEnteredFormat: {
                horizontalAlignment: "CENTER",
                textFormat: { italic: true, foregroundColor: { red: 0.45, green: 0.45, blue: 0.45 } },
              },
            },
            fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat",
          },
        },
        {
          // Header hijau tua + teks putih.
          repeatCell: {
            range: grid(4, 5),
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.216, green: 0.337, blue: 0.137 },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                wrapStrategy: "WRAP",
              },
            },
            fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,wrapStrategy)",
          },
        },
        ...bands.map((b) => ({
          repeatCell: {
            range: grid(b.start, b.end),
            cell: { userEnteredFormat: { backgroundColor: b.color } },
            fields: "userEnteredFormat.backgroundColor",
          },
        })),
        ...(menuRows.length
          ? [
              {
                // HPP & Harga → format Rupiah.
                repeatCell: {
                  range: grid(5, menuRows.length + 5, 3, 5),
                  cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"Rp"#,##0' } } },
                  fields: "userEnteredFormat.numberFormat",
                },
              },
              {
                updateBorders: {
                  range: grid(4, menuRows.length + 5),
                  top: THIN, bottom: THIN, left: THIN, right: THIN, innerHorizontal: THIN, innerVertical: THIN,
                },
              },
            ]
          : []),
        { updateSheetProperties: { properties: { sheetId: sid, gridProperties: { frozenRowCount: 5 } }, fields: "gridProperties.frozenRowCount" } },
        ...[40, 230, 130, 110, 110, 220, 220, 130].map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId: sid, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: "pixelSize",
          },
        })),
      ];
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests } });
    }

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
