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
    <div className="card space-y-3">
      <div>
        <h2 className="font-bold">💼 Biaya Owner (Belanja / Gaji)</h2>
        <p className="text-xs text-slate-500">
          Uang owner — <b>tidak dari laci kasir</b>, tidak mengurangi saldo kas. Terpisah di laporan.
        </p>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-7">
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="BELANJA">Belanja bulanan</option>
          <option value="GAJI">Gaji karyawan</option>
          <option value="LAIN">Lainnya</option>
        </select>
        <input
          className="input col-span-2 sm:col-span-2"
          placeholder="Nama barang (mis. Biji kopi 1kg)"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <input
          className="input"
          type="number"
          min={1}
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          className="input"
          placeholder="Satuan (kg/liter)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <input
          className="input"
          type="number"
          min={0}
          placeholder="Harga satuan"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "…" : `Catat${harga > 0 ? ` · ${rupiah(q * harga)}` : ""}`}
        </button>
        <input
          className="input col-span-2 sm:col-span-7"
          placeholder="Catatan (opsional — di mana belanja, dsb)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {cat === "BELANJA" && bahans.length > 0 && (
          <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs sm:col-span-7">
            <span className="font-medium text-slate-600">📦 Sekalian tambah stok bahan?</span>
            <select
              className="input h-8 w-auto flex-1 min-w-[140px] text-xs"
              value={bahanId}
              onChange={(e) => {
                setBahanId(e.target.value);
                const b = bahans.find((x) => x.id === e.target.value);
                setBahanMode(b?.buyUnit ? "buy" : "base");
              }}
            >
              <option value="">— tidak usah —</option>
              {bahans.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="__new__">➕ Barang baru (buat bahan)…</option>
            </select>
            {bahanId && (
              <>
                <input
                  className="input h-8 w-20 text-xs"
                  type="number"
                  min={0}
                  placeholder="qty"
                  value={bahanQty}
                  onChange={(e) => setBahanQty(e.target.value)}
                />
                {bahanId === "__new__" ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <input className="input h-8 w-16 text-xs" placeholder="satuan" value={nbUnit} onChange={(e) => setNbUnit(e.target.value)} />
                    <input className="input h-8 w-16 text-xs" placeholder="beli (ops.)" value={nbBuyUnit} onChange={(e) => setNbBuyUnit(e.target.value)} />
                    {nbBuyUnit && (
                      <input
                        className="input h-8 w-16 text-xs"
                        type="number"
                        min={1}
                        title={`1 ${nbBuyUnit} = berapa ${nbUnit}?`}
                        placeholder="×?"
                        value={nbBuyFactor}
                        onChange={(e) => setNbBuyFactor(e.target.value)}
                      />
                    )}
                  </span>
                ) : (() => {
                  const b = bahans.find((x) => x.id === bahanId)!;
                  return b.buyUnit ? (
                    <select className="input h-8 w-auto text-xs" value={bahanMode} onChange={(e) => setBahanMode(e.target.value)}>
                      <option value="buy">{b.buyUnit} (×{b.buyFactor} {b.unit})</option>
                      <option value="base">{b.unit}</option>
                    </select>
                  ) : (
                    <span className="text-slate-500">{b.unit}</span>
                  );
                })()}
                {bahanId === "__new__" && itemName.trim() === "" && (
                  <span className="text-orange-600">isi nama barang dulu (dipakai sbg nama bahan)</span>
                )}
              </>
            )}
          </div>
        )}
      </form>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}

      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <div className="min-w-0">
              <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {r.category === "GAJI" ? "GAJI" : r.category === "LAIN" ? "LAIN" : "BELANJA"}
              </span>
              <span className="font-medium">{r.itemName}</span>
              <span className="text-slate-400">
                {" "}
                · {r.qty}
                {r.unit || "x"} @ {rupiah(r.unitPrice)}
              </span>
              {r.note && <p className="truncate text-xs text-slate-400">{r.note}</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{rupiah(r.total)}</p>
              <p className="text-xs text-slate-400">
                {r.businessDate} · {r.userName || "-"}
              </p>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-2 text-sm text-slate-500">Belum ada belanja di periode ini.</p>}
      </div>
    </div>
  );
}
