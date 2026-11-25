import { prisma } from "./db";
import { getSettings } from "./settings";
import { businessDateKey } from "./bizday";
import { cashPortion } from "./payments";

/**
 * Hitung uang laci SEHARUSNYA untuk tutup kasir sekarang:
 *   kas awal (setelan laci) + penjualan TUNAI + kas masuk − kas keluar
 * sejak tutup kasir terakhir di hari usaha yang sama (kalau belum ada: sejak awal hari).
 * Porsi tunai transaksi SPLIT ikut dihitung (lib/payments cashPortion).
 */
export async function expectedCash(now = new Date()) {
  const settings = await getSettings();
  const businessDate = businessDateKey(now, settings.dayCutoffHour);
  const last = await prisma.cashClosing.findFirst({ where: { businessDate }, orderBy: { createdAt: "desc" } });
  const since = last?.createdAt ?? new Date(0);
  const [txs, entries] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate, status: { not: "VOID" }, createdAt: { gt: since, lte: now } },
      select: { total: true, payment: true, payments: true },
    }),
    prisma.cashEntry.findMany({ where: { businessDate, createdAt: { gt: since, lte: now } }, select: { type: true, amount: true } }),
  ]);
  const cashSales = txs.reduce((s, t) => s + cashPortion(t), 0);
  const cashIn = entries.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amount, 0);
  const cashOut = entries.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amount, 0);
  const kasAwal = settings.kasAwal;
  return {
    businessDate,
    since: last ? since : null,
    previousClosings: await prisma.cashClosing.count({ where: { businessDate } }),
    kasAwal,
    cashSales,
    cashIn,
    cashOut,
    expected: kasAwal + cashSales + cashIn - cashOut,
    trxCount: txs.length,
  };
}
