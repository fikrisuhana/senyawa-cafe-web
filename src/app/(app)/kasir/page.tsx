import { prisma } from "@/lib/db";
import { getSettings, parseQuickCash } from "@/lib/settings";
import { todayKey, businessDateRange, labelHari } from "@/lib/bizday";
import { rupiah } from "@/lib/format";
import PosClient, { type PosMenu } from "@/components/PosClient";

export const dynamic = "force-dynamic";

export default async function KasirPage() {
  const settings = await getSettings();
  const [items, vouchers] = await Promise.all([
    prisma.menuItem.findMany({
      where: { active: true },
      include: {
        stocks: { include: { packaging: true } },
        variantGroups: { include: { options: true } },
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.voucher.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const menus: PosMenu[] = items.map((m) => {
    // sisa porsi = paling sedikit di antara semua bahan (min floor(stok/qty))
    let stokPorsi: number | null = null;
    for (const s of m.stocks) {
      if (s.qty <= 0) continue;
      const porsi = Math.floor(s.packaging.stock / s.qty);
      stokPorsi = stokPorsi === null ? porsi : Math.min(stokPorsi, porsi);
    }
    return {
      id: m.id,
      name: m.name,
      category: m.category,
      price: m.price,
      stokPorsi,
      groups: m.variantGroups
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type as "SINGLE" | "MULTI",
          required: g.required,
          options: g.options
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
        })),
    };
  });

  // Ringkas penjualan hari usaha ini untuk header.
  const key = todayKey(settings.dayCutoffHour);
  const { start, end } = businessDateRange(key, settings.dayCutoffHour);
  const agg = await prisma.transaction.aggregate({
    where: { createdAt: { gte: start, lt: end } },
    _sum: { total: true },
    _count: true,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Kasir</h1>
          <p className="text-xs text-slate-500">Hari usaha: {labelHari(key)}</p>
        </div>
        <div className="card !p-3 text-right">
          <div className="text-xs text-slate-500">Penjualan hari ini</div>
          <div className="text-lg font-bold text-brand-700">
            {rupiah(agg._sum.total || 0)}
          </div>
          <div className="text-xs text-slate-500">{agg._count} transaksi</div>
        </div>
      </div>
      <PosClient
        menus={menus}
        quickCash={parseQuickCash(settings.quickCash)}
        vouchers={vouchers.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type as "PERCENT" | "NOMINAL",
          value: v.value,
        }))}
      />
    </div>
  );
}
