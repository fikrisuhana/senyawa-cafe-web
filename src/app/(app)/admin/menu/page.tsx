import { prisma } from "@/lib/db";
import MenuAdminClient, { type MenuRow, type PackOption } from "@/components/MenuAdminClient";

export const dynamic = "force-dynamic";

export default async function MenuAdminPage() {
  const [items, packs] = await Promise.all([
    prisma.menuItem.findMany({
      include: {
        stocks: { include: { packaging: true } },
        variantGroups: {
          include: { options: { include: { stocks: { include: { packaging: true } } } } },
        },
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: MenuRow[] = items.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    price: m.price,
    cost: m.cost,
    active: m.active,
    sortOrder: m.sortOrder,
    stocks: m.stocks.map((s) => ({
      packagingId: s.packagingId,
      qty: s.qty,
      name: s.packaging.name,
    })),
    groups: m.variantGroups
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type as "SINGLE" | "MULTI",
        required: g.required,
        options: g.options
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({
            id: o.id,
            name: o.name,
            priceDelta: o.priceDelta,
            stocks: o.stocks.map((s) => ({
              id: s.id,
              packagingId: s.packagingId,
              qty: s.qty,
              name: s.packaging.name,
            })),
          })),
      })),
  }));
  const packOptions: PackOption[] = packs.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Kelola Menu &amp; Harga</h1>
      <MenuAdminClient rows={rows} packs={packOptions} />
    </div>
  );
}
