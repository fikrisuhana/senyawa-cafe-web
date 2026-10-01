import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import BelanjaClient from "@/components/BelanjaClient";
import { ShoppingBag, Package, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Halaman STAF BELANJA (role BELANJA; admin juga boleh buka): catat belanja
 * + tambah stok bahan sekaligus, riwayat belanja miliknya, & cek stok (read-only).
 */
export default async function BelanjaPage() {
  const user = await getSession();
  const isStaff = user?.role === "BELANJA";

  // Riwayat 14 hari terakhir. Staf cuma lihat catatannya sendiri.
  const d = new Date();
  d.setDate(d.getDate() - 13);
  const since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [rows, packs] = await Promise.all([
    prisma.purchase.findMany({
      where: { businessDate: { gte: since }, ...(isStaff ? { userName: user!.name } : {}) },
      orderBy: { createdAt: "desc" },
    }),
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
  ]);

  const low = packs.filter((p) => p.stock <= p.minStock);
  // Stok dalam satuan beli kalau ada (mis. 1500 ml → 1,5 Liter) biar gampang dibaca.
  const fmtStock = (p: (typeof packs)[number]) => {
    const base = `${p.stock.toLocaleString("id-ID")} ${p.unit}`;
    if (p.buyUnit && p.buyFactor > 1) {
      const inBuy = Math.round((p.stock / p.buyFactor) * 10) / 10;
      return `${base} (≈ ${inBuy.toLocaleString("id-ID")} ${p.buyUnit})`;
    }
    return base;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          <ShoppingBag className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Belanja &amp; Stok</h2>
          <p className="text-xs text-slate-500">
            Catat barang yang dibeli — bahan yang dicentang otomatis menambah stok.
            {isStaff && <> Riwayat di bawah hanya catatan milik <b>{user!.name}</b>.</>}
          </p>
        </div>
      </div>

      <BelanjaClient
        rows={rows}
        bahans={packs.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          buyUnit: p.buyUnit,
          buyFactor: p.buyFactor,
          stock: p.stock,
          minStock: p.minStock,
        }))}
        staffMode={isStaff}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" /> Stok Bahan Saat Ini
          </h3>
          {low.length > 0 && (
            <span className="pill-red text-[10px] inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {low.length} menipis
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {/* Yang menipis ditaruh paling atas biar langsung kelihatan mau beli apa. */}
          {[...low, ...packs.filter((p) => p.stock > p.minStock)].map((p) => {
            const isLow = p.stock <= p.minStock;
            return (
              <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 ${isLow ? "bg-rose-50/50" : ""}`}>
                <span className={`font-semibold ${isLow ? "text-rose-700" : "text-slate-800"}`}>
                  {isLow && "⚠️ "}
                  {p.name}
                </span>
                <span className="text-right">
                  <span className={`font-mono font-bold ${isLow ? "text-rose-700" : "text-slate-700"}`}>{fmtStock(p)}</span>
                  {p.minStock > 0 && (
                    <span className="block text-[10px] text-slate-400">min {p.minStock.toLocaleString("id-ID")} {p.unit}</span>
                  )}
                </span>
              </div>
            );
          })}
          {packs.length === 0 && <p className="p-6 text-center text-slate-400">Belum ada bahan stok.</p>}
        </div>
      </div>
    </div>
  );
}
