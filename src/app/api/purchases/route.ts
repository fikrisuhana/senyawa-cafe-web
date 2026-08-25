import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";
import { syncOpsToSheet } from "@/lib/gsheet";

// Catat BIAYA OWNER: { itemName, qty, unitPrice, unit?, note?, category? }.
// category: BELANJA (belanja bulanan/bahan) | GAJI (gaji karyawan) | LAIN.
// Uang OWNER — TIDAK menyentuh kas laci kasir (bukan CashEntry).
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const itemName = String(b.itemName || "").trim();
  const qty = Math.max(1, Math.round(Number(b.qty) || 1));
  const unitPrice = Math.round(Number(b.unitPrice) || 0);
  const category = ["BELANJA", "GAJI", "LAIN"].includes(b.category) ? b.category : "BELANJA";
  if (!itemName) return NextResponse.json({ error: "Nama/deskripsi wajib" }, { status: 400 });
  if (unitPrice <= 0) return NextResponse.json({ error: "Nominal harus > 0" }, { status: 400 });

  const settings = await getSettings();
  const businessDate = businessDateKey(new Date(), settings.dayCutoffHour);
  const total = qty * unitPrice;

  const p = await prisma.purchase.create({
    data: {
      businessDate,
      category,
      itemName,
      qty,
      unit: b.unit ? String(b.unit).slice(0, 20) : null,
      unitPrice,
      total,
      note: b.note ? String(b.note).slice(0, 200) : null,
      userName: user.name,
    },
  });

  // Opsional: sekalian TAMBAH STOK bahan (mis. beli susu 2 liter → stok +2000 ml).
  // `newBahan` = barang BARU (belum ada di daftar) → dibuat dulu, lalu di-restok.
  let pack = null;
  let factorOverride = 1;
  if (b.newBahan) {
    const nbName = String(b.newBahan.name || itemName).trim().slice(0, 60);
    if (nbName) {
      pack =
        (await prisma.packaging.findUnique({ where: { name: nbName } })) ??
        (await prisma.packaging.create({
          data: {
            name: nbName,
            unit: String(b.newBahan.unit || "pcs").slice(0, 20),
            buyUnit: b.newBahan.buyUnit ? String(b.newBahan.buyUnit).slice(0, 20) : null,
            buyFactor: Math.max(1, Math.round(Number(b.newBahan.buyFactor) || 1)),
            stock: 0,
          },
        }));
      factorOverride = Math.max(1, Math.round(Number(b.newBahan.buyFactor) || 1));
    }
  } else if (b.restockPackagingId) {
    pack = await prisma.packaging.findUnique({ where: { id: String(b.restockPackagingId) } });
  }
  {
    const rQty = Math.round(Number(b.restockQty) || 0);
    if (pack && rQty > 0) {
      const factor = b.newBahan
        ? (b.restockMode === "buy" ? factorOverride : 1)
        : b.restockMode === "buy"
          ? Math.max(1, pack.buyFactor || 1)
          : 1;
      const delta = rQty * factor;
      const after = Math.max(0, pack.stock + delta);
      await prisma.$transaction([
        prisma.packaging.update({ where: { id: pack.id }, data: { stock: after } }),
        prisma.stockMovement.create({
          data: {
            packagingId: pack.id,
            type: "RESTOCK",
            delta,
            before: pack.stock,
            after,
            note: `Belanja: ${itemName}`,
            userName: user.name,
          },
        }),
      ]);
    }
  }

  void syncOpsToSheet(); // mirror ke Google Sheet (tab Belanja + Restok_Log)
  return NextResponse.json({ ok: true, id: p.id, total });
}
