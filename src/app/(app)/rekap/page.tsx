import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import { shiftRanges } from "@/lib/shifts";
import { rupiah, waktu } from "@/lib/format";
import Link from "next/link";
import PeriodFilter from "@/components/PeriodFilter";
import ShiftFilter from "@/components/ShiftFilter";
import SpreadsheetCopy from "@/components/SpreadsheetCopy";
import VoidButton from "@/components/VoidButton";
import KasClient from "@/components/KasClient";
import DeleteCash from "@/components/DeleteCash";
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Tag,
  DollarSign,
  Sparkles,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; month?: string; page?: string; shift?: string }>;
}) {
  const user = await getSession();
  const isAdmin = user?.role === "ADMIN";
  const settings = await getSettings();
  const sp = await searchParams;
  const today = todayKey(settings.dayCutoffHour);

  const period = isAdmin
    ? resolvePeriod(sp, settings.dayCutoffHour)
    : resolvePeriod({ mode: "hari", date: today }, settings.dayCutoffHour);

  // Filter shift (Semua / Pagi / Malam) — nama shift dari Setting web.
  const shiftNames = (await shiftRanges()).map((r) => r.name);
  const shift = shiftNames.includes(sp.shift || "") ? sp.shift! : "";

  const [all, cashEntries] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate: period.filter, ...(shift ? { shift } : {}) },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cashEntry.findMany({
      where: { businessDate: period.filter },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const active = all.filter((t) => t.status !== "VOID");

  // Kas & pengeluaran
  const pengeluaran = cashEntries.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amount, 0);
  const kasMasuk = cashEntries.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amount, 0);
  const penjualanTunai = active.filter((t) => t.payment === "TUNAI").reduce((s, t) => s + t.total, 0);
  const hariAktif = new Set<string>(active.map((t) => t.businessDate));
  cashEntries.forEach((e) => hariAktif.add(e.businessDate));
  const kasAwalTotal =
    period.mode === "hari" ? settings.kasAwal : settings.kasAwal * Math.max(1, hariAktif.size);
  const uangLaci = kasAwalTotal + penjualanTunai + kasMasuk - pengeluaran;

  const omzet = active.reduce((s, t) => s + t.total, 0);
  const modal = active.reduce((s, t) => s + t.costTotal, 0);
  const diskon = active.reduce((s, t) => s + t.discount, 0);
  const untung = omzet - modal;
  const jmlVoid = all.length - active.length;

  const perKategori = new Map<string, { qty: number; total: number }>();
  const perMetode = new Map<string, number>();
  const perKasir = new Map<string, { qty: number; total: number }>();
  const perShift = new Map<string, { qty: number; total: number }>();
  for (const t of active) {
    perMetode.set(t.payment, (perMetode.get(t.payment) || 0) + t.total);
    const sh = perShift.get(t.shift || "(tanpa shift)") || { qty: 0, total: 0 };
    sh.qty += 1;
    sh.total += t.total;
    perShift.set(t.shift || "(tanpa shift)", sh);
    const k = perKasir.get(t.cashierName) || { qty: 0, total: 0 };
    k.qty += 1;
    k.total += t.total;
    perKasir.set(t.cashierName, k);
    for (const it of t.items) {
      const c = perKategori.get(it.category || "LAINNYA") || { qty: 0, total: 0 };
      c.qty += it.qty;
      c.total += it.subtotal;
      perKategori.set(it.category || "LAINNYA", c);
    }
  }

  // Rincian item per kategori (drill-down: klik kategori → item terlaris + pcs).
  const perKategoriItems = new Map<string, Map<string, { qty: number; total: number }>>();
  for (const t of active) {
    for (const it of t.items) {
      const cat = it.category || "LAINNYA";
      let items = perKategoriItems.get(cat);
      if (!items) perKategoriItems.set(cat, (items = new Map()));
      const cur = items.get(it.name) || { qty: 0, total: 0 };
      cur.qty += it.qty;
      cur.total += it.subtotal;
      items.set(it.name, cur);
    }
  }

  // Pagination tabel (admin). Kasir hari itu saja → tak dipaginasi.
  const page = Math.max(1, Number(sp.page) || 1);
  const totalPages = isAdmin ? Math.max(1, Math.ceil(all.length / PAGE_SIZE)) : 1;
  const rows = isAdmin ? all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : all;

  const tsvHeader = ["Tanggal", "Waktu", "Kode", "Tipe", "Kasir", "Metode", "Diskon", "Total", "Status"];
  const tsvRows = all.map((t) =>
    [
      t.businessDate,
      new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      t.code,
      t.orderType === "TAKEAWAY" ? "Bungkus" : "Ditempat",
      t.cashierName,
      t.payment,
      String(t.discount),
      String(t.total),
      t.status === "VOID" ? "BATAL" : "OK",
    ].join("\t")
  );
  const tsv = [tsvHeader.join("\t"), ...tsvRows].join("\n");

  const qbase = `mode=${period.mode}&date=${period.date}&month=${period.month}${shift ? `&shift=${encodeURIComponent(shift)}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Rekap & Laporan Penjualan</h2>
            <p className="text-xs text-slate-500">
              Laporan periode: <strong className="text-slate-700">{period.label}</strong>
              {shift && <> · <strong className="text-blue-600">Shift {shift}</strong></>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <ShiftFilter shifts={shiftNames} current={shift} />
              <PeriodFilter mode={period.mode} date={period.date} month={period.month} />
            </>
          ) : (
            <span className="pill-blue text-xs">
              🔒 Hari Usaha Berjalan
            </span>
          )}
        </div>
      </div>

      {/* KPI 5 Cards Top Row (ala app-monitoring) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-blue-600 leading-tight font-mono truncate">{rupiah(omzet)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">TOTAL OMZET</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900 leading-tight font-mono">{active.length}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">TRANSAKSI</div>
            {jmlVoid > 0 && <div className="text-[10px] text-rose-600 font-medium">{jmlVoid} void / batal</div>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-800 leading-tight font-mono truncate">{rupiah(diskon)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">TOTAL DISKON</div>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-slate-800 leading-tight font-mono truncate">{rupiah(modal)}</div>
              <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">MODAL POKOK (HPP)</div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-white border border-emerald-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(16,185,129,0.08)] bg-gradient-to-br from-white to-emerald-50/30">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-emerald-700 leading-tight font-mono truncate">{rupiah(untung)}</div>
              <div className="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase">UNTUNG KOTOR</div>
            </div>
          </div>
        )}
      </div>

      {/* 4 Panels: Per Shift, Kategori, Metode, Kasir */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">Omzet per Shift</h3>
          </div>
          <div className="space-y-2 text-xs">
            {shiftNames.map((s) => {
              const v = perShift.get(s);
              const pct = active.length ? Math.round(((v?.total || 0) / Math.max(1, omzet)) * 100) : 0;
              return (
                <div key={s} className={`p-2 rounded-lg border ${shift === s ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Shift {s}</span>
                    <span className="font-mono font-bold text-slate-900">{rupiah(v?.total || 0)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {v?.qty || 0} transaksi · {pct}% dari omzet
                  </div>
                </div>
              );
            })}
            {[...perShift.entries()]
              .filter(([k]) => !shiftNames.includes(k))
              .map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-500">{k}</span>
                  <span className="font-mono font-bold text-slate-600">{rupiah(v.total)}</span>
                </div>
              ))}
            {active.length === 0 && (
              <p className="text-center text-slate-400 py-3">Belum ada transaksi periode ini.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">Penjualan per Kategori</h3>
            <span className="text-[11px] text-slate-400">Klik rincian</span>
          </div>
          <div className="space-y-1.5 text-xs">
            {[...perKategori.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .map(([k, v]) => {
                const items = [...(perKategoriItems.get(k) || new Map())].sort(
                  (a, b) => b[1].qty - a[1].qty
                );
                return (
                  <details key={k} className="group border-b border-slate-100 last:border-0 pb-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs hover:bg-slate-50 rounded px-1 transition [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition group-open:rotate-90" />
                        <span>{k}</span>
                        <span className="pill-slate text-[10px]">{v.qty} pcs</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900">{rupiah(v.total)}</span>
                    </summary>
                    <div className="mt-1 space-y-1 border-l-2 border-blue-400 pl-3 py-1 bg-slate-50/50 rounded-r">
                      {items.map(([name, d]) => (
                        <div key={name} className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="text-slate-600 truncate">{name}</span>
                          <span className="font-mono text-slate-700">
                            <span className="font-semibold text-blue-600">{d.qty}×</span> · {rupiah(d.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">Metode Pembayaran</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[...perMetode.entries()].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-700">{k}</span>
                <span className="font-mono font-bold text-slate-900">{rupiah(v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">Aktivitas per Kasir</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[...perKasir.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                      {k.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-semibold text-slate-800">{k}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">{rupiah(v.total)}</span>
                    <span className="text-[10px] text-slate-400">{v.qty} transaksi</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Transaksi (ala app-monitoring table) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Daftar Log Transaksi</h3>
          <span className="text-xs text-slate-500">
            {all.length} transaksi pada periode ini
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Kode Transaksi</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Detail Item</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4 text-right">Total Tagihan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((t) => {
                const isVoid = t.status === "VOID";
                return (
                  <tr key={t.id} className={`hover:bg-slate-50/60 transition ${isVoid ? "opacity-60 bg-rose-50/20" : ""}`}>
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{waktu(t.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <Link
                          href={`/receipt/${t.code}`}
                          target="_blank"
                          className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span>{t.code}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        {isVoid && (
                          <span className="pill-red text-[10px]">
                            BATAL / VOID
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {t.orderType === "TAKEAWAY" ? "🥡 Bungkus" : "🍽️ Ditempat"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{t.cashierName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="font-semibold">{t.items.reduce((s, i) => s + i.qty, 0)} item</span>
                      {t.discount > 0 && (
                        <span className="ml-1 pill-amber text-[10px]">
                          {t.voucherName ? `Promo: ${t.voucherName}` : "Diskon"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="pill-slate font-medium">{t.payment}</span>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${isVoid ? "line-through text-slate-400" : "text-slate-900"}`}>
                      {rupiah(t.total)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isVoid && <VoidButton id={t.id} code={t.code} />}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-400" colSpan={7}>
                    Belum ada riwayat transaksi pada periode terpilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link href={`/rekap?${qbase}&page=${page - 1}`} className="btn-ghost text-xs">
              ‹ Halaman Sebelumnya
            </Link>
          )}
          <span className="text-xs text-slate-500 px-2 font-medium">
            Halaman {page} dari {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/rekap?${qbase}&page=${page + 1}`} className="btn-ghost text-xs">
              Halaman Berikutnya ›
            </Link>
          )}
        </div>
      )}

      {/* Kas & Pengeluaran Laci */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Rekonsiliasi Kas & Pengeluaran Laci</h3>
            <p className="text-xs text-slate-400">
              Uang di laci = Kas Awal + Penjualan Tunai + Kas Masuk − Pengeluaran Laci.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Kas Awal {period.mode === "bulan" ? "(Total Hari)" : ""}</span>
            <span className="font-mono text-base font-bold text-slate-800">{rupiah(kasAwalTotal)}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Penjualan Tunai</span>
            <span className="font-mono text-base font-bold text-emerald-600">{rupiah(penjualanTunai)}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Pengeluaran Laci</span>
            <span className="font-mono text-base font-bold text-rose-600">{rupiah(pengeluaran)}</span>
          </div>
          <div className="bg-white border border-blue-200 rounded-xl p-3.5 shadow-sm bg-blue-50/30">
            <span className="text-[11px] text-blue-600 uppercase font-semibold block">Estimasi Fisik Uang Laci</span>
            <span className="font-mono text-base font-bold text-blue-700">{rupiah(uangLaci)}</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <KasClient />
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs">Catatan Kas Masuk / Keluar ({period.label})</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Tipe</th>
                    <th className="py-2.5 px-3">Kategori & Keterangan</th>
                    <th className="py-2.5 px-3">Petugas</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    {isAdmin && <th className="py-2.5 px-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cashEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">{waktu(e.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        <span className={e.type === "MASUK" ? "pill-green" : "pill-red"}>
                          {e.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">{e.category}</span>
                        {e.note && <span className="text-slate-400"> · {e.note}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{e.userName || "-"}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${e.type === "KELUAR" ? "text-rose-600" : "text-emerald-600"}`}>
                        {e.type === "KELUAR" ? "−" : "+"}
                        {rupiah(e.amount)}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-right">
                          <DeleteCash id={e.id} />
                        </td>
                      )}
                    </tr>
                  ))}
                  {cashEntries.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-slate-400" colSpan={isAdmin ? 6 : 5}>
                        Belum ada catatan kas masuk / keluar pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && all.length > 0 && <SpreadsheetCopy tsv={tsv} />}
    </div>
  );
}
