import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { expireOldIntents, masterStatus } from "@/lib/gopay";

// Status tagihan (dipolling kasir tiap ±2 dtk).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const { id } = await params;
  await expireOldIntents();
  const it = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!it) return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
  const pay = it.paymentId ? await prisma.gopayPayment.findUnique({ where: { id: it.paymentId } }) : null;
  return NextResponse.json({
    ok: true,
    status: it.status,
    amount: it.amount,
    paidAt: it.paidAt,
    paidVia: it.paidVia,
    payment: pay ? { ref: pay.ref, title: pay.title, paidAt: pay.paidAt } : null,
    ...(await masterStatus()),
  });
}

// Aksi kasir: { action: "cancel" | "manual" | "local" }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  // manual = kasir cek sendiri; local = HP kasir mendeteksi sendiri (GoPay di HP itu).
  const data =
    b.action === "manual"
      ? { status: "PAID", paidVia: "MANUAL", paidAt: new Date() }
      : b.action === "local"
        ? { status: "PAID", paidVia: "HP", paidAt: new Date() }
        : b.action === "cancel"
          ? { status: "CANCELLED" }
          : null;
  if (!data) return NextResponse.json({ error: "action harus cancel/manual/local" }, { status: 400 });
  const r = await prisma.paymentIntent.updateMany({ where: { id, status: "PENDING" }, data });
  return NextResponse.json({ ok: r.count > 0 });
}
