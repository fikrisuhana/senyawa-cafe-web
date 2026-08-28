import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayKey, businessDateRange, labelHari } from "@/lib/bizday";
import { rupiah } from "@/lib/format";
import { labelBulan, resolvePeriod } from "@/lib/period";
import { shiftRanges } from "@/lib/shifts";
import PeriodDropdown from "@/components/PeriodDropdown";
import ShiftFilter from "@/components/ShiftFilter";
import Link from "next/link";
import DashboardStats, { type StatData } from "@/components/DashboardStats";
import {
  LayoutGrid,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Sparkles,
  Utensils,
  Plus,
  Flame,
  CheckCircle2,
  Package,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; preset?: string; date?: string; month?: string; shift?: string }>;
}) {
  const settings = await getSettings();
  const sp = await searchParams;
  const today = todayKey(settings.dayCutoffHour);
  const ym = today.slice(0, 7); // "YYYY-MM"
  // Periode pilihan owner (default: bulan berjalan biar transisi mulus).
  const hasPeriod = sp.mode || sp.preset;
  const period = hasPeriod
    ? resolvePeriod(sp, settings.dayCutoffHour)
    : resolvePeriod({ mode: "bulan", month: ym }, settings.dayCutoffHour);
  const pf = period.filter; // dipakai semua agregat periode
  const { start, end } = businessDateRange(today, settings.dayCutoffHour);

  // Filter shift (Semua / Pagi / Malam) — scoped ke angka PENJUALAN;
  // kas manual & biaya owner tetap level hari (gak punya shift).
  const shiftNames = (await shiftRanges()).map((r) => r.name);
  const shift = shiftNames.includes(sp.shift || "") ? sp.shift! : "";
  const sf = shift ? { shift } : {};

  const [todayAgg, periodAgg, packs, periodItems, cashPeriod, purchPeriod] = await Promise.all([
    prisma.transaction.aggregate({
      where: { createdAt: { gte: start, lt: end }, status: { not: "VOID" }, ...sf },
      _sum: { total: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { businessDate: pf, status: { not: "VOID" }, ...sf },
      _sum: { total: true, costTotal: true },
      _count: true,
    }),
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
    prisma.transactionItem.findMany({
      where: { transaction: { businessDate: pf, status: { not: "VOID" }, ...sf } },
      select: { name: true, qty: true, subtotal: true },
    }),
    prisma.cashEntry.findMany({ where: { businessDate: pf } }),
    prisma.purchase.findMany({ where: { businessDate: pf }, select: { category: true, total: true } }),
  ]);

  const omzetToday = todayAgg._sum.total || 0;
  const omzetMonth = periodAgg._sum.total || 0;
  const untungMonth = omzetMonth - (periodAgg._sum.costTotal || 0);

  const manualMasuk = cashPeriod.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amount, 0);
  const keluar = cashPeriod.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amount, 0);
  const saldo = omzetMonth + manualMasuk - keluar;

  // Biaya OWNER (uang sendiri — belanja bulanan/gaji/lain), terpisah dari laci.
  const biayaOwner = purchPeriod.reduce((s, p) => s + p.total, 0);
  const biayaBelanja = purchPeriod.filter((p) => p.category === "BELANJA" || !p.category).reduce((s, p) => s + p.total, 0);
  const biayaGaji = purchPeriod.filter((p) => p.category === "GAJI").reduce((s, p) => s + p.total, 0);
  const untungBersih = untungMonth - biayaOwner;

  const lowStock = packs.filter((p) => p.stock <= p.minStock);

  const topMap = new Map<string, { qty: number; total: number }>();
  for (const it of periodItems) {
    const c = topMap.get(it.name) || { qty: 0, total: 0 };
    c.qty += it.qty;
    c.total += it.subtotal;
    topMap.set(it.name, c);
  }
  const top = [...topMap.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  const bulanLabel = labelBulan(ym);

  // --- Data statistik untuk bulan terpilih ---
  const statTrx = await prisma.transaction.findMany({
    where: { businessDate: pf, status: { not: "VOID" }, ...sf },
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
    month: period.mode === "bulan" ? period.month : period.start.slice(0, 7),
    omzetHarian: toBars(perHari, true).map((b) => ({ ...b, label: b.label.slice(8) })), // tanggal saja
    terlaris: toBars(perMenu).slice(0, 8),
    metode: toBars(perMetode),
    kategori: toBars(perKategori),
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Dashboard Ringkasan Operasional</h2>
            <p className="text-xs text-slate-500">
              Hari usaha {labelHari(today)} · Laporan aktif: <strong className="text-slate-700">{period.label}</strong>
              {shift && <> · <strong className="text-blue-600">Shift {shift}</strong></>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShiftFilter shifts={shiftNames} current={shift} />
          <PeriodDropdown preset={period.preset} date={period.date} />
          <Link
            href="/kasir"
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Buka Kasir</span>
          </Link>
        </div>
      </div>

      {/* KPI Top Row Cards (ala app-monitoring) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900 leading-tight font-mono truncate">{rupiah(omzetToday)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">OMZET HARI INI</div>
            <div className="text-[11px] text-blue-600 font-medium">{todayAgg._count} transaksi hari ini</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-emerald-600 leading-tight font-mono truncate">{rupiah(omzetMonth)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">OMZET PERIODE</div>
            <div className="text-[11px] text-emerald-600 font-medium">{periodAgg._count} total transaksi</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-purple-600 leading-tight font-mono truncate">{rupiah(untungBersih)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">ESTIMASI UNTUNG BERSIH</div>
            <div className="text-[11px] text-slate-400">Untung kotor: {rupiah(untungMonth)}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-800 leading-tight font-mono truncate">{rupiah(saldo)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">SALDO BERSIH KAS LACI</div>
            <div className="text-[11px] text-slate-400">Keluar: {rupiah(keluar)}</div>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Kas Masuk Lain</span>
            <span className="font-mono text-sm font-bold text-slate-800">{rupiah(manualMasuk)}</span>
          </div>
          <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Pengeluaran Laci</span>
            <span className="font-mono text-sm font-bold text-rose-600">{rupiah(keluar)}</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-rose-500" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Biaya Belanja Owner</span>
            <span className="font-mono text-sm font-bold text-slate-800">{rupiah(biayaBelanja)}</span>
          </div>
          <Package className="w-4 h-4 text-amber-500" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Biaya Gaji</span>
            <span className="font-mono text-sm font-bold text-slate-800">{rupiah(biayaGaji)}</span>
          </div>
          <Utensils className="w-4 h-4 text-blue-500" />
        </div>
      </div>

      {/* Side-by-Side: Stok Menipis & Menu Terlaris */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stok Menipis Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Peringatan Stok & Bahan</h3>
                <p className="text-[11px] text-slate-400">Bahan atau kemasan yang berada di bawah batas minimum</p>
              </div>
            </div>
            <Link
              href="/admin/stok"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <span>Kelola Stok</span>
              <span>→</span>
            </Link>
          </div>

          <div className="space-y-2">
            {lowStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/50 border border-rose-100 text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="font-semibold text-slate-800">{p.name}</span>
                </div>
                <span className="pill-red font-mono">
                  Sisa {p.stock} {p.unit} (Min {p.minStock})
                </span>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="font-medium text-slate-600">Semua stok bahan dan kemasan aman</span>
              </div>
            )}
          </div>
        </div>

        {/* Menu Terlaris Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Top 5 Menu Terlaris</h3>
                <p className="text-[11px] text-slate-400">Berdasarkan volume penjualan pada periode terpilih</p>
              </div>
            </div>
            <Link
              href="/rekap"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <span>Rekap Lengkap</span>
              <span>→</span>
            </Link>
          </div>

          <div className="space-y-2">
            {top.map(([name, v], i) => (
              <div
                key={name}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 font-bold text-[11px] flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-slate-800">{name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="pill-blue font-mono">{v.qty} porsi</span>
                  <span className="font-mono font-bold text-slate-800">{rupiah(v.total)}</span>
                </div>
              </div>
            ))}
            {top.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                Belum ada transaksi penjualan pada periode ini.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Analytics / Chart Section */}
      <DashboardStats data={statData} monthLabel={period.label} />

      {/* Quick Navigation Footers */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
        <Link href="/kasir" className="btn-primary">
          <Receipt className="w-4 h-4" />
          <span>Buka Kasir</span>
        </Link>
        <Link href="/admin/keuangan" className="btn-ghost">
          <Wallet className="w-4 h-4 text-slate-500" />
          <span>Catatan Keuangan</span>
        </Link>
        <Link href="/admin/menu" className="btn-ghost">
          <Utensils className="w-4 h-4 text-slate-500" />
          <span>Kelola Menu</span>
        </Link>
      </div>
    </div>
  );
}
