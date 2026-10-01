"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { rupiah, waktu } from "@/lib/format";
import EditPurchase from "@/components/EditPurchase";
import {
  Plus,
  Upload,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Package,
  ShoppingBag,
  TrendingDown,
  Search,
  Calendar,
  ExternalLink,
  Receipt,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  History,
} from "lucide-react";

export type PackRow = {
  id: string;
  name: string;
  unit: string;
  buyUnit: string | null;
  buyFactor: number;
  stock: number;
  minStock: number;
  low: boolean;
};

export type MonthlyPurchase = {
  id: string;
  businessDate: string;
  category: string;
  itemName: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  note: string | null;
  notaUrl: string | null;
  userName: string | null;
};

export type MoveRow = {
  id: string;
  createdAt: Date | string;
  type: string;
  delta: number;
  after: number;
  userName: string | null;
  note: string | null;
  packaging: {
    name: string;
    unit: string;
  };
};

export default function StokClient({
  rows,
  monthlyPurchases = [],
  selectedMonth,
  availableMonths = [],
  moves = [],
}: {
  rows: PackRow[];
  monthlyPurchases?: MonthlyPurchase[];
  selectedMonth: string;
  availableMonths: { value: string; label: string }[];
  moves?: MoveRow[];
}) {
  const router = useRouter();

  // Active Main Tab: "stok" | "belanja" | "mutasi"
  const [activeTab, setActiveTab] = useState<"stok" | "belanja" | "mutasi">("stok");

  // Stok filter
  const [stokSearch, setStokSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // Belanja filter
  const [belanjaSearch, setBelanjaSearch] = useState("");
  const [belanjaCat, setBelanjaCat] = useState("ALL");

  // Form Tambah Bahan
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [buyUnit, setBuyUnit] = useState("");
  const [buyFactor, setBuyFactor] = useState("1");
  const [minStock, setMinStock] = useState("0");
  const [importMsg, setImportMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<PackRow | null>(null);

  // Delete purchase state
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);

  // Metrik Mini Dashboard
  const lowCount = useMemo(() => rows.filter((p) => p.low).length, [rows]);
  const totalBahan = rows.length;

  const totalBelanjaBulan = useMemo(() => {
    return monthlyPurchases.reduce((acc, p) => acc + p.total, 0);
  }, [monthlyPurchases]);

  const totalTransaksiBelanja = monthlyPurchases.length;

  // Top spending items in selected month
  const topSpending = useMemo(() => {
    const map = new Map<string, { total: number; qty: number; unit: string }>();
    for (const p of monthlyPurchases) {
      const cur = map.get(p.itemName) || { total: 0, qty: 0, unit: p.unit || "item" };
      cur.total += p.total;
      cur.qty += p.qty;
      map.set(p.itemName, cur);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));
  }, [monthlyPurchases]);

  // Filtered rows for Stok
  const filteredRows = useMemo(() => {
    return rows.filter((p) => {
      const matchSearch = !stokSearch || p.name.toLowerCase().includes(stokSearch.toLowerCase());
      const matchLow = !onlyLow || p.low;
      return matchSearch && matchLow;
    });
  }, [rows, stokSearch, onlyLow]);

  // Filtered purchases for Belanja
  const filteredPurchases = useMemo(() => {
    return monthlyPurchases.filter((p) => {
      const matchCat = belanjaCat === "ALL" || p.category === belanjaCat;
      const matchSearch =
        !belanjaSearch ||
        p.itemName.toLowerCase().includes(belanjaSearch.toLowerCase()) ||
        (p.note && p.note.toLowerCase().includes(belanjaSearch.toLowerCase())) ||
        (p.userName && p.userName.toLowerCase().includes(belanjaSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [monthlyPurchases, belanjaCat, belanjaSearch]);

  // Handle Month Switch
  function changeMonth(monthVal: string) {
    router.push(`/admin/stok?month=${monthVal}`);
  }

  // Add Packaging
  async function addPack(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/admin/packaging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        unit,
        buyUnit: buyUnit.trim() || undefined,
        buyFactor: Number(buyFactor) || 1,
        minStock: Number(minStock) || 0,
      }),
    });
    setBusy(false);
    setName("");
    setBuyUnit("");
    setBuyFactor("1");
    router.refresh();
  }

  // Adjust stock
  async function adjust(p: PackRow) {
    const val = prompt(
      `Penyesuaian stok "${p.name}" (sekarang ${p.stock} ${p.unit}).\nMasukkan jumlah penambahan (mis. 100) atau pengurangan (mis. -20):`,
      ""
    );
    if (val === null) return;
    const delta = Number(val);
    if (!Number.isFinite(delta) || delta === 0) return;
    await fetch("/api/admin/packaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, delta, note: "Penyesuaian manual" }),
    });
    router.refresh();
  }

  // Set stock to exact value
  async function setStok(p: PackRow) {
    const val = prompt(
      `Set jumlah stok fisik "${p.name}" (sekarang ${p.stock} ${p.unit}) menjadi:`,
      String(p.stock)
    );
    if (val === null) return;
    const target = Number(val);
    if (!Number.isFinite(target)) return;
    await fetch("/api/admin/packaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, setTo: target, note: "Set manual" }),
    });
    router.refresh();
  }

  // Restock in buy unit or base unit
  async function restock(p: PackRow) {
    const label = p.buyUnit || p.unit;
    const val = prompt(
      `Restok persediaan "${p.name}" — masuk berapa ${label}?` +
        (p.buyUnit && p.buyFactor > 1 ? `\n(Catatan: 1 ${p.buyUnit} = ${p.buyFactor} ${p.unit})` : ""),
      ""
    );
    if (val === null) return;
    const qty = Number(val);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const res = await fetch("/api/admin/packaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, delta: qty, mode: p.buyUnit ? "buy" : "base" }),
    });
    if (!res.ok) alert("Gagal restok bahan");
    router.refresh();
  }

  // Save edit packaging
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const res = await fetch("/api/admin/packaging", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: edit.id,
        name: edit.name,
        unit: edit.unit,
        buyUnit: edit.buyUnit || "",
        buyFactor: edit.buyFactor,
        minStock: edit.minStock,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Gagal menyimpan");
      return;
    }
    setEdit(null);
    router.refresh();
  }

  // Delete packaging
  async function del(p: PackRow) {
    if (!confirm(`Apakah Anda yakin ingin menghapus bahan/kemasan "${p.name}"?`)) return;
    await fetch(`/api/admin/packaging?id=${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  // Delete purchase
  async function deletePurchase(id: string, name: string) {
    if (!confirm(`Hapus catatan belanja "${name}"?

Catatan: stok bahan yang sudah ditambah dari belanja ini TIDAK ikut berkurang — koreksi manual di menu Stok kalau perlu.`)) return;
    setDeletingPurchaseId(id);
    const res = await fetch(`/api/purchases?id=${id}`, { method: "DELETE" });
    setDeletingPurchaseId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Gagal menghapus: ${j.error || "Coba lagi"}`);
      return;
    }
    router.refresh();
  }

  // Handle Excel import
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("Mengunggah dan memproses data...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/packaging/import", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    e.target.value = "";
    if (!res.ok) {
      setImportMsg("❌ " + (j.error || "Gagal import file"));
      return;
    }
    setImportMsg(`✅ Berhasil: ${j.updated} diperbarui, ${j.created} dibuat baru.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. MINI DASHBOARD STOK & BELANJA (KPI SUMMARY CARDS)     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Bahan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center space-x-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold font-mono text-slate-900 leading-tight">
              {totalBahan}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mt-0.5">
              BAHAN BAKU &amp; KEMASAN
            </div>
            <div className="text-[11px] text-slate-500 truncate">Total terdaftar di sistem</div>
          </div>
        </div>

        {/* Card 2: Stok Menipis */}
        <div
          onClick={() => {
            setActiveTab("stok");
            setOnlyLow(true);
          }}
          className={`cursor-pointer border rounded-2xl p-4 flex items-center space-x-4 shadow-xs transition hover:scale-[1.01] ${
            lowCount > 0
              ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
              : "bg-white border-slate-200"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              lowCount > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {lowCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div
              className={`text-2xl font-bold font-mono leading-tight ${
                lowCount > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {lowCount}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mt-0.5">
              BAHAN KRITIS / MENIPIS
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              {lowCount > 0 ? "Klik untuk lihat bahan menipis" : "Semua persediaan aman"}
            </div>
          </div>
        </div>

        {/* Card 3: Belanja Bulan Ini */}
        <div
          onClick={() => setActiveTab("belanja")}
          className="cursor-pointer bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 flex items-center space-x-4 shadow-xs transition hover:scale-[1.01]"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold font-mono text-slate-900 leading-tight truncate">
              {rupiah(totalBelanjaBulan)}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mt-0.5">
              BELANJA BULAN INI
            </div>
            <div className="text-[11px] text-amber-600 font-medium">
              {totalTransaksiBelanja} transaksi pembelian
            </div>
          </div>
        </div>

        {/* Card 4: Quick Action Belanja */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
              OPERASIONAL STOK
            </div>
            <div className="text-sm font-bold text-white mt-0.5">Catat Belanja Bahan?</div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Link
              href="/belanja"
              className="flex-1 py-2 px-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs text-center shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Belanja</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SECTION TABS SWITCHER                                 */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("stok")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
              activeTab === "stok"
                ? "bg-white text-blue-600 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventori Bahan ({rows.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("belanja")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
              activeTab === "belanja"
                ? "bg-white text-blue-600 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Rekapan Belanja Bulanan</span>
            {monthlyPurchases.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                {monthlyPurchases.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("mutasi")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition ${
              activeTab === "mutasi"
                ? "bg-white text-blue-600 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Log Mutasi</span>
          </button>
        </div>

        {/* Link Input Belanja & Template */}
        <div className="flex items-center gap-2">
          <Link
            href="/belanja"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Belanja Baru</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. TAB 1: INVENTORI STOK BAHAN BAKU                      */}
      {/* ======================================================== */}
      {activeTab === "stok" && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Kolom Kiri: Form Tambah & Import */}
          <div className="space-y-5">
            {/* Form Tambah Bahan */}
            <form
              onSubmit={addPack}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs"
            >
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Tambah Bahan / Kemasan Baru</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Daftarkan bahan baku seperti Susu, Kopi, Cup, Wadah, Mie, dll.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Bahan Baku <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  placeholder="Contoh: Susu Fresh Milk, Cup 16oz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Dasar</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ml / gr / pcs"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batas Minimum</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Beli (Opsional)</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="liter / kg / dus"
                    value={buyUnit}
                    onChange={(e) => setBuyUnit(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">1 Beli = Berapa Dasar</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    type="number"
                    min={1}
                    value={buyFactor}
                    onChange={(e) => setBuyFactor(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition disabled:opacity-50"
                disabled={busy}
              >
                {busy ? "Menyimpan..." : "+ Tambah ke Inventori"}
              </button>
            </form>

            {/* Import Massal Excel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-slate-900 text-sm">Import Massal Excel</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kolom file: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">nama, satuan, stok, stok_min</code>
                </p>
              </div>

              <label className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition text-slate-600">
                <Upload className="w-4 h-4 text-slate-400 mb-1" />
                <span className="font-bold text-xs text-slate-700">Pilih file .xlsx / .csv</span>
                <span className="text-[10px] text-slate-400">Tarik file atau ketuk untuk upload</span>
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onImport} />
              </label>

              {importMsg && (
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">
                  {importMsg}
                </p>
              )}
            </div>
          </div>

          {/* Kolom Kanan: Tabel Inventori Bahan */}
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari bahan baku atau kemasan..."
                  value={stokSearch}
                  onChange={(e) => setStokSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyLow(!onlyLow)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    onlyLow
                      ? "bg-rose-600 text-white shadow-xs font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Stok Menipis ({lowCount})</span>
                </button>
              </div>
            </div>

            {/* Tabel Stok */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Daftar Persediaan Stok Bahan</h3>
                <span className="text-xs text-slate-500">{filteredRows.length} bahan ditampilkan</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nama Bahan &amp; Satuan</th>
                      <th className="py-3 px-4 text-right">Sisa Stok</th>
                      <th className="py-3 px-4 text-right">Batas Min</th>
                      <th className="py-3 px-4 text-right">Aksi Inventori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRows.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/60 transition ${p.low ? "bg-rose-50/30" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                            {p.low && (
                              <span className="pill-red text-[10px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Menipis</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Satuan Dasar: <strong className="text-slate-600">{p.unit}</strong>
                            {p.buyUnit ? (
                              <span className="text-slate-500">
                                {" "}· Satuan Beli: {p.buyUnit} (×{p.buyFactor} {p.unit})
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                            p.low ? "text-rose-600" : "text-slate-900"
                          }`}
                        >
                          {p.stock.toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {p.minStock.toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => restock(p)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs transition flex items-center gap-1"
                              title="Restok Masuk"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Restok</span>
                            </button>
                            <button
                              onClick={() => adjust(p)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
                              title="Penyesuaian Tambah / Kurang (+/-)"
                            >
                              +/-
                            </button>
                            <button
                              onClick={() => setStok(p)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition"
                              title="Set Jumlah Fisik"
                            >
                              Set
                            </button>
                            <button
                              onClick={() => setEdit(p)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit Bahan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => del(p)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus Bahan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-400" colSpan={4}>
                          Belum ada data stok bahan baku yang sesuai.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TAB 2: REKAPAN BELANJA BULANAN                        */}
      {/* ======================================================== */}
      {activeTab === "belanja" && (
        <div className="space-y-5">
          {/* Header Rekapan Bulanan & Selector Bulan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  <span>Rekapan Pengeluaran Belanja Bulanan</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rincian barang apa saja yang dibeli dan total biaya yang dihabiskan pada bulan terpilih
                </p>
              </div>

              {/* Month Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Pilih Bulan:</span>
                </span>
                <select
                  value={selectedMonth}
                  onChange={(e) => changeMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Month Summary KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  TOTAL BELANJA BULAN INI
                </div>
                <div className="text-2xl font-bold font-mono text-blue-800 mt-1">
                  {rupiah(totalBelanjaBulan)}
                </div>
                <div className="text-xs text-blue-600 mt-0.5">
                  Total pengeluaran owner di bulan {selectedMonth}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  FREKUENSI PEMBELIAN
                </div>
                <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
                  {totalTransaksiBelanja}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Catatan belanja tercatat</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  RATA-RATA PER TRANSAKSI
                </div>
                <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
                  {rupiah(totalTransaksiBelanja > 0 ? Math.round(totalBelanjaBulan / totalTransaksiBelanja) : 0)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Rata-rata nominal per nota</div>
              </div>
            </div>

            {/* Top 5 Barang Paling Banyak Dibeli */}
            {topSpending.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pengeluaran Belanja Terbesar di Bulan Ini:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {topSpending.map((t, idx) => (
                    <div
                      key={t.name}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs"
                    >
                      <div className="text-[10px] font-bold text-blue-600 mb-0.5">#{idx + 1}</div>
                      <div className="text-xs font-bold text-slate-900 truncate" title={t.name}>
                        {t.name}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-slate-800 mt-1">
                        {rupiah(t.total)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.qty} {t.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filter Bar Belanja */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari barang, toko, atau staf pencatat..."
                value={belanjaSearch}
                onChange={(e) => setBelanjaSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["ALL", "BELANJA", "GAJI", "LAIN"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setBelanjaCat(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    belanjaCat === c
                      ? "bg-blue-600 text-white shadow-xs font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c === "ALL" ? "Semua Kategori" : c === "LAIN" ? "Lainnya" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Rincian Belanja Bulan Ini */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Rincian Barang Belanja ({filteredPurchases.length} Catatan)
              </h3>
              <span className="font-mono font-bold text-xs text-slate-800">
                Total: {rupiah(filteredPurchases.reduce((s, p) => s + p.total, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tanggal &amp; Kategori</th>
                    <th className="py-3 px-4">Barang / Keperluan</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Harga Satuan</th>
                    <th className="py-3 px-4 text-right">Total Biaya</th>
                    <th className="py-3 px-4">Dicatat Oleh</th>
                    <th className="py-3 px-4 text-center">Bukti Nota</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-600 font-semibold">{p.businessDate}</div>
                        <span
                          className={`mt-0.5 inline-block text-[10px] ${
                            p.category === "GAJI"
                              ? "pill-blue"
                              : p.category === "LAIN"
                              ? "pill-slate"
                              : "pill-amber"
                          }`}
                        >
                          {p.category}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{p.itemName}</div>
                        {p.note && (
                          <div className="text-[11px] text-slate-400 mt-0.5">📝 {p.note}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {p.qty} {p.unit || "item"}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {rupiah(p.unitPrice)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {rupiah(p.total)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium">
                        {p.userName || "Admin"}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {p.notaUrl ? (
                          <a
                            href={p.notaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-lg text-[11px]"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Lihat</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <EditPurchase
                            row={{
                              id: p.id,
                              itemName: p.itemName,
                              category: p.category,
                              qty: p.qty,
                              unit: p.unit,
                              unitPrice: p.unitPrice,
                              note: p.note,
                            }}
                          />

                          <button
                            type="button"
                            disabled={deletingPurchaseId === p.id}
                            onClick={() => deletePurchase(p.id, p.itemName)}
                            className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-400" colSpan={8}>
                        Belum ada catatan belanja pada bulan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. TAB 3: LOG MUTASI STOK                                */}
      {/* ======================================================== */}
      {activeTab === "mutasi" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-900 text-sm">
                Riwayat Mutasi &amp; Pergerakan Stok (25 Terakhir)
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
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
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {waktu(m.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{m.packaging.name}</td>
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
      )}

      {/* ======================================================== */}
      {/* 6. MODAL EDIT BAHAN BAKU                                */}
      {/* ======================================================== */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={saveEdit}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Ubah Data Bahan — {edit.name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Konfigurasi konversi satuan beli ke satuan dasar
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Nama Bahan</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Satuan Dasar (Terkecil)</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={edit.unit}
                  onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  placeholder="ml / gr / pcs"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Satuan Beli (Opsional)</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={edit.buyUnit || ""}
                  onChange={(e) => setEdit({ ...edit, buyUnit: e.target.value })}
                  placeholder="liter / kg / dus"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">1 Satuan Beli = ? Dasar</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  type="number"
                  min={1}
                  value={edit.buyFactor}
                  onChange={(e) => setEdit({ ...edit, buyFactor: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Stok Minimum</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  type="number"
                  min={0}
                  value={edit.minStock}
                  onChange={(e) => setEdit({ ...edit, minStock: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              💡 Contoh: Susu satuan dasar <code className="text-blue-600">ml</code>, satuan beli{" "}
              <code className="text-blue-600">liter</code>, faktor <code className="text-blue-600">1000</code> → restok 2 liter otomatis bertambah 2.000 ml.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition"
                onClick={() => setEdit(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
