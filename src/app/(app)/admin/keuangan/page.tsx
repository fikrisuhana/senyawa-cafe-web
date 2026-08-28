import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import { shiftRanges } from "@/lib/shifts";
import { rupiah, waktu } from "@/lib/format";
import PeriodFilter from "@/components/PeriodFilter";
import ShiftFilter from "@/components/ShiftFilter";
import CashClient from "@/components/CashClient";
import BelanjaClient from "@/components/BelanjaClient";
import DeleteCash from "@/components/DeleteCash";
import { DollarSign, Wallet, TrendingUp, TrendingDown, CreditCard, ShoppingBag, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; month?: string; shift?: string }>;
}) {
  const settings = await getSettings();
  const sp = await searchParams;
  const today = todayKey(settings.dayCutoffHour);
  const period = resolvePeriod(sp, settings.dayCutoffHour);
  const bdFilter = period.filter;

  // Filter shift — scoped ke angka PENJUALAN POS (omzet & tunai);
  // kas manual & biaya owner tetap level hari (gak punya shift).
  const shiftNames = (await shiftRanges()).map((r) => r.name);
  const shift = shiftNames.includes(sp.shift || "") ? sp.shift! : "";

  const [txs, entries, purchases, packs] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate: bdFilter, status: { not: "VOID" }, ...(shift ? { shift } : {}) },
      select: { total: true, payment: true, businessDate: true },
    }),
    prisma.cashEntry.findMany({
      where: { businessDate: bdFilter },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({ where: { businessDate: bdFilter }, orderBy: { createdAt: "desc" } }),
    prisma.packaging.findMany({
      select: { id: true, name: true, unit: true, buyUnit: true, buyFactor: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const penjualan = txs.reduce((s, t) => s + t.total, 0);
  const penjualanTunai = txs.filter((t) => t.payment === "TUNAI").reduce((s, t) => s + t.total, 0);
  const manualMasuk = entries.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amount, 0);
  const keluar = entries.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amount, 0);
  const totalMasuk = penjualan + manualMasuk;
  const saldo = totalMasuk - keluar;

  // KAS AWAL = SETELAN LACI
  const arusPerHari = new Map<string, number>();
  for (const t of txs) {
    if (t.payment === "TUNAI") arusPerHari.set(t.businessDate, (arusPerHari.get(t.businessDate) || 0) + t.total);
  }
  for (const e of entries) {
    const d = arusPerHari.get(e.businessDate) ?? 0;
    arusPerHari.set(e.businessDate, d + (e.type === "MASUK" ? e.amount : -e.amount));
  }
  const diambilOwner = [...arusPerHari.values()].reduce((s, v) => s + Math.max(0, v), 0);
  const isHari = period.mode === "hari";
  const uangLaci = settings.kasAwal + (isHari ? penjualanTunai + manualMasuk - keluar : 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Catatan Arus Keuangan &amp; Kas</h2>
            <p className="text-xs text-slate-500">
              Laporan periode: <strong className="text-slate-700">{period.label}</strong>
              {shift && <> · <strong className="text-blue-600">Shift {shift}</strong> <span className="text-slate-400">(penjualan POS)</span></>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShiftFilter shifts={shiftNames} current={shift} />
          <PeriodFilter mode={period.mode} date={period.date} month={period.month} />
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-blue-600 leading-tight font-mono truncate">{rupiah(penjualan)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">PENJUALAN POS</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-emerald-600 leading-tight font-mono truncate">{rupiah(manualMasuk)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">PEMASUKAN LAIN</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-rose-600 leading-tight font-mono truncate">{rupiah(keluar)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">PENGELUARAN KAS</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-900 leading-tight font-mono truncate">{rupiah(saldo)}</div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">SALDO BERSIH ARUS</div>
          </div>
        </div>
      </div>

      {/* Kas Fisik Laci Rekonsiliasi */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <Wallet className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-slate-900 text-sm">Rekonsiliasi Kas Fisik Laci (Cash Drawer)</h3>
          </div>
          <span className="text-[11px] text-slate-400">Setelan Laci: <strong>{rupiah(settings.kasAwal)}</strong></span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Modal Laci Awal</span>
            <span className="font-mono text-base font-bold text-slate-800">{rupiah(settings.kasAwal)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Uang yang disisakan tiap tutup kasir</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Penjualan Tunai Periode</span>
            <span className="font-mono text-base font-bold text-emerald-600">{rupiah(penjualanTunai)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Hanya pembayaran kasir metode Tunai</span>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
            <span className="text-[10px] text-blue-600 uppercase font-semibold block">
              {isHari ? "Fisik Laci Saat Ini (Est.)" : "Estimasi Diambil Owner"}
            </span>
            <span className="font-mono text-base font-bold text-blue-700">
              {isHari ? rupiah(uangLaci) : rupiah(diambilOwner)}
            </span>
            <span className="text-[10px] text-blue-500 block mt-0.5">
              {isHari ? "Modal awal + Arus tunai hari ini" : "Total arus tunai harian di atas modal"}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Disisakan di Laci</span>
            <span className="font-mono text-base font-bold text-slate-800">{rupiah(settings.kasAwal)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Standar siap pakai shift berikutnya</span>
          </div>
        </div>
      </div>

      {/* Belanja / Biaya Owner */}
      <BelanjaClient rows={purchases} bahans={packs} />

      {/* Kas Masuk / Keluar Manual */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <CashClient defaultDate={today} />

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0 h-fit">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Rincian Kas Masuk &amp; Keluar Manual</h3>
            <span className="text-xs text-slate-500">{entries.length} catatan pada periode ini</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Kategori &amp; Catatan</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{waktu(e.createdAt)}</td>
                    <td className="py-3 px-4">
                      <span className={e.type === "MASUK" ? "pill-green" : "pill-red"}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{e.category}</span>
                      {e.note ? <span className="text-slate-400"> · {e.note}</span> : null}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        e.type === "KELUAR" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {e.type === "KELUAR" ? "−" : "+"}
                      {rupiah(e.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DeleteCash id={e.id} />
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-slate-400" colSpan={5}>
                      Belum ada catatan transaksi kas manual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
