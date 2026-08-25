"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

export type BelanjaRow = {
  id: string;
  businessDate: string;
  itemName: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  note: string | null;
  userName: string | null;
};

/// Form catat belanja barang owner (per barang) — otomatis jadi kas keluar.
export default function BelanjaClient({ rows }: { rows: BelanjaRow[] }) {
  const router = useRouter();
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
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
      body: JSON.stringify({ itemName, qty: q, unitPrice: harga, unit, note }),
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
    setMsg(`✅ Tercatat — ${rupiah(body.total)} (ikut kas keluar)`);
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-bold">🛒 Belanja Barang</h2>
        <p className="text-xs text-slate-500">
          Catat per barang. Otomatis jadi <b>Kas Keluar (kategori Belanja)</b> — saldo laci tetap akurat.
        </p>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
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
          className="input col-span-2 sm:col-span-6"
          placeholder="Catatan (opsional — di mana belanja, dsb)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}

      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <div className="min-w-0">
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
