import { prisma } from "@/lib/db";
import { waktu } from "@/lib/format";
import StokClient, { type PackRow } from "@/components/StokClient";

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
    stock: p.stock,
    minStock: p.minStock,
    low: p.stock <= p.minStock,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Stok / Bahan</h1>
        <div className="flex gap-2">
          <a href="/api/admin/packaging/import" className="btn-ghost">
            ⬇️ Template Excel
          </a>
        </div>
      </div>

      <StokClient rows={rows} />

      <div className="card overflow-x-auto !p-0">
        <div className="p-3 text-sm font-bold">Riwayat pergerakan stok</div>
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Waktu</th>
              <th className="th">Kemasan</th>
              <th className="th">Tipe</th>
              <th className="th text-right">Perubahan</th>
              <th className="th text-right">Sisa</th>
              <th className="th">Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {moves.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="td whitespace-nowrap">{waktu(m.createdAt)}</td>
                <td className="td">{m.packaging.name}</td>
                <td className="td">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{m.type}</span>
                </td>
                <td
                  className={`td text-right font-medium ${
                    m.delta < 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </td>
                <td className="td text-right">{m.after}</td>
                <td className="td text-slate-500">{m.userName || "-"}</td>
              </tr>
            ))}
            {moves.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={6}>
                  Belum ada pergerakan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
