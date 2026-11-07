import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ingestEvents } from "@/lib/gopay";

// HP MASTER melapor notif & baris riwayat GoPay Merchant. Hanya perangkat yang
// DITETAPKAN admin sebagai master & aktif yang diterima.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const deviceId = String(b.deviceId || "");
  const dev = deviceId ? await prisma.device.findUnique({ where: { deviceId } }) : null;
  if (!dev || !dev.isMaster || !dev.enabled)
    return NextResponse.json({ error: "Perangkat ini bukan master aktif" }, { status: 403 });
  const notifs = Array.isArray(b.notifs) ? b.notifs.slice(0, 200) : [];
  const history = Array.isArray(b.history) ? b.history.slice(0, 300) : [];
  await prisma.device.update({ where: { id: dev.id }, data: { lastSeenAt: new Date() } });
  const r = await ingestEvents(deviceId, notifs, history);
  return NextResponse.json({ ok: true, ...r });
}
