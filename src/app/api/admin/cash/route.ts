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

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.cashEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
