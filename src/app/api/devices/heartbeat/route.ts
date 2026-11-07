import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

// Aplikasi HP/tablet melapor tiap ±30 dtk: siapa dia, izin deteksi apa yg aktif.
// Balik peran yg diatur admin di web (master? aktif?).
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const deviceId = String(b.deviceId || "").trim().slice(0, 80);
  if (!deviceId) return NextResponse.json({ error: "deviceId wajib" }, { status: 400 });
  const data = {
    name: String(b.name || "Perangkat").slice(0, 80),
    appVersion: b.appVersion ? String(b.appVersion).slice(0, 30) : null,
    userName: user.name,
    notifAccess: b.notifAccess === true,
    historyAccess: b.historyAccess === true,
    hasGopay: b.hasGopay === true,
    lastSeenAt: new Date(),
  };
  const d = await prisma.device.upsert({ where: { deviceId }, update: data, create: { deviceId, ...data } });
  return NextResponse.json({ ok: true, isMaster: d.isMaster && d.enabled, enabled: d.enabled });
}
