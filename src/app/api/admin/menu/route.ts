import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type StockIn = { packagingId: string; qty: number };

function cleanStocks(raw: any): StockIn[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: StockIn[] = [];
  for (const s of raw) {
    const packagingId = String(s?.packagingId || "");
    if (!packagingId || seen.has(packagingId)) continue;
    seen.add(packagingId);
    out.push({ packagingId, qty: Math.max(1, Math.round(Number(s?.qty) || 1)) });
  }
  return out;
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.name) return NextResponse.json({ error: "Nama wajib" }, { status: 400 });
  const stocks = cleanStocks(b.stocks);
  try {
    const m = await prisma.menuItem.create({
      data: {
        name: String(b.name).trim(),
        category: String(b.category || "LAINNYA").toUpperCase(),
        price: Number(b.price) || 0,
        cost: Number(b.cost) || 0,
        active: b.active !== false,
        sortOrder: Number(b.sortOrder) || 0,
        stocks: { create: stocks },
      },
    });
    return NextResponse.json({ ok: true, id: m.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.code === "P2002" ? "Nama menu sudah ada" : "Gagal membuat menu" },
      { status: 400 }
    );
  }
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const stocks = cleanStocks(b.stocks);
  try {
    await prisma.$transaction([
      prisma.menuItem.update({
        where: { id: b.id },
        data: {
          name: String(b.name).trim(),
          category: String(b.category || "LAINNYA").toUpperCase(),
          price: Number(b.price) || 0,
          cost: Number(b.cost) || 0,
          active: b.active !== false,
          sortOrder: Number(b.sortOrder) || 0,
        },
      }),
      prisma.menuStock.deleteMany({ where: { menuItemId: b.id } }),
      prisma.menuStock.createMany({
        data: stocks.map((s) => ({ menuItemId: b.id, packagingId: s.packagingId, qty: s.qty })),
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.code === "P2002" ? "Nama menu sudah ada" : "Gagal menyimpan" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
