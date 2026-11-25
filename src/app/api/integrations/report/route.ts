import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { integrationAuth } from "@/lib/integration";
import { bucketOf, payParts } from "@/lib/payments";
import { getSettings } from "@/lib/settings";

/**
 * Laporan outlet ini untuk DASHBOARD PUSAT (aplikasi timetable). X-Integration-Key.
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (hari usaha) →
 *   days[]: per hari penjualan (omzet, trx, diskon, modal, per metode bayar), kas masuk/keluar, biaya owner
 *   items[]: terlaris (qty & omzet), categories[], stockLow[] (bahan di bawah minimum).
 * Angka sama dengan halaman Keuangan/Rekap web kasir (transaksi VOID tidak dihitung).
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Day = {
  date: string;
  trx: number;
  omzet: number;
  gross: number;
  discount: number;
  cost: number;
  tunai: number;
  qris: number;
  transfer: number;
  lain: number;
  void: number;
  kasMasuk: number;
  kasKeluar: number;
  belanja: number;
  gaji: number;
  biayaLain: number;
};
const emptyDay = (date: string): Day => ({
  date,
  trx: 0,
  omzet: 0,
  gross: 0,
  discount: 0,
  cost: 0,
  tunai: 0,
  qris: 0,
  transfer: 0,
  lain: 0,
  void: 0,
  kasMasuk: 0,
  kasKeluar: 0,
  belanja: 0,
  gaji: 0,
  biayaLain: 0,
});

export async function GET(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return NextResponse.json({ error: "from/to wajib YYYY-MM-DD" }, { status: 400 });
  const bd = { gte: from, lte: to };

  const [txs, voids, entries, purchases, packs, settings] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate: bd, status: { not: "VOID" } },
      select: {
        businessDate: true,
        total: true,
        grossTotal: true,
        discount: true,
        costTotal: true,
        payment: true,
        payments: true,
        items: { select: { name: true, category: true, qty: true, subtotal: true } },
      },
    }),
    prisma.transaction.groupBy({ by: ["businessDate"], where: { businessDate: bd, status: "VOID" }, _count: true }),
    prisma.cashEntry.findMany({ where: { businessDate: bd }, select: { businessDate: true, type: true, amount: true } }),
    prisma.purchase.findMany({ where: { businessDate: bd }, select: { businessDate: true, category: true, total: true } }),
    prisma.packaging.findMany({ select: { name: true, unit: true, stock: true, minStock: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  const days = new Map<string, Day>();
  const day = (d: string) => days.get(d) || (days.set(d, emptyDay(d)), days.get(d)!);
  const items = new Map<string, { name: string; category: string; qty: number; omzet: number }>();
  const cats = new Map<string, { category: string; qty: number; omzet: number }>();

  for (const t of txs) {
    const d = day(t.businessDate);
    d.trx++;
    d.omzet += t.total;
    d.gross += t.grossTotal || t.total;
    d.discount += t.discount;
    d.cost += t.costTotal;
    for (const p of payParts(t)) d[bucketOf(p.method)] += p.amount;
    for (const it of t.items) {
      const cat = it.category || "LAINNYA";
      const x = items.get(it.name) || { name: it.name, category: cat, qty: 0, omzet: 0 };
      x.qty += it.qty;
      x.omzet += it.subtotal;
      items.set(it.name, x);
      const c = cats.get(cat) || { category: cat, qty: 0, omzet: 0 };
      c.qty += it.qty;
      c.omzet += it.subtotal;
      cats.set(cat, c);
    }
  }
  for (const v of voids) day(v.businessDate).void = v._count;
  for (const e of entries) {
    if (e.type === "MASUK") day(e.businessDate).kasMasuk += e.amount;
    else day(e.businessDate).kasKeluar += e.amount;
  }
  for (const p of purchases) {
    const d = day(p.businessDate);
    if (p.category === "GAJI") d.gaji += p.total;
    else if (p.category === "LAIN") d.biayaLain += p.total;
    else d.belanja += p.total;
  }

  return NextResponse.json({
    ok: true,
    storeName: settings.storeName,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    items: [...items.values()].sort((a, b) => b.qty - a.qty),
    categories: [...cats.values()].sort((a, b) => b.omzet - a.omzet),
    stock: packs,
  });
}
