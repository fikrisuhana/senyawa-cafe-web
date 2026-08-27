import { prisma } from "@/lib/db";
import { waktu } from "@/lib/format";
import StokClient, { type PackRow } from "@/components/StokClient";
import { Boxes, Download, History, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StokPage() {
  const [packs, moves] = await Promise.all([
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { packaging: true },
    }),
  ]);

  const rows: PackRow[] = packs.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    buyUnit: p.buyUnit,
    buyFactor: p.buyFactor,
    stock: p.stock,
    minStock: p.minStock,
    low: p.stock <= p.minStock,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Manajemen Stok &amp; Bahan Baku</h2>
            <p className="text-xs text-slate-500">Pantau sisa inventori kemasan &amp; bahan, mutasi stok, serta peringatan persediaan minimum</p>
          </div>
        </div>

        <div>
          <a
            href="/api/admin/packaging/import"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Template Excel</span>
          </a>
        </div>
      </div>

      <StokClient rows={rows} />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-900 text-sm">Riwayat Mutasi & Pergerakan Stok (25 Terakhir)</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Bahan / Kemasan</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4 text-right">Perubahan</th>
                <th className="py-3 px-4 text-right">Sisa Stok</th>
                <th className="py-3 px-4">Petugas / Sistem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {moves.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{waktu(m.createdAt)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{m.packaging.name}</td>
                  <td className="py-3 px-4">
                    <span className="pill-slate text-[10px]">{m.type}</span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono font-bold ${
                      m.delta > 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta} {m.packaging.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                    {m.after} {m.packaging.unit}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {m.userName || "Sistem POS"}
                    {m.note ? <span className="text-slate-400"> · {m.note}</span> : null}
                  </td>
                </tr>
              ))}
              {moves.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-400" colSpan={6}>
                    Belum ada log pergerakan stok.
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
