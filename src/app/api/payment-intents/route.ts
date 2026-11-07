import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createIntent, masterStatus } from "@/lib/gopay";

// Kasir (HP/tablet/web) membuat tagihan QR → dapat nominal (+kode unik bila bentrok)
// & payload QRIS bernominal; lalu polling GET /api/payment-intents/:id.
export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const { intent, qris } = await createIntent({
      amount: Number(b.amount),
      label: b.label,
      source: ["KASIR", "WEB", "MEJA"].includes(b.source) ? b.source : "KASIR",
      createdBy: user.name,
    });
    return NextResponse.json({
      ok: true,
      id: intent.id,
      amount: intent.amount,
      baseAmount: intent.baseAmount,
      uniqueCode: intent.uniqueCode,
      expiresAt: intent.expiresAt,
      qris,
      ...(await masterStatus()),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
