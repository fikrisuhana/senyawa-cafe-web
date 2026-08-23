import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id, reason } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id transaksi wajib" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.findUnique({ where: { id } });
      if (!trx) throw new Error("Transaksi tidak ditemukan");
      if (trx.status === "VOID") throw new Error("Transaksi sudah dibatalkan");

      // Kembalikan stok bahan dari pergerakan SALE transaksi ini.
      const moves = await tx.stockMovement.findMany({
        where: { transactionId: id, type: "SALE" },
      });
      for (const mv of moves) {
        const p = await tx.packaging.findUnique({ where: { id: mv.packagingId } });
        if (!p) continue;
        const back = -mv.delta; // delta SALE negatif → kembalikan positif
        const after = p.stock + back;
        await tx.packaging.update({ where: { id: p.id }, data: { stock: after } });
        await tx.stockMovement.create({
          data: {
            packagingId: p.id,
            type: "VOID",
            delta: back,
            before: p.stock,
            after,
            note: "Pembatalan " + trx.code,
            userName: user.name,
            transactionId: id,
          },
        });
      }

      // Kembalikan kuota voucher (kalau ada & masih terpakai)
      if (trx.voucherId) {
        await tx.voucher.updateMany({
          where: { id: trx.voucherId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await tx.transaction.update({
        where: { id },
        data: {
          status: "VOID",
          voidedAt: new Date(),
          voidedBy: user.name,
          voidReason: reason ? String(reason) : null,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membatalkan" }, { status: 400 });
  }
}
