import { prisma } from "@/lib/db";
import { labelBulan } from "@/lib/period";
import StokClient, { type PackRow, type MonthlyPurchase, type MoveRow } from "@/components/StokClient";
import { Boxes, Download, ShoppingBag, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = sp.month || currentYm;

  const [packs, moves, purchases, distinctDates] = await Promise.all([
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { packaging: true },
    }),
    prisma.purchase.findMany({
      where: { businessDate: { startsWith: selectedMonth } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({
      select: { businessDate: true },
      distinct: ["businessDate"],
      orderBy: { businessDate: "desc" },
    }),
  ]);

  // Bangun daftar bulan yang tersedia (dari data belanja + 6 bulan terakhir)
  const monthSet = new Set<string>();
  monthSet.add(currentYm);
  monthSet.add(selectedMonth);

  // Tambahkan bulan-bulan yang ada catatannya di database
  for (const d of distinctDates) {
    if (d.businessDate && d.businessDate.length >= 7) {
      monthSet.add(d.businessDate.slice(0, 7));
    }
  }

  // Tambahkan fallback 3 bulan ke belakang biar pilihannya lengkap
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthSet.add(ym);
  }

  const availableMonths = Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => ({
      value: ym,
      label: labelBulan(ym),
    }));

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

  const monthlyPurchases: MonthlyPurchase[] = purchases.map((p) => ({
    id: p.id,
    businessDate: p.businessDate,
    category: p.category,
    itemName: p.itemName,
    qty: p.qty,
    unit: p.unit,
    unitPrice: p.unitPrice,
    total: p.total,
    note: p.note,
    notaUrl: p.notaUrl,
    userName: p.userName,
  }));

  const moveRows: MoveRow[] = moves.map((m) => ({
    id: m.id,
    createdAt: m.createdAt,
    type: m.type,
    delta: m.delta,
    after: m.after,
    userName: m.userName,
    note: m.note,
    packaging: {
      name: m.packaging.name,
      unit: m.packaging.unit,
    },
  }));

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Manajemen Stok &amp; Pengeluaran Belanja
            </h2>
            <p className="text-xs text-slate-500">
              Pantau sisa inventori bahan, rekapan belanja bulanan, serta mutasi stok barang
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/belanja"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Catat Belanja</span>
          </Link>

          <a
            href="/api/admin/packaging/import"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Excel</span>
          </a>
        </div>
      </div>

      <StokClient
        rows={rows}
        monthlyPurchases={monthlyPurchases}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        moves={moveRows}
      />
    </div>
  );
}
