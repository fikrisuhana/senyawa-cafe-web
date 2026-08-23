import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayKey, businessDateRange, labelHari } from "@/lib/bizday";
import { rupiah } from "@/lib/format";
import { labelBulan } from "@/lib/period";
import Link from "next/link";
import DashboardStats, { type StatData } from "@/components/DashboardStats";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const settings = await getSettings();
  const sp = await searchParams;
  const today = todayKey(settings.dayCutoffHour);
  const ym = today.slice(0, 7); // "YYYY-MM"
  const statMonth = sp.bulan || ym;
  const { start, end } = businessDateRange(today, settings.dayCutoffHour);

  const [todayAgg, monthAgg, packs, monthItems, cashMonth] = await Promise.all([
    prisma.transaction.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { businessDate: { startsWith: ym } },
      _sum: { total: true, costTotal: true },
      _count: true,
    }),
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
    prisma.transactionItem.findMany({
      where: { transaction: { businessDate: { startsWith: ym } } },
      select: { name: true, qty: true, subtotal: true },
    }),
    prisma.cashEntry.findMany({ where: { businessDate: { startsWith: ym } } }),
  ]);

  const omzetToday = todayAgg._sum.total || 0;
  const omzetMonth = monthAgg._sum.total || 0;
  const untungMonth = omzetMonth - (monthAgg._sum.costTotal || 0);

  const manualMasuk = cashMonth.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amount, 0);
  const keluar = cashMonth.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amount, 0);
  const saldo = omzetMonth + manualMasuk - keluar;

  const lowStock = packs.filter((p) => p.stock <= p.minStock);

  const topMap = new Map<string, { qty: number; total: number }>();
  for (const it of monthItems) {
    const c = topMap.get(it.name) || { qty: 0, total: 0 };
    c.qty += it.qty;
    c.total += it.subtotal;
    topMap.set(it.name, c);
  }
  const top = [...topMap.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  const bulanLabel = labelBulan(ym);

  // --- Data statistik untuk bulan terpilih ---
  const statTrx = await prisma.transaction.findMany({
    where: { businessDate: { startsWith: statMonth } },
    include: { items: true },
  });
  const perHari = new Map<string, number>();
  const perMetode = new Map<string, number>();
  const perKategori = new Map<string, number>();
  const perMenu = new Map<string, number>();
  for (const t of statTrx) {
    perHari.set(t.businessDate, (perHari.get(t.businessDate) || 0) + t.total);
    perMetode.set(t.payment, (perMetode.get(t.payment) || 0) + t.total);
    for (const it of t.items) {
      perKategori.set(it.category || "LAINNYA", (perKategori.get(it.category || "LAINNYA") || 0) + it.subtotal);
      perMenu.set(it.name, (perMenu.get(it.name) || 0) + it.qty);
    }
  }
  const toBars = (m: Map<string, number>, sortByKey = false) =>
    [...m.entries()]
      .sort((a, b) => (sortByKey ? a[0].localeCompare(b[0]) : b[1] - a[1]))
      .map(([label, value]) => ({ label, value }));

  const statData: StatData = {
    month: statMonth,
    omzetHarian: toBars(perHari, true).map((b) => ({ ...b, label: b.label.slice(8) })), // tanggal saja
    terlaris: toBars(perMenu).slice(0, 8),
    metode: toBars(perMetode),
    kategori: toBars(perKategori),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Dashboard</h1>
        <p className="text-xs text-slate-500">
          Hari usaha {labelHari(today)} · bulan {bulanLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Omzet hari ini" value={rupiah(omzetToday)} sub={`${todayAgg._count} transaksi`} accent />
        <Stat label="Omzet bulan ini" value={rupiah(omzetMonth)} sub={`${monthAgg._count} transaksi`} />
        <Stat label="Untung kotor (bulan)" value={rupiah(untungMonth)} good />
        <Stat label="Kas masuk lain (bulan)" value={rupiah(manualMasuk)} />
        <Stat label="Pengeluaran (bulan)" value={rupiah(keluar)} bad />
        <Stat label="Saldo bersih (bulan)" value={rupiah(saldo)} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Stok menipis</h2>
            <Link href="/admin/stok" className="text-xs text-brand-700 hover:underline">
              kelola stok →
            </Link>
          </div>
          <div className="space-y-1">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {p.stock} {p.unit} (min {p.minStock})
                </span>
              </div>
            ))}
            {lowStock.length === 0 && (
              <p className="text-sm text-slate-500">Semua stok aman 👍</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Menu terlaris (bulan ini)</h2>
            <Link href="/rekap" className="text-xs text-brand-700 hover:underline">
              rekap →
            </Link>
          </div>
          <div className="space-y-1">
            {top.map(([name, v], i) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span>
                  <span className="mr-2 text-slate-400">{i + 1}.</span>
                  {name}
                </span>
                <span className="font-medium">
                  {v.qty}× · {rupiah(v.total)}
                </span>
              </div>
            ))}
            {top.length === 0 && <p className="text-sm text-slate-500">Belum ada penjualan.</p>}
          </div>
        </div>
      </div>

      <DashboardStats data={statData} monthLabel={labelBulan(statMonth)} />

      <div className="flex flex-wrap gap-2">
        <Link href="/kasir" className="btn-primary">🧾 Buka Kasir</Link>
        <Link href="/admin/keuangan" className="btn-ghost">💰 Catatan Keuangan</Link>
        <Link href="/admin/menu" className="btn-ghost">🍽️ Kelola Menu</Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  good,
  bad,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-xl font-bold ${
          accent ? "text-brand-700" : good ? "text-emerald-600" : bad ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
