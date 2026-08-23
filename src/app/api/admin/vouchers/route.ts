import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function norm(b: any) {
  const type = b.type === "NOMINAL" ? "NOMINAL" : "PERCENT";
  let value = Math.round(Number(b.value) || 0);
  if (type === "PERCENT") value = Math.min(100, Math.max(0, value));
  else value = Math.max(0, value);
  return { type, value };
}

// Kuota & periode. Tanggal "YYYY-MM-DD"; validFrom=awal hari, validUntil=akhir hari.
function limits(b: any) {
  const d: any = {};
  if (b.maxUses !== undefined) {
    const n = Number(b.maxUses);
    d.maxUses = b.maxUses === "" || b.maxUses === null || !Number.isFinite(n) || n <= 0 ? null : Math.round(n);
  }
  if (b.validFrom !== undefined) {
    d.validFrom = b.validFrom ? new Date(b.validFrom + "T00:00:00") : null;
  }
  if (b.validUntil !== undefined) {
    d.validUntil = b.validUntil ? new Date(b.validUntil + "T23:59:59") : null;
  }
  return d;
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.name) return NextResponse.json({ error: "Nama wajib" }, { status: 400 });
  const { type, value } = norm(b);
  try {
    const v = await prisma.voucher.create({
      data: { name: String(b.name).trim(), type, value, active: b.active !== false, ...limits(b) },
    });
    return NextResponse.json({ ok: true, id: v.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.code === "P2002" ? "Nama voucher sudah ada" : "Gagal" },
      { status: 400 }
    );
  }
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const data: any = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (b.type !== undefined || b.value !== undefined) Object.assign(data, norm(b));
  if (typeof b.active === "boolean") data.active = b.active;
  Object.assign(data, limits(b));
  await prisma.voucher.update({ where: { id: b.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.voucher.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
