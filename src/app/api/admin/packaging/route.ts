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

  let after: number;
  if (typeof b.setTo === "number") after = Math.round(b.setTo);
  else after = p.stock + Math.round(Number(b.delta) || 0);
  if (after < 0) after = 0;
  const delta = after - p.stock;

  await prisma.$transaction([
    prisma.packaging.update({ where: { id: p.id }, data: { stock: after } }),
    prisma.stockMovement.create({
      data: {
        packagingId: p.id,
        type: "ADJUST",
        delta,
        before: p.stock,
        after,
        note: b.note || null,
        userName: user?.name || null,
      },
    }),
  ]);
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
