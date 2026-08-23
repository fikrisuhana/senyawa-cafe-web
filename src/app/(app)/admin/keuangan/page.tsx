import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import { rupiah, waktu } from "@/lib/format";
import PeriodFilter from "@/components/PeriodFilter";
import CashClient from "@/components/CashClient";
import DeleteCash from "@/components/DeleteCash";

export const dynamic = "force-dynamic";

export default async function KeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; month?: string }>;
}) {
  const settings = await getSettings();
  const sp = await searchParams;
  const today = todayKey(settings.dayCutoffHour);
  const period = resolvePeriod(sp, settings.dayCutoffHour);
  const bdFilter = period.filter;

  const [txs, entries] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate: bdFilter, status: { not: "VOID" } },
      select: { total: true, payment: true, businessDate: true },
    }),
    prisma.cashEntry.findMany({
      where: { businessDate: bdFilter },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const penjualan = txs.reduce((s, t) => s + t.total, 0);
  const penjualanTunai = txs.filter((t) => t.payment === "TUNAI").reduce((s, t) => s + t.total, 0);
  const manualMasuk = entries.filter((e) => e.type === "MASUK").reduce((s, e) => s + e.amount, 0);
  const keluar = entries.filter((e) => e.type === "KELUAR").reduce((s, e) => s + e.amount, 0);
  const totalMasuk = penjualan + manualMasuk;
  const saldo = totalMasuk - keluar;

  // Kas awal harian (modal laci). Untuk mode bulan = kasAwal × jumlah hari aktif.
  const hariAktif = new Set<string>(txs.map((t) => t.businessDate));
  entries.forEach((e) => hariAktif.add(e.businessDate));
  const kasAwalTotal =
    period.mode === "hari" ? settings.kasAwal : settings.kasAwal * Math.max(1, hariAktif.size);
  // Perkiraan uang tunai di laci = kas awal + penjualan tunai + pemasukan − pengeluaran.
  const uangLaci = kasAwalTotal + penjualanTunai + manualMasuk - keluar;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Catatan Keuangan</h1>
          <p className="text-xs text-slate-500">{period.label}</p>
        </div>
        <PeriodFilter mode={period.mode} date={period.date} month={period.month} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Penjualan (otomatis)" value={rupiah(penjualan)} />
        <Stat label="Pemasukan lain" value={rupiah(manualMasuk)} />
        <Stat label="Pengeluaran" value={rupiah(keluar)} bad />
        <Stat label="Saldo bersih" value={rupiah(saldo)} accent />
      </div>

      {/* Kas laci (fisik) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={`Kas awal${period.mode === "bulan" ? " (× hari)" : ""}`} value={rupiah(kasAwalTotal)} />
        <Stat label="Penjualan tunai" value={rupiah(penjualanTunai)} />
        <Stat label="Uang di laci (estimasi)" value={rupiah(uangLaci)} accent />
      </div>
      <p className="-mt-1 text-xs text-slate-400">
        Uang di laci = kas awal + penjualan tunai + pemasukan − pengeluaran. Buat cek kecocokan
        uang fisik saat tutup (QRIS/transfer tidak dihitung sebagai tunai).
      </p>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <CashClient defaultDate={today} />

        <div className="card overflow-x-auto !p-0">
          <div className="p-3 text-sm font-bold">Rincian manual</div>
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Waktu</th>
                <th className="th">Tipe</th>
                <th className="th">Kategori</th>
                <th className="th">Catatan</th>
                <th className="th text-right">Nominal</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap">{waktu(e.createdAt)}</td>
                  <td className="td">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.type === "MASUK"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="td">{e.category}</td>
                  <td className="td text-slate-500">{e.note || "-"}</td>
                  <td
                    className={`td text-right font-semibold ${
                      e.type === "KELUAR" ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {e.type === "KELUAR" ? "−" : "+"}
                    {rupiah(e.amount)}
                  </td>
                  <td className="td">
                    <DeleteCash id={e.id} />
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td className="td text-slate-500" colSpan={6}>
                    Belum ada catatan manual. Penjualan otomatis sudah dihitung di ringkasan atas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  bad,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-lg font-bold ${
          accent ? "text-brand-700" : bad ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
