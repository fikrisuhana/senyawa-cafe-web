import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncCatalogToSheet, syncOpsToSheet } from "@/lib/gsheet";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.name) return NextResponse.json({ error: "Nama wajib" }, { status: 400 });
  try {
    const p = await prisma.packaging.create({
      data: {
        name: String(b.name).trim(),
        unit: String(b.unit || "pcs"),
        buyUnit: b.buyUnit ? String(b.buyUnit).slice(0, 20) : null,
        buyFactor: Math.max(1, Math.round(Number(b.buyFactor) || 1)),
        stock: Number(b.stock) || 0,
        minStock: Number(b.minStock) || 0,
      },
    });
    return NextResponse.json({ ok: true, id: p.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.code === "P2002" ? "Nama kemasan sudah ada" : "Gagal membuat" },
      { status: 400 }
    );
  }
}

// Penyesuaian stok: {id, delta} atau {id, setTo}
export async function PATCH(req: Request) {
  const user = await getSession();
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const p = await prisma.packaging.findUnique({ where: { id: b.id } });
  if (!p) return NextResponse.json({ error: "Kemasan tidak ditemukan" }, { status: 404 });

  let delta: number;
  if (typeof b.setTo === "number") {
    delta = Math.round(b.setTo) - p.stock;
  } else {
    // mode "buy": angka dalam SATUAN BELI (mis. liter) → konversi ke satuan dasar.
    delta = Math.round(Number(b.delta) || 0);
    if (b.mode === "buy") delta *= Math.max(1, p.buyFactor || 1);
  }
  const after = Math.max(0, p.stock + delta);

  await prisma.$transaction([
    prisma.packaging.update({ where: { id: p.id }, data: { stock: after } }),
    prisma.stockMovement.create({
      data: {
        packagingId: p.id,
        type: delta > 0 ? "RESTOCK" : "ADJUST",
        delta,
        before: p.stock,
        after,
        note: b.note || (b.mode === "buy" ? `Restok ${b.delta} ${p.buyUnit}` : null),
        userName: user?.name || null,
      },
    }),
  ]);
  void syncCatalogToSheet();
  void syncOpsToSheet();
  return NextResponse.json({ ok: true, stock: after });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  // Relasi MenuStock ikut terhapus otomatis (onDelete: Cascade).
  await prisma.packaging.delete({ where: { id } });
  void syncCatalogToSheet(); // mirror katalog ke Sheet (fire-and-forget)
  void syncOpsToSheet(); // mirror kas/absen/restok ke Sheet
  return NextResponse.json({ ok: true });
}

// Edit bahan: satuan dasar, satuan beli + faktor konversi, min stok, nama.
export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const data: any = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (typeof b.unit === "string" && b.unit.trim()) data.unit = b.unit.trim();
  if (b.buyUnit !== undefined) data.buyUnit = b.buyUnit ? String(b.buyUnit).slice(0, 20) : null;
  if (b.buyFactor !== undefined) data.buyFactor = Math.max(1, Math.round(Number(b.buyFactor) || 1));
  if (b.minStock !== undefined) data.minStock = Math.max(0, Math.round(Number(b.minStock) || 0));
  try {
    await prisma.packaging.update({ where: { id: b.id }, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.code === "P2002" ? "Nama sudah ada" : "Gagal" }, { status: 400 });
  }
  void syncCatalogToSheet();
  return NextResponse.json({ ok: true });
}
