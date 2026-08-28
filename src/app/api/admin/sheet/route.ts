import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  sheetEnabled,
  getOrCreateSheet,
  rebuildSheet,
  sheetUrl,
  setSheetIdFrom,
  serviceAccountEmail,
  currentDriveFolderId,
  setDriveFolderFrom,
} from "@/lib/gsheet";

// GET → status + link spreadsheet & folder nota Drive (buat/ambil kalau perlu).
export async function GET(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  if (!sheetEnabled()) return NextResponse.json({ enabled: false });
  const id = await getOrCreateSheet();
  const dfId = await currentDriveFolderId();
  return NextResponse.json({
    enabled: true,
    id,
    url: id ? sheetUrl(id) : null,
    serviceAccountEmail: serviceAccountEmail(),
    driveFolderId: dfId || null,
    driveFolderUrl: dfId ? `https://drive.google.com/drive/folders/${dfId}` : null,
  });
}

// PUT → ganti spreadsheet aktif (body.url) ATAU folder nota Drive (body.driveFolder).
// Tempel URL atau ID langsung.
export async function PUT(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  if (!sheetEnabled()) {
    return NextResponse.json({ error: "Google Sheet belum dikonfigurasi (GOOGLE_SA_JSON_B64 di .env)" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));

  if (body.driveFolder !== undefined) {
    const input = String(body.driveFolder || "").trim();
    if (!input) return NextResponse.json({ error: "Tempel URL / ID folder Drive dulu" }, { status: 400 });
    try {
      const f = await setDriveFolderFrom(input);
      return NextResponse.json({
        ok: true,
        driveFolder: f,
        driveFolderUrl: `https://drive.google.com/drive/folders/${f.id}`,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  const input = String(body.url || "").trim();
  if (!input) return NextResponse.json({ error: "Tempel URL / ID Google Sheet dulu" }, { status: 400 });
  const id = await setSheetIdFrom(input);
  return NextResponse.json({ ok: true, id, url: sheetUrl(id) });
}

// POST → tulis ulang seluruh laporan ke Sheet (refresh manual).
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  if (!sheetEnabled()) {
    return NextResponse.json({ error: "Google Sheet belum dikonfigurasi (GOOGLE_SA_JSON_B64 di .env)" }, { status: 400 });
  }
  const id = await rebuildSheet();
  return NextResponse.json({ ok: true, id, url: id ? sheetUrl(id) : null });
}
