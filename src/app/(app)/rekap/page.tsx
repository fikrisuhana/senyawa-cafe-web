import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/bizday";
import { resolvePeriod } from "@/lib/period";
import { rupiah, waktu } from "@/lib/format";
import Link from "next/link";
import PeriodFilter from "@/components/PeriodFilter";
import SpreadsheetCopy from "@/components/SpreadsheetCopy";
import VoidButton from "@/components/VoidButton";
import KasClient from "@/components/KasClient";
import DeleteCash from "@/components/DeleteCash";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; month?: string; page?: string }>;
}) {
  const user = await getSession();
  const isAdmin = user?.role === "ADMIN";
  const settings = await getSettings();
  const sp = await searchParams;
  const today = todayKey(settings.dayCutoffHour);

  const period = isAdmin
    ? resolvePeriod(sp, settings.dayCutoffHour)
    : resolvePeriod({ mode: "hari", date: today }, settings.dayCutoffHour);

  const [all, cashEntries] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessDate: period.filter },
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
  for (const t of active) {
    perMetode.set(t.payment, (perMetode.get(t.payment) || 0) + t.total);
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

  const qbase = `mode=${period.mode}&date=${period.date}&month=${period.month}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Rekap Penjualan</h1>
          <p className="text-xs text-slate-500">{period.label}</p>
        </div>
        {isAdmin ? (
          <PeriodFilter mode={period.mode} date={period.date} month={period.month} />
        ) : (
          <span className="rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-700">
            🔒 Hari usaha berjalan
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Omzet" value={rupiah(omzet)} accent />
        <Stat label="Transaksi" value={String(active.length)} sub={jmlVoid ? `${jmlVoid} dibatalkan` : undefined} />
        <Stat label="Diskon" value={rupiah(diskon)} />
        {isAdmin && <Stat label="Modal" value={rupiah(modal)} />}
        {isAdmin && <Stat label="Untung kotor" value={rupiah(untung)} good />}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Per kategori (klik utk rincian)">
          {[...perKategori.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([k, v]) => {
              const items = [...(perKategoriItems.get(k) || new Map())].sort(
                (a, b) => b[1].qty - a[1].qty
              );
              return (
                <details key={k} className="group border-b border-slate-100 last:border-0">
                  <summary className="-mx-1 flex cursor-pointer list-none items-center justify-between rounded px-1 py-1 text-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span className="font-medium">
                      <span className="mr-1 inline-block text-slate-400 transition group-open:rotate-90">▸</span>
                      {k} <span className="text-slate-400">({v.qty})</span>
                    </span>
                    <span className="font-medium">{rupiah(v.total)}</span>
                  </summary>
                  <div className="mt-1 space-y-1 border-l-2 border-brand-200 pb-2 pl-3">
                    {items.map(([name, d]) => (
                      <div key={name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{name}</span>
                        <span className="tabular-nums text-slate-500">
                          <span className="font-semibold text-brand-700">{d.qty} pcs</span> · {rupiah(d.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
        </Panel>
        <Panel title="Per metode bayar">
          {[...perMetode.entries()].map(([k, v]) => (
            <Line key={k} k={k} v={rupiah(v)} />
          ))}
        </Panel>
        <Panel title="Per kasir">
          {[...perKasir.entries()].map(([k, v]) => (
            <Line key={k} k={`${k} (${v.qty})`} v={rupiah(v.total)} />
          ))}
        </Panel>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Waktu</th>
              <th className="th">Kode</th>
              <th className="th">Kasir</th>
              <th className="th">Item</th>
              <th className="th">Bayar</th>
              <th className="th text-right">Total</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((t) => {
              const isVoid = t.status === "VOID";
              return (
                <tr key={t.id} className={`hover:bg-slate-50 ${isVoid ? "opacity-60" : ""}`}>
                  <td className="td whitespace-nowrap">{waktu(t.createdAt)}</td>
                  <td className="td">
                    <Link href={`/receipt/${t.code}`} target="_blank" className="text-brand-700 hover:underline">
                      {t.code}
                    </Link>
                    {isVoid && (
                      <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700">
                        BATAL
                      </span>
                    )}
                    <span className="ml-1 text-[10px] text-slate-400">
                      {t.orderType === "TAKEAWAY" ? "🥡" : "🍽️"}
                    </span>
                  </td>
                  <td className="td">{t.cashierName}</td>
                  <td className="td text-slate-500">
                    {t.items.reduce((s, i) => s + i.qty, 0)} item
                    {t.discount > 0 && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                        {t.voucherName || "diskon"}
                      </span>
                    )}
                  </td>
                  <td className="td">{t.payment}</td>
                  <td className={`td text-right font-semibold ${isVoid ? "line-through" : ""}`}>
                    {rupiah(t.total)}
                  </td>
                  <td className="td text-right">
                    {!isVoid && <VoidButton id={t.id} code={t.code} />}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={7}>
                  Belum ada transaksi pada periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/rekap?${qbase}&page=${page - 1}`} className="btn-ghost">
              ‹ Sebelumnya
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Hal {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/rekap?${qbase}&page=${page + 1}`} className="btn-ghost">
              Berikutnya ›
            </Link>
          )}
        </div>
      )}

      {/* Kas & Pengeluaran (jadi satu dengan rekap) */}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h2 className="text-base font-bold">Kas &amp; Pengeluaran</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`Kas awal${period.mode === "bulan" ? " (×hari)" : ""}`} value={rupiah(kasAwalTotal)} />
          <Stat label="Penjualan tunai" value={rupiah(penjualanTunai)} />
          <Stat label="Pengeluaran" value={rupiah(pengeluaran)} bad />
          <Stat label="Uang di laci (est.)" value={rupiah(uangLaci)} accent />
        </div>
        <p className="text-xs text-slate-400">
          Uang di laci = kas awal + penjualan tunai + pemasukan − pengeluaran (QRIS/transfer bukan tunai).
        </p>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <KasClient />
          <div className="card overflow-x-auto !p-0">
            <div className="p-3 text-sm font-bold">Catatan kas ({period.label})</div>
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Waktu</th>
                  <th className="th">Tipe</th>
                  <th className="th">Kategori</th>
                  <th className="th">Oleh</th>
                  <th className="th text-right">Nominal</th>
                  {isAdmin && <th className="th"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap">{waktu(e.createdAt)}</td>
                    <td className="td">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.type === "MASUK" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="td">
                      {e.category}
                      {e.note ? <span className="text-slate-400"> · {e.note}</span> : null}
                    </td>
                    <td className="td text-slate-500">{e.userName || "-"}</td>
                    <td className={`td text-right font-semibold ${e.type === "KELUAR" ? "text-red-600" : "text-emerald-600"}`}>
                      {e.type === "KELUAR" ? "−" : "+"}
                      {rupiah(e.amount)}
                    </td>
                    {isAdmin && (
                      <td className="td text-right">
                        <DeleteCash id={e.id} />
                      </td>
                    )}
                  </tr>
                ))}
                {cashEntries.length === 0 && (
                  <tr>
                    <td className="td text-slate-500" colSpan={isAdmin ? 6 : 5}>
                      Belum ada catatan kas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAdmin && all.length > 0 && <SpreadsheetCopy tsv={tsv} />}
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
      {sub && <div className="text-[11px] text-red-500">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
