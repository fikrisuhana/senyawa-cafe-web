import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { integrationAuth } from "@/lib/integration";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";
import { syncOpsToSheet, uploadNotaToDrive } from "@/lib/gsheet";

/**
 * BELANJA dari aplikasi pusat (timetable) — X-Integration-Key. Sama efeknya dengan
 * catat belanja di web kasir: tercatat di Keuangan/biaya owner + (opsional) STOK bahan nambah.
 * GET    ?from&to          → daftar belanja (+ bahan yang ikut ditambah)
 * POST   JSON / multipart  { itemName, qty, unitPrice, unit?, note?, category?, businessDate?, by?,
 *                            restockPackaging? (NAMA bahan), restockQty?, restockMode? "buy"|"base", nota? (file) }
 * DELETE ?id=              → hapus catatan + stok yang dulu ditambah dikurangi lagi (sama dgn web kasir)
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const NOTA_MAX = 8 * 1024 * 1024;

export async function GET(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return NextResponse.json({ error: "from/to wajib YYYY-MM-DD" }, { status: 400 });
  const rows = await prisma.purchase.findMany({
    where: { businessDate: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const moves = await prisma.stockMovement.findMany({
    where: { transactionId: { in: rows.map((r) => r.id) }, type: "RESTOCK" },
    include: { packaging: { select: { name: true, unit: true } } },
  });
  const byId = new Map(moves.map((m) => [m.transactionId!, m]));
  return NextResponse.json({
    ok: true,
    purchases: rows.map((r) => {
      const m = byId.get(r.id);
      return {
        id: r.id,
        businessDate: r.businessDate,
        category: r.category,
        itemName: r.itemName,
        qty: r.qty,
        unit: r.unit,
        unitPrice: r.unitPrice,
        total: r.total,
        note: r.note,
        notaUrl: r.notaUrl,
        userName: r.userName,
        createdAt: r.createdAt.toISOString(),
        restock: m ? { packaging: m.packaging.name, delta: m.delta, unit: m.packaging.unit } : null,
      };
    }),
  });
}

export async function POST(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ct = req.headers.get("content-type") || "";
  let b: Record<string, unknown> = {};
  let nota: { name: string; type: string; buf: Buffer } | null = null;
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) if (typeof v === "string") b[k] = v;
    const f = fd.get("nota");
    if (f && typeof f !== "string" && f.size > 0) {
      if (f.size > NOTA_MAX) return NextResponse.json({ error: "File nota maksimal 8MB" }, { status: 400 });
      if (!NOTA_TYPES.includes(f.type)) return NextResponse.json({ error: "Format nota: JPG/PNG/WebP/PDF" }, { status: 400 });
      nota = { name: f.name || "nota", type: f.type, buf: Buffer.from(await f.arrayBuffer()) };
    }
  } else {
    b = await req.json().catch(() => ({}));
  }

  const itemName = String(b.itemName || "").trim().slice(0, 120);
  const qty = Math.max(1, Math.round(Number(b.qty) || 1));
  const unitPrice = Math.round(Number(b.unitPrice) || 0);
  const category = ["BELANJA", "GAJI", "LAIN"].includes(String(b.category)) ? String(b.category) : "BELANJA";
  if (!itemName) return NextResponse.json({ error: "Nama barang wajib" }, { status: 400 });
  if (unitPrice <= 0) return NextResponse.json({ error: "Harga harus > 0" }, { status: 400 });
  const by = String(b.by || "Pusat").slice(0, 60);

  let businessDate = String(b.businessDate || "");
  if (!DATE_RE.test(businessDate)) {
    const settings = await getSettings();
    businessDate = businessDateKey(new Date(), settings.dayCutoffHour);
  }

  // Bahan yang mau ditambah stoknya (dicari lewat NAMA) — cek dulu sebelum mencatat apa pun.
  const packName = String(b.restockPackaging || "").trim();
  const rQty = Math.round(Number(b.restockQty) || 0);
  const pack = packName ? await prisma.packaging.findUnique({ where: { name: packName } }) : null;
  if (packName && !pack) return NextResponse.json({ error: `Bahan "${packName}" belum ada di kasir outlet ini` }, { status: 400 });

  let notaUrl: string | null = null;
  let notaName: string | null = null;
  let warning = "";
  if (nota) {
    try {
      const up = await uploadNotaToDrive(nota.name, nota.type, nota.buf);
      notaUrl = up.url;
      notaName = up.name;
    } catch (e) {
      warning = `Catatan tersimpan, tapi upload nota gagal (${(e as Error).message.slice(0, 80)}).`;
    }
  }

  const p = await prisma.purchase.create({
    data: {
      businessDate,
      category,
      itemName,
      qty,
      unit: b.unit ? String(b.unit).slice(0, 20) : null,
      unitPrice,
      total: qty * unitPrice,
      note: b.note ? String(b.note).slice(0, 200) : null,
      notaUrl,
      notaName,
      userName: by,
    },
  });

  let restocked = 0;
  if (pack && rQty > 0) {
    const delta = rQty * (b.restockMode === "base" ? 1 : Math.max(1, pack.buyFactor || 1));
    const after = Math.max(0, pack.stock + delta);
    await prisma.$transaction([
      prisma.packaging.update({ where: { id: pack.id }, data: { stock: after } }),
      prisma.stockMovement.create({
        data: { packagingId: pack.id, type: "RESTOCK", delta, before: pack.stock, after, note: `Belanja: ${itemName}`, transactionId: p.id, userName: by },
      }),
    ]);
    restocked = delta;
  }
  void syncOpsToSheet();
  return NextResponse.json({ ok: true, id: p.id, total: p.total, businessDate, restocked, notaUrl, warning });
}

export async function DELETE(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Catatan tidak ditemukan" }, { status: 404 });
  const move = await prisma.stockMovement.findFirst({ where: { transactionId: id, type: "RESTOCK" } });
  await prisma.$transaction(async (tx) => {
    if (move && move.delta > 0) {
      const pack = await tx.packaging.findUnique({ where: { id: move.packagingId } });
      if (pack) await tx.packaging.update({ where: { id: pack.id }, data: { stock: Math.max(0, pack.stock - move.delta) } });
      await tx.stockMovement.delete({ where: { id: move.id } });
    }
    await tx.purchase.delete({ where: { id } });
  });
  void syncOpsToSheet();
  return NextResponse.json({ ok: true });
}
