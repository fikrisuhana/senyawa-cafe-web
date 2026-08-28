import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { sheetEnabled, driveStatus, saveDriveCreds, driveAuthUrl, disconnectDrive } from "@/lib/gsheet";

// GET → status koneksi akun Google Drive (buat kartu di Pengaturan).
export async function GET(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  return NextResponse.json(await driveStatus());
}

// PUT → simpan Client ID & Client Secret (dari Google Console).
export async function PUT(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  if (!sheetEnabled()) {
    return NextResponse.json({ error: "Google belum dikonfigurasi (GOOGLE_SA_JSON_B64 di .env)" }, { status: 400 });
  }
  const b = await req.json().catch(() => ({}));
  const clientId = String(b.clientId || "").trim();
  const clientSecret = String(b.clientSecret || "").trim();
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Client ID & Secret wajib" }, { status: 400 });
  await saveDriveCreds(clientId, clientSecret);
  return NextResponse.json({ ok: true });
}

// POST → mulai koneksi (balikin URL consent) / putuskan akun.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "disconnect") {
      await disconnectDrive();
      return NextResponse.json({ ok: true });
    }
    const url = await driveAuthUrl();
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
