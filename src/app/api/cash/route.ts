import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";

// Catatan kas untuk KASIR (mis. beli es hari ini).
// Body: { type, amount, category?, note?, clientId?, businessDate? }.
// `clientId` (dari HP): idempotent — retry antre offline tak bikin dobel.
// `businessDate` (dari HP): replay antre di hari berikutnya tetap landing di hari yang benar.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const type = b.type === "MASUK" ? "MASUK" : "KELUAR";
  const amount = Math.round(Number(b.amount) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Nominal harus > 0" }, { status: 400 });

  const clientId = b.clientId ? String(b.clientId).slice(0, 100) : null;
  if (clientId) {
    const dup = await prisma.cashEntry.findUnique({ where: { clientId } });
    if (dup) return NextResponse.json({ ok: true, id: dup.id, duplicate: true });
  }

  const settings = await getSettings();
  const businessDate =
    typeof b.businessDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.businessDate)
      ? b.businessDate
      : businessDateKey(new Date(), settings.dayCutoffHour);

  const e = await prisma.cashEntry.create({
    data: {
      type,
      amount,
      category: String(b.category || "Lainnya").trim() || "Lainnya",
      note: b.note ? String(b.note).slice(0, 200) : null,
      businessDate,
      userName: user.name,
      clientId,
    },
  });
  return NextResponse.json({ ok: true, id: e.id });
}
