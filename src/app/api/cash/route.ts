import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { businessDateKey } from "@/lib/bizday";

// Catatan kas untuk KASIR (mis. beli es hari ini). Selalu hari usaha berjalan.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const type = b.type === "MASUK" ? "MASUK" : "KELUAR";
  const amount = Math.round(Number(b.amount) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Nominal harus > 0" }, { status: 400 });

  const settings = await getSettings();
  const businessDate = businessDateKey(new Date(), settings.dayCutoffHour);

  const e = await prisma.cashEntry.create({
    data: {
      type,
      amount,
      category: String(b.category || "Lainnya").trim() || "Lainnya",
      note: b.note ? String(b.note).slice(0, 200) : null,
      businessDate,
      userName: user.name,
    },
  });
  return NextResponse.json({ ok: true, id: e.id });
}
