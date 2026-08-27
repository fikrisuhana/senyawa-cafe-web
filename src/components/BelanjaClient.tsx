"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

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
  userName: string | null;
};

/// Form catat belanja barang owner (per barang) — otomatis jadi kas keluar.
export type BahanOpt = { id: string; name: string; unit: string; buyUnit: string | null; buyFactor: number };

export default function BelanjaClient({ rows, bahans = [] }: { rows: BelanjaRow[]; bahans?: BahanOpt[] }) {
  const router = useRouter();
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [cat, setCat] = useState("BELANJA");
  const [bahanId, setBahanId] = useState("");
  const [bahanQty, setBahanQty] = useState("");
  const [bahanMode, setBahanMode] = useState("");
  const [nbUnit, setNbUnit] = useState("pcs");
  const [nbBuyUnit, setNbBuyUnit] = useState("");
  const [nbBuyFactor, setNbBuyFactor] = useState("1");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const q = Math.max(1, Math.round(Number(qty) || 0));
  const harga = Math.max(0, Math.round(Number(unitPrice) || 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!itemName.trim() || harga <= 0) {
      setMsg("Isi nama barang & harga satuan.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemName, qty: q, unitPrice: harga, unit, note, category: cat,
        ...(bahanId && Number(bahanQty) > 0
          ? bahanId === "__new__"
            ? {
                restockQty: Number(bahanQty),
                restockMode: nbBuyUnit ? "buy" : "base",
                newBahan: { name: itemName, unit: nbUnit, buyUnit: nbBuyUnit, buyFactor: Number(nbBuyFactor) || 1 },
              }
            : { restockPackagingId: bahanId, restockQty: Number(bahanQty), restockMode: bahanMode || "buy" }
          : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(`❌ ${body.error || "Gagal"}`);
      return;
    }
    setItemName("");
    setQty("1");
    setUnit("");
    setUnitPrice("");
    setNote("");
    setMsg(`✅ Tercatat — ${rupiah(body.total)} (biaya owner, bukan dari laci)${bahanId && Number(bahanQty) > 0 ? " + stok bahan bertambah" : ""}`);
    setBahanId("");
    setBahanQty("");
    setNbBuyUnit("");
    setNbBuyFactor("1");
    router.refresh();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Biaya Operasional Owner (Belanja Bahan &amp; Gaji)</h3>
          <p className="text-[11px] text-slate-400">
            Sumber dana owner / modal luar — <b>tidak memotong uang di laci kasir</b>.
          </p>
        </div>
        <span className="pill-slate text-[10px]">Total {rows.length} Pencatatan</span>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-7 gap-3">
        <select
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="BELANJA">Belanja Bahan</option>
          <option value="GAJI">Gaji Karyawan</option>
          <option value="LAIN">Lain-lain</option>
        </select>

        <input
          className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          placeholder="Nama barang / keperluan (mis. Susu UHT 1 Dus)"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />

        <input
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono text-center"
          type="number"
          min={1}
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />

        <input
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          placeholder="Satuan (dus/kg/liter)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />

        <input
          className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold"
          type="number"
          min={0}
          placeholder="Harga Satuan (Rp)"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />

        <button
          type="submit"
          className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-sm transition disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Menyimpan..." : `Catat${harga > 0 ? ` (${rupiah(q * harga)})` : ""}`}
        </button>

        <input
          className="sm:col-span-7 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          placeholder="Catatan tambahan (opsional: toko tempat belanja, dsb)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {cat === "BELANJA" && bahans.length > 0 && (
          <div className="sm:col-span-7 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50/50 border border-blue-100 p-3 text-xs">
            <span className="font-semibold text-blue-900">📦 Sekalian tambah ke stok inventori bahan?</span>
            <select
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none"
              value={bahanId}
              onChange={(e) => {
                setBahanId(e.target.value);
                const b = bahans.find((x) => x.id === e.target.value);
                setBahanMode(b?.buyUnit ? "buy" : "base");
              }}
            >
              <option value="">— Tidak menambah stok —</option>
              {bahans.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="__new__">➕ Buat Bahan Baku Baru…</option>
            </select>
            {bahanId && (
              <>
                <input
                  className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono text-center"
                  type="number"
                  min={0}
                  placeholder="Jumlah"
                  value={bahanQty}
                  onChange={(e) => setBahanQty(e.target.value)}
                />
                {bahanId === "__new__" ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <input className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 text-xs" placeholder="Sat. Dasar" value={nbUnit} onChange={(e) => setNbUnit(e.target.value)} />
                    <input className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 text-xs" placeholder="Sat. Beli" value={nbBuyUnit} onChange={(e) => setNbBuyUnit(e.target.value)} />
                    {nbBuyUnit && (
                      <input
                        className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono"
                        type="number"
                        min={1}
                        title={`1 ${nbBuyUnit} = berapa ${nbUnit}?`}
                        placeholder="Faktor ×"
                        value={nbBuyFactor}
                        onChange={(e) => setNbBuyFactor(e.target.value)}
                      />
                    )}
                  </span>
                ) : (() => {
                  const b = bahans.find((x) => x.id === bahanId)!;
                  return b.buyUnit ? (
                    <select className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800" value={bahanMode} onChange={(e) => setBahanMode(e.target.value)}>
                      <option value="buy">{b.buyUnit} (×{b.buyFactor} {b.unit})</option>
                      <option value="base">{b.unit}</option>
                    </select>
                  ) : (
                    <span className="text-slate-600 font-semibold">{b.unit}</span>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </form>

      {msg && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
          {msg}
        </div>
      )}

      {/* Rincian Belanja List */}
      <div className="divide-y divide-slate-100 pt-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className={r.category === "GAJI" ? "pill-blue" : r.category === "LAIN" ? "pill-slate" : "pill-amber"}>
                  {r.category === "GAJI" ? "GAJI" : r.category === "LAIN" ? "LAINNYA" : "BELANJA"}
                </span>
                <span className="font-bold text-slate-900">{r.itemName}</span>
                <span className="text-slate-400">
                  · {r.qty} {r.unit || "x"} @ {rupiah(r.unitPrice)}
                </span>
              </div>
              {r.note && <p className="truncate text-[11px] text-slate-400 mt-0.5">{r.note}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-bold text-slate-900">{rupiah(r.total)}</p>
              <p className="text-[10px] text-slate-400">
                {r.businessDate} · {r.userName || "Admin"}
              </p>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="py-6 text-center text-slate-400 text-xs">
            Belum ada data belanja/biaya owner pada periode ini.
          </p>
        )}
      </div>
    </div>
  );
}
