"use client";

import { useState, useEffect, useMemo } from "react";
import EditPurchase from "@/components/EditPurchase";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import {
  ShoppingBag,
  Package,
  Plus,
  Minus,
  Camera,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  Sparkles,
  Layers,
  X,
  Store,
  Tag,
  Receipt,
  RotateCcw,
  Check,
  PlusCircle,
  HelpCircle,
} from "lucide-react";

export type BelanjaRow = {
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

export type BahanOpt = {
  id: string;
  name: string;
  unit: string;
  buyUnit: string | null;
  buyFactor: number;
  stock?: number;
  minStock?: number;
};

const COMMON_UNITS = ["pcs", "kg", "liter", "dus", "pak", "botol", "kaleng", "gram", "ml"];

export default function BelanjaClient({
  rows,
  bahans = [],
  staffMode = false,
}: {
  rows: BelanjaRow[];
  bahans?: BahanOpt[];
  staffMode?: boolean;
}) {
  const router = useRouter();

  // Local state for bahan list so it updates instantly
  const [localBahans, setLocalBahans] = useState<BahanOpt[]>(bahans);
  useEffect(() => {
    setLocalBahans(bahans);
  }, [bahans]);

  // Active Tab: "form" | "history" | "stok"
  const [activeTab, setActiveTab] = useState<"form" | "history" | "stok">("form");

  // Form State
  const [cat, setCat] = useState("BELANJA");

  // Sumber Barang: "existing" (dari inventori) | "new" (buat bahan baru) | "non_stock" (hanya biaya/operasional)
  const [itemMode, setItemMode] = useState<"existing" | "new" | "non_stock">("existing");

  // Selected Existing Bahan ID
  const [selectedBahanId, setSelectedBahanId] = useState<string>("");
  const [bahanUnitMode, setBahanUnitMode] = useState<"buy" | "base">("buy");

  // General item fields
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");

  // Bahan Baru fields
  const [nbName, setNbName] = useState("");
  const [nbUnit, setNbUnit] = useState("pcs");
  const [nbBuyUnit, setNbBuyUnit] = useState("");
  const [nbBuyFactor, setNbBuyFactor] = useState("1");

  // Foto Nota
  const [nota, setNota] = useState<File | null>(null);
  const [notaPreview, setNotaPreview] = useState<string | null>(null);
  const [notaName, setNotaName] = useState("");
  const [reuseLast, setReuseLast] = useState(false);
  const [lastNota, setLastNota] = useState<{ url: string; name: string } | null>(null);

  // History Filter
  const [searchHistory, setSearchHistory] = useState("");
  const [filterCat, setFilterCat] = useState("ALL");

  // Stok Search Filter
  const [searchStok, setSearchStok] = useState("");

  // UI state
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load lastNota from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lastNota");
      if (raw) setLastNota(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Update image preview when nota changes
  useEffect(() => {
    if (!nota) {
      setNotaPreview(null);
      return;
    }
    const url = URL.createObjectURL(nota);
    setNotaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [nota]);

  // When selected existing bahan changes, autofill name & unit
  const activeBahan = useMemo(() => {
    if (!selectedBahanId) return null;
    return localBahans.find((b) => b.id === selectedBahanId) || null;
  }, [selectedBahanId, localBahans]);

  useEffect(() => {
    if (itemMode === "existing" && activeBahan) {
      setItemName(activeBahan.name);
      setUnit(activeBahan.buyUnit || activeBahan.unit);
      setBahanUnitMode(activeBahan.buyUnit ? "buy" : "base");
    }
  }, [selectedBahanId, itemMode, activeBahan]);

  // Auto switch itemMode if category is GAJI or LAIN
  useEffect(() => {
    if (cat === "GAJI" || cat === "LAIN") {
      setItemMode("non_stock");
    }
  }, [cat]);

  const q = Math.max(1, Math.round(Number(qty) || 1));
  const harga = Math.max(0, Math.round(Number(unitPrice) || 0));
  const totalBiaya = q * harga;

  // Handle click on quick-pick bahan suggestion chip
  function selectBahanChip(b: BahanOpt) {
    setItemMode("existing");
    setSelectedBahanId(b.id);
    setItemName(b.name);
    setUnit(b.buyUnit || b.unit);
    setBahanUnitMode(b.buyUnit ? "buy" : "base");
  }

  // Adjust numeric stepper
  function stepQty(delta: number) {
    const next = Math.max(1, (Number(qty) || 1) + delta);
    setQty(String(next));
  }

  // Manual Refresh
  function handleManualRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setRefreshing(false);
      setMsg({ type: "success", text: "Data persediaan stok & riwayat berhasil diperbarui!" });
    }, 600);
  }

  // Form Submit
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const finalItemName =
      itemMode === "new"
        ? nbName.trim()
        : itemMode === "existing" && activeBahan
        ? activeBahan.name
        : itemName.trim();

    if (!finalItemName) {
      setMsg({ type: "error", text: "Mohon isi atau pilih nama barang belanja." });
      return;
    }
    if (harga <= 0) {
      setMsg({ type: "error", text: "Harga satuan harus lebih dari Rp 0." });
      return;
    }

    setBusy(true);

    const payload: Record<string, string> = {
      itemName: finalItemName,
      qty: String(q),
      unitPrice: String(harga),
      unit: unit.trim(),
      note: note.trim(),
      category: cat,
      // Restok inventori dikendalikan langsung oleh itemMode di atas
      ...(cat === "BELANJA" && itemMode === "existing" && selectedBahanId
        ? {
            restockPackagingId: selectedBahanId,
            restockQty: String(q),
            restockMode: bahanUnitMode,
          }
        : {}),
      ...(cat === "BELANJA" && itemMode === "new" && nbName.trim()
        ? {
            restockQty: String(q),
            restockMode: nbBuyUnit ? "buy" : "base",
            newBahan: JSON.stringify({
              name: nbName.trim(),
              unit: nbUnit,
              buyUnit: nbBuyUnit || null,
              buyFactor: Number(nbBuyFactor) || 1,
            }),
          }
        : {}),
      ...(nota && notaName.trim() ? { notaName: notaName.trim() } : {}),
      ...(!nota && reuseLast && lastNota ? { reuseNotaUrl: lastNota.url, reuseNotaName: lastNota.name } : {}),
    };

    let res: Response;
    if (nota) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(payload)) fd.append(k, v);
      fd.append("nota", nota);
      res = await fetch("/api/purchases", { method: "POST", body: fd });
    } else {
      res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMsg({ type: "error", text: body.error || "Gagal menyimpan catatan belanja." });
      return;
    }

    // Update local state instantly so user sees stock increase right away!
    if (cat === "BELANJA" && itemMode === "existing" && activeBahan) {
      const delta =
        bahanUnitMode === "buy" ? q * (activeBahan.buyFactor || 1) : q;
      setLocalBahans((prev) =>
        prev.map((b) =>
          b.id === activeBahan.id ? { ...b, stock: (b.stock ?? 0) + delta } : b
        )
      );
    }

    // Success reset
    setItemName("");
    setNbName("");
    setQty("1");
    setUnit("");
    setUnitPrice("");
    setNote("");
    setNota(null);
    setNotaName("");
    setReuseLast(false);
    setSelectedBahanId("");
    setNbBuyUnit("");
    setNbBuyFactor("1");

    if (body.notaUrl) {
      const ln = { url: String(body.notaUrl), name: String(body.notaName || notaName || "nota") };
      setLastNota(ln);
      try {
        localStorage.setItem("lastNota", JSON.stringify(ln));
      } catch {
        /* ignore */
      }
    }

    const restockNote =
      cat === "BELANJA" && itemMode !== "non_stock"
        ? " & stok bahan otomatis bertambah"
        : "";

    setMsg({
      type: "success",
      text: `Berhasil dicatat: ${rupiah(body.total)}${restockNote}.${
        body.notaWarning ? " (⚠️ " + body.notaWarning + ")" : ""
      }`,
    });

    router.refresh();
  }

  // Delete purchase with automatic stock rollback & movement deletion
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus catatan belanja "${name}"? Stok bahan yang pernah ditambah dari belanja ini akan otomatis dikembalikan & log barang dibersihkan.`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/purchases?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      alert(`Gagal menghapus: ${b.error || "Coba lagi"}`);
      return;
    }
    setMsg({
      type: "success",
      text: `Catatan belanja "${name}" telah dihapus, stok dikembalikan, dan log mutasi dibersihkan.`,
    });
    router.refresh();
  }

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchCat = filterCat === "ALL" || r.category === filterCat;
      const matchQuery =
        !searchHistory ||
        r.itemName.toLowerCase().includes(searchHistory.toLowerCase()) ||
        (r.note && r.note.toLowerCase().includes(searchHistory.toLowerCase())) ||
        (r.userName && r.userName.toLowerCase().includes(searchHistory.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [rows, filterCat, searchHistory]);

  const totalPengeluaranRiwayat = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + r.total, 0);
  }, [filteredRows]);

  // Filtered bahans
  const filteredBahans = useMemo(() => {
    return localBahans.filter((b) =>
      !searchStok || b.name.toLowerCase().includes(searchStok.toLowerCase())
    );
  }, [localBahans, searchStok]);

  const lowStockCount = useMemo(() => {
    return localBahans.filter((b) => (b.stock ?? 0) <= (b.minStock ?? 0)).length;
  }, [localBahans]);

  return (
    <div className="space-y-4">
      {/* Feedback Toast Banner */}
      {msg && (
        <div
          className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border text-xs transition animate-in fade-in duration-150 ${
            msg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition ${
              activeTab === "form"
                ? "bg-white text-blue-600 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat Belanja</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition ${
              activeTab === "history"
                ? "bg-white text-blue-600 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Riwayat ({rows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stok")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition ${
              activeTab === "stok"
                ? "bg-white text-blue-600 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Cek Stok ({localBahans.length})</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                {lowStockCount}
              </span>
            )}
          </button>
        </div>

        {/* Sync / Refresh Button */}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition shrink-0"
          title="Sinkronkan data terbaru"
        >
          <RotateCcw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: FORM CATAT BELANJA (UNIFIED TOP INVENTORY LOGIC)  */}
      {/* ======================================================== */}
      {activeTab === "form" && (
        <form onSubmit={submit} className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
            {/* Header Form */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <span>{staffMode ? "Form Belanja Harian" : "Catat Belanja & Biaya Owner"}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dana modal owner — tidak memotong uang kas laci kasir
                </p>
              </div>

              {/* Category Segmented Selector */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCat("BELANJA")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    cat === "BELANJA"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Belanja Bahan
                </button>
                {!staffMode && (
                  <button
                    type="button"
                    onClick={() => setCat("GAJI")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      cat === "GAJI"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Gaji
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCat("LAIN")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    cat === "LAIN"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Lainnya
                </button>
              </div>
            </div>

            {/* ========================================================== */}
            {/* SATUKAN PEMILIHAN BARANG & SUMBER STOK LANGSUNG DI ATAS    */}
            {/* ========================================================== */}
            {cat === "BELANJA" && (
              <div className="space-y-3 p-3.5 bg-blue-50/40 rounded-2xl border border-blue-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Jenis Barang &amp; Pengaruh ke Stok:</span>
                  </span>

                  {/* 3 Mode: Existing | New | Non-Stock */}
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setItemMode("existing")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        itemMode === "existing"
                          ? "bg-blue-600 text-white shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      📦 Bahan yang Ada
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemMode("new")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        itemMode === "new"
                          ? "bg-blue-600 text-white shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      ➕ Bahan Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemMode("non_stock")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        itemMode === "non_stock"
                          ? "bg-slate-700 text-white shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🛒 Non-Stok (Biaya saja)
                    </button>
                  </div>
                </div>

                {/* MODE 1: BAHAN YANG SUDAH ADA DI INVENTORI */}
                {itemMode === "existing" && (
                  <div className="space-y-2.5">
                    {/* Chips Pilihan Cepat */}
                    {localBahans.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                        {localBahans.slice(0, 10).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => selectBahanChip(b)}
                            className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold border transition ${
                              selectedBahanId === b.id
                                ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-bold"
                                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            <span>{b.name}</span>
                            <span className={`ml-1 text-[10px] ${selectedBahanId === b.id ? "text-blue-100" : "text-slate-400"}`}>
                              ({b.stock ?? 0} {b.unit})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Dropdown Bahan */}
                    <div>
                      <select
                        value={selectedBahanId}
                        onChange={(e) => setSelectedBahanId(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">— Pilih Bahan Baku dari Inventori —</option>
                        {localBahans.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} (Sisa stok: {b.stock ?? 0} {b.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Badge Otomatis Nambah Stok */}
                    {activeBahan && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Otomatis restok ke: <b>{activeBahan.name}</b> (Sisa fisik: {activeBahan.stock ?? 0} {activeBahan.unit})
                          </span>
                        </div>

                        {/* Opsi Satuan Beli vs Satuan Dasar jika ada */}
                        {activeBahan.buyUnit && (
                          <select
                            value={bahanUnitMode}
                            onChange={(e) => setBahanUnitMode(e.target.value as "buy" | "base")}
                            className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-900 focus:outline-none"
                          >
                            <option value="buy">
                              Satuan Beli: {activeBahan.buyUnit} (×{activeBahan.buyFactor} {activeBahan.unit})
                            </option>
                            <option value="base">Satuan Dasar: {activeBahan.unit}</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 2: TAMBAH BAHAN BAKU BARU KE STOK */}
                {itemMode === "new" && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 text-xs animate-in fade-in duration-100">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Daftarkan Bahan Baru ke Inventori Stok:</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Bahan Baru <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Mis. Sirup Karamel, Susu Oat, Keju Mozarella"
                        value={nbName}
                        onChange={(e) => {
                          setNbName(e.target.value);
                          setItemName(e.target.value);
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                          Satuan Dasar
                        </label>
                        <input
                          type="text"
                          required
                          value={nbUnit}
                          onChange={(e) => {
                            setNbUnit(e.target.value);
                            setUnit(e.target.value);
                          }}
                          placeholder="ml / pcs / gr"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                          Satuan Beli (Opsional)
                        </label>
                        <input
                          type="text"
                          value={nbBuyUnit}
                          onChange={(e) => setNbBuyUnit(e.target.value)}
                          placeholder="liter / dus / kg"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                          1 Beli = Berapa Dasar
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={nbBuyFactor}
                          onChange={(e) => setNbBuyFactor(e.target.value)}
                          placeholder="1000"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-blue-50 text-[11px] text-blue-700">
                      ✨ Bahan ini otomatis tersimpan di tabel stok &amp; langsung bertambah saat disimpan.
                    </div>
                  </div>
                )}

                {/* MODE 3: HANYA CATAT PENGELUARAN (NON-STOK) */}
                {itemMode === "non_stock" && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Barang / Keperluan Belanja <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Sabun Cuci Piring, Plastik Sampah, Galon Air"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] text-slate-600">
                      ℹ️ Hanya mencatat pengeluaran keuangan kas owner — tidak menambah stok fisik di inventori bahan.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Jika kategori GAJI atau LAINNYA */}
            {cat !== "BELANJA" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Keperluan / Keterangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={cat === "GAJI" ? "Gaji Karyawan Bulan Ini" : "Pengeluaran Operasional Lainnya"}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            )}

            {/* Section: Qty, Satuan, & Harga Satuan */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Qty Stepper */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah (Qty)</label>
                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white">
                    <button
                      type="button"
                      onClick={() => stepQty(-1)}
                      className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      required
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full py-2 text-center text-xs sm:text-sm font-mono font-bold bg-transparent text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => stepQty(1)}
                      className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Satuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    placeholder="dus / kg / liter / pcs"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                  {/* Quick unit pills */}
                  <div className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-none">
                    {COMMON_UNITS.slice(0, 5).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          unit === u
                            ? "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Harga Satuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Satuan (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min={0}
                      required
                      placeholder="0"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* LIVE TOTAL BANNER */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-blue-900 block">Total Biaya Belanja</span>
                  <span className="text-xs text-blue-700">
                    {q} {unit || "item"} × {rupiah(harga)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-xl font-bold font-mono text-blue-700">
                    {rupiah(totalBiaya)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section: Catatan & Foto Nota */}
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Nama toko, keperluan, atau rincian spesifik lainnya"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Foto Nota Uploader */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Bukti Foto Nota Belanja (Opsional)
                </label>

                {!nota ? (
                  <div className="space-y-2">
                    <label className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl cursor-pointer transition text-center sm:text-left">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          Ketuk untuk Ambil Foto Nota atau Pilih File
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Kamera HP / JPG / PNG / PDF otomatis tersimpan di Google Drive
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          setNota(e.target.files?.[0] || null);
                          setReuseLast(false);
                        }}
                      />
                    </label>

                    {/* Pakai Nota Terakhir */}
                    {lastNota && (
                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reuseLast}
                          onChange={(e) => setReuseLast(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="truncate">
                          🧾 Gunakan foto nota sebelumnya: <b>{lastNota.name}</b> (1 struk banyak barang)
                        </span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {notaPreview ? (
                        <img
                          src={notaPreview}
                          alt="Preview Nota"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Receipt className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{nota.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {(nota.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setNota(null);
                        setNotaPreview(null);
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {busy ? "Menyimpan ke Sistem..." : `Simpan Catatan Belanja • ${rupiah(totalBiaya)}`}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 2: RIWAYAT BELANJA (SEARCH & CARDS)                   */}
      {/* ======================================================== */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari barang, catatan, atau staf..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(["ALL", "BELANJA", "GAJI", "LAIN"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCat(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      filterCat === c
                        ? "bg-blue-600 text-white shadow-xs font-bold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c === "ALL" ? "Semua" : c === "LAIN" ? "Lainnya" : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
              <span className="text-slate-500">{filteredRows.length} catatan belanja ditemukan</span>
              <span className="font-bold text-slate-900">
                Total: <span className="font-mono text-blue-600">{rupiah(totalPengeluaranRiwayat)}</span>
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredRows.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-200 transition space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={
                          r.category === "GAJI"
                            ? "pill-blue text-[10px]"
                            : r.category === "LAIN"
                            ? "pill-slate text-[10px]"
                            : "pill-amber text-[10px]"
                        }
                      >
                        {r.category}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{r.itemName}</h4>
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.qty} {r.unit || "item"} @ {rupiah(r.unitPrice)}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-slate-900 text-sm sm:text-base">
                      {rupiah(r.total)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {r.businessDate} · {r.userName || "Admin"}
                    </div>
                  </div>
                </div>

                {r.note && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    📝 {r.note}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div>
                    {r.notaUrl ? (
                      <a
                        href={r.notaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Lihat Bukti Nota</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">Tanpa nota foto</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <EditPurchase
                      row={{
                        id: r.id,
                        itemName: r.itemName,
                        category: r.category,
                        qty: r.qty,
                        unit: r.unit,
                        unitPrice: r.unitPrice,
                        note: r.note,
                      }}
                    />

                    <button
                      type="button"
                      disabled={deletingId === r.id}
                      onClick={() => handleDelete(r.id, r.itemName)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition"
                      title="Hapus catatan (stok otomatis dikembalikan & log dibersihkan)"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredRows.length === 0 && (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
                Tidak ada data belanja yang cocok dengan pencarian.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CEK STOK BAHAN BAKU                              */}
      {/* ======================================================== */}
      {activeTab === "stok" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari persediaan bahan..."
                value={searchStok}
                onChange={(e) => setSearchStok(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {lowStockCount > 0 && (
              <span className="pill-red text-xs flex items-center gap-1 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{lowStockCount} Menipis</span>
              </span>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
            {filteredBahans.map((p) => {
              const isLow = (p.stock ?? 0) <= (p.minStock ?? 0);
              return (
                <div
                  key={p.id}
                  className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition ${
                    isLow ? "bg-rose-50/40" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      {isLow && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                      <span className={`font-bold ${isLow ? "text-rose-900" : "text-slate-900"}`}>
                        {p.name}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Satuan: {p.unit}
                      {p.buyUnit && ` (Beli: ${p.buyUnit} ×${p.buyFactor})`}
                      {p.minStock && p.minStock > 0 ? ` · Batas Min: ${p.minStock} ${p.unit}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono">
                      <span className={`font-bold text-sm ${isLow ? "text-rose-600" : "text-slate-800"}`}>
                        {(p.stock ?? 0).toLocaleString("id-ID")}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">{p.unit}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        selectBahanChip(p);
                        setActiveTab("form");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-xs transition"
                    >
                      Beli Ini
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredBahans.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                Tidak ada data bahan yang terdaftar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
