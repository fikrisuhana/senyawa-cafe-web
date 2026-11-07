import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ADMIN (middleware /api/admin): daftar perangkat + atur MASTER (maks 1) & aktif/nonaktif.
export async function GET() {
  const devices = await prisma.device.findMany({ orderBy: [{ isMaster: "desc" }, { lastSeenAt: "desc" }] });
  return NextResponse.json({ ok: true, devices });
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const data: { isMaster?: boolean; enabled?: boolean; name?: string } = {};
  if (typeof b.enabled === "boolean") data.enabled = b.enabled;
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim().slice(0, 80);
  if (typeof b.isMaster === "boolean") data.isMaster = b.isMaster;
  await prisma.$transaction(async (tx) => {
    // Master cuma satu: jadikan master → yang lain dicopot.
    if (data.isMaster) await tx.device.updateMany({ where: { id: { not: id } }, data: { isMaster: false } });
    await tx.device.update({ where: { id }, data });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.device.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
