import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { expectedCash } from "@/lib/closing";

/**
 * TUTUP KASIR (kasir & admin; web maupun HP lewat Bearer).
 * GET  → hitungan uang laci seharusnya sekarang + tutup kasir hari ini
 * POST { counted, shift?, cashierName?, note?, clientId? } → simpan (seharusnya dihitung ulang di server)
 */
export async function GET(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (user.role === "BELANJA") return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const exp = await expectedCash();
  const today = await prisma.cashClosing.findMany({ where: { businessDate: exp.businessDate }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ ok: true, ...exp, closings: today });
}

export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (user.role === "BELANJA") return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const counted = Math.round(Number(b.counted));
  if (!Number.isFinite(counted) || counted < 0) return NextResponse.json({ error: "Isi jumlah uang di laci" }, { status: 400 });
  const clientId = b.clientId ? String(b.clientId).slice(0, 80) : null;
  if (clientId) {
    const dup = await prisma.cashClosing.findUnique({ where: { clientId } });
    if (dup) return NextResponse.json({ ok: true, closing: dup, duplicate: true });
  }
  const exp = await expectedCash();
  const closing = await prisma.cashClosing.create({
    data: {
      businessDate: exp.businessDate,
      shift: b.shift ? String(b.shift).slice(0, 40) : null,
      cashierName: String(b.cashierName || user.name).slice(0, 60),
      since: exp.since ?? new Date(new Date().setHours(0, 0, 0, 0)),
      kasAwal: exp.kasAwal,
      cashSales: exp.cashSales,
      cashIn: exp.cashIn,
      cashOut: exp.cashOut,
      expected: exp.expected,
      counted,
      diff: counted - exp.expected,
      trxCount: exp.trxCount,
      note: b.note ? String(b.note).slice(0, 200) : null,
      clientId,
    },
  });
  return NextResponse.json({ ok: true, closing });
}
