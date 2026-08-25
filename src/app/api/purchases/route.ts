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

  void syncOpsToSheet(); // mirror ke Google Sheet (tab Belanja)
  return NextResponse.json({ ok: true, id: p.id, total });
}
