import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";

export async function POST(req: Request) {
  const user = await getSession();
  const b = await req.json().catch(() => ({}));
  const type = b.type === "MASUK" ? "MASUK" : b.type === "KELUAR" ? "KELUAR" : null;
  const amount = Math.round(Number(b.amount) || 0);
  if (!type) return NextResponse.json({ error: "Tipe harus MASUK/KELUAR" }, { status: 400 });
  if (amount <= 0) return NextResponse.json({ error: "Nominal harus > 0" }, { status: 400 });

  const settings = await getSettings();
  const businessDate = b.businessDate || businessDateKey(new Date(), settings.dayCutoffHour);

  const e = await prisma.cashEntry.create({
    data: {
      type,
      amount,
      category: String(b.category || "LAINNYA").trim() || "LAINNYA",
      note: b.note ? String(b.note) : null,
      businessDate,
      userName: user?.name || null,
    },
  });
  return NextResponse.json({ ok: true, id: e.id });
}

// Edit kas: ubah nominal / keterangan / kategori / tipe. Hanya field yang dikirim.
export async function PUT(req: Request) {
  await getSession();
  const b = await req.json().catch(() => ({}));
  const id = b.id ? String(b.id) : "";
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const data: { type?: string; amount?: number; category?: string; note?: string | null } = {};
  if (b.type === "MASUK" || b.type === "KELUAR") data.type = b.type;
  if (b.amount !== undefined) {
    const amount = Math.round(Number(b.amount) || 0);
    if (amount <= 0) return NextResponse.json({ error: "Nominal harus > 0" }, { status: 400 });
    data.amount = amount;
  }
  if (b.category !== undefined) data.category = String(b.category || "LAINNYA").trim() || "LAINNYA";
  if (b.note !== undefined) data.note = b.note ? String(b.note) : null;
  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });

  const e = await prisma.cashEntry.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: e.id });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.cashEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
