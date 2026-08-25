import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import { rupiah, waktu } from "@/lib/format";
import PeriodFilter from "@/components/PeriodFilter";
import CashClient from "@/components/CashClient";
import BelanjaClient from "@/components/BelanjaClient";
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

  const [txs, entries, purchases, packs] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate: bdFilter, status: { not: "VOID" } },
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

  // KAS AWAL = SETELAN LACI (mis. 250rb) — bukan nambah tiap hari. Tiap tutup
  // kasir, sisanya di atas setelan diambil owner; laci kembali ke 250rb.
  // Uang di laci (estimasi, hari berjalan) = setelan + arus tunai HARI INI.
  // Untuk periode > 1 hari: "diambil owner" = Σ per hari max(0, arus tunai hari itu).
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Setelan laci (kas awal)" value={rupiah(settings.kasAwal)} sub="uang yang disisakan tiap tutup" />
        <Stat label="Penjualan tunai (periode)" value={rupiah(penjualanTunai)} />
        {isHari ? (
          <Stat label="Uang di laci SEKARANG (est.)" value={rupiah(uangLaci)} sub="setelan + arus tunai hari ini" accent />
        ) : (
          <Stat label="Estimasi DIAMBIL OWNER (Σ hari)" value={rupiah(diambilOwner)} sub="arus tunai per hari di atas setelan" good />
        )}
        <Stat label="Yang disisakan di laci" value={rupiah(settings.kasAwal)} sub="setelah diambil owner" />
      </div>
      <p className="-mt-1 text-xs text-slate-400">
        Konsep: laci selalu disetel {rupiah(settings.kasAwal)} tiap buka. Kelebihannya diambil owner
        saat tutup kasir. QRIS/transfer tidak masuk hitungan laci.
      </p>

      {/* Biaya owner (belanja/gaji — uang owner, bukan laci) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Biaya owner (periode)" value={rupiah(purchases.reduce((s2, p2) => s2 + p2.total, 0))} />
        <Stat
          label="— Belanja"
          value={rupiah(purchases.filter((p2) => p2.category === "BELANJA" || !p2.category).reduce((s2, p2) => s2 + p2.total, 0))}
        />
        <Stat label="— Gaji" value={rupiah(purchases.filter((p2) => p2.category === "GAJI").reduce((s2, p2) => s2 + p2.total, 0))} />
        <Stat label="— Lainnya" value={rupiah(purchases.filter((p2) => p2.category === "LAIN").reduce((s2, p2) => s2 + p2.total, 0))} />
      </div>
      <BelanjaClient rows={purchases} bahans={packs} />

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
  sub,
  accent,
  bad,
  good,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  bad?: boolean;
  good?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-lg font-bold ${
          accent ? "text-brand-700" : bad ? "text-red-600" : good ? "text-emerald-600" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{sub}</div>}
    </div>
  );
}
