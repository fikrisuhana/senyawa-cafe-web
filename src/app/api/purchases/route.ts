import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";
import { syncOpsToSheet } from "@/lib/gsheet";

// Catat BELANJA BARANG owner: { itemName, qty, unitPrice, unit?, note? }.
// Membuat Purchase + CashEntry KELUAR otomatis (kategori "Belanja") supaya
// uang di laci tetap akurat — owner tak perlu catat dua kali.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const itemName = String(b.itemName || "").trim();
  const qty = Math.max(1, Math.round(Number(b.qty) || 1));
  const unitPrice = Math.round(Number(b.unitPrice) || 0);
  if (!itemName) return NextResponse.json({ error: "Nama barang wajib" }, { status: 400 });
  if (unitPrice <= 0) return NextResponse.json({ error: "Harga satuan harus > 0" }, { status: 400 });

  const settings = await getSettings();
  const businessDate = businessDateKey(new Date(), settings.dayCutoffHour);
  const total = qty * unitPrice;

  const [p, ce] = await prisma.$transaction([
    prisma.purchase.create({
      data: {
        businessDate,
        itemName,
        qty,
        unit: b.unit ? String(b.unit).slice(0, 20) : null,
        unitPrice,
        total,
        note: b.note ? String(b.note).slice(0, 200) : null,
        userName: user.name,
      },
    }),
    prisma.cashEntry.create({
      data: {
        type: "KELUAR",
        amount: total,
        category: "Belanja",
        note: `${itemName} x${qty}`,
        businessDate,
        userName: user.name,
      },
    }),
  ]);
  // Jejak/audit: hubungkan cashEntry ke purchase-nya.
  await prisma.purchase.update({ where: { id: p.id }, data: { cashEntryId: ce.id } });

  void syncOpsToSheet(); // mirror ke Google Sheet (tab Belanja & Kas)
  return NextResponse.json({ ok: true, id: p.id, total });
}
