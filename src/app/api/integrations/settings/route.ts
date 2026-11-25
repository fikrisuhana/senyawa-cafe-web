import { NextResponse } from "next/server";
import { integrationAuth } from "@/lib/integration";
import { getSettings } from "@/lib/settings";
import { PUT as adminPut } from "@/app/api/admin/settings/route";

/**
 * Pengaturan kasir dari aplikasi PUSAT (timetable) — X-Integration-Key.
 * GET        → pengaturan (logo cuma kalau ?logo=1, biar ringan)
 * PUT {...}  → diteruskan ke handler Pengaturan web kasir (validasi & kunci yang SAMA persis).
 */
export async function GET(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const s = await getSettings();
  const withLogo = new URL(req.url).searchParams.get("logo") === "1";
  const { logoImage, ...rest } = s;
  return NextResponse.json({ ok: true, settings: { ...rest, hasLogo: !!logoImage, ...(withLogo ? { logoImage } : {}) } });
}

export async function PUT(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.text();
  return adminPut(new Request(req.url, { method: "PUT", headers: { "Content-Type": "application/json" }, body }));
}
