import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST {kind:"group", menuItemId, name, type, required} | {kind:"option", groupId, name, priceDelta}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.kind === "group") {
    if (!b.menuItemId || !b.name)
      return NextResponse.json({ error: "menuItemId & nama wajib" }, { status: 400 });
    const g = await prisma.variantGroup.create({
      data: {
        menuItemId: b.menuItemId,
        name: String(b.name).trim(),
        type: b.type === "MULTI" ? "MULTI" : "SINGLE",
        required: !!b.required,
      },
    });
    return NextResponse.json({ ok: true, id: g.id });
  }
  if (b.kind === "option") {
    if (!b.groupId || !b.name)
      return NextResponse.json({ error: "groupId & nama wajib" }, { status: 400 });
    const o = await prisma.variantOption.create({
      data: {
        groupId: b.groupId,
        name: String(b.name).trim(),
        priceDelta: Math.round(Number(b.priceDelta) || 0),
      },
    });
    return NextResponse.json({ ok: true, id: o.id });
  }
  if (b.kind === "optionStock") {
    if (!b.optionId || !b.packagingId)
      return NextResponse.json({ error: "optionId & packagingId wajib" }, { status: 400 });
    try {
      const s = await prisma.variantOptionStock.create({
        data: {
          optionId: b.optionId,
          packagingId: b.packagingId,
          qty: Math.max(1, Math.round(Number(b.qty) || 1)),
        },
      });
      return NextResponse.json({ ok: true, id: s.id });
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.code === "P2002" ? "Bahan sudah ada di opsi ini" : "Gagal" },
        { status: 400 }
      );
    }
  }
  return NextResponse.json({ error: "kind tidak dikenal" }, { status: 400 });
}

// PUT {kind:"optionStock", id, packagingId, qty} — ubah bahan opsi
export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.kind === "optionStock") {
    if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
    const data: any = {};
    if (b.packagingId) data.packagingId = b.packagingId;
    if (b.qty !== undefined) data.qty = Math.max(1, Math.round(Number(b.qty) || 1));
    try {
      await prisma.variantOptionStock.update({ where: { id: b.id }, data });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.code === "P2002" ? "Bahan itu sudah ada di opsi ini" : "Gagal menyimpan" },
        { status: 400 }
      );
    }
  }
  return NextResponse.json({ error: "kind tidak dikenal" }, { status: 400 });
}

// DELETE ?kind=group|option|optionStock&id=...
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  if (kind === "group") await prisma.variantGroup.delete({ where: { id } });
  else if (kind === "option") await prisma.variantOption.delete({ where: { id } });
  else if (kind === "optionStock") await prisma.variantOptionStock.delete({ where: { id } });
  else return NextResponse.json({ error: "kind tidak dikenal" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
