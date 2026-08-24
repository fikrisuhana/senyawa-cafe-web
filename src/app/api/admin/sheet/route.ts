import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { sheetEnabled, getOrCreateSheet, rebuildSheet, sheetUrl } from "@/lib/gsheet";

// GET → status + link spreadsheet (buat/ambil kalau perlu).
export async function GET(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  if (!sheetEnabled()) return NextResponse.json({ enabled: false });
  const id = await getOrCreateSheet();
  return NextResponse.json({ enabled: true, id, url: id ? sheetUrl(id) : null });
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
