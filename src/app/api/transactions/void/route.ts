import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markVoidedInSheet } from "@/lib/gsheet";
import { getAuthFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id, clientId, reason } = await req.json().catch(() => ({}));
  if (!id && !clientId) return NextResponse.json({ error: "id transaksi wajib" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      // HP mengirim clientId (id lokalnya) — server cari transaksinya.
      const trx = id
        ? await tx.transaction.findUnique({ where: { id } })
        : await tx.transaction.findUnique({ where: { clientId } });
      if (!trx) throw new Error("Transaksi tidak ditemukan");
      if (trx.status === "VOID") throw new Error("Transaksi sudah dibatalkan");
      // Pakai id transaksi HASIL find (HP kirim clientId, bukan id) — bukan `id` mentah.
      const tid = trx.id;

      // Kembalikan stok bahan dari pergerakan SALE transaksi ini.
      const moves = await tx.stockMovement.findMany({
        where: { transactionId: tid, type: "SALE" },
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
            transactionId: tid,
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
        where: { id: tid },
        data: {
          status: "VOID",
          voidedAt: new Date(),
          voidedBy: user.name,
          voidReason: reason ? String(reason) : null,
        },
      });
    });
    const voided = id
      ? await prisma.transaction.findUnique({ where: { id }, select: { code: true } })
      : await prisma.transaction.findUnique({ where: { clientId }, select: { code: true } });
    if (voided) void markVoidedInSheet(voided.code);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membatalkan" }, { status: 400 });
  }
}
