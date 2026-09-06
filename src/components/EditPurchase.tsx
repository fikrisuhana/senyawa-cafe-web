"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

type Row = {
  id: string;
  itemName: string;
  category: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  note: string | null;
};

/** Tombol + modal EDIT catatan belanja/biaya (nama/qty/harga/unit/keterangan/kategori).
 *  Koreksi CATATAN saja — stok yang sudah masuk saat belanja TIDAK ikut berubah. */
export default function EditPurchase({ row }: { row: Row }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState(row.itemName);
  const [category, setCategory] = useState(["BELANJA", "GAJI", "LAIN"].includes(row.category) ? row.category : "BELANJA");
  const [qty, setQty] = useState(String(row.qty));
  const [unit, setUnit] = useState(row.unit || "");
  const [unitPrice, setUnitPrice] = useState(String(row.unitPrice));
  const [note, setNote] = useState(row.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/purchases", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        itemName,
        category,
        qty: Number(qty),
        unit,
        unitPrice: Number(unitPrice),
        note,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) {
      setErr(j.error || "Gagal menyimpan");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-emerald-600"
        title="Edit catatan"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Edit Catatan Belanja</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-slate-600">Nama / Deskripsi</label>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Kategori</label>
                <div className="flex gap-2">
                  {(["BELANJA", "GAJI", "LAIN"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                        category === c ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {c === "LAIN" ? "LAINNYA" : c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block font-medium text-slate-600">Qty</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block font-medium text-slate-600">Satuan</label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs / liter"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Harga Satuan (Rp)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Total: Rp {(Math.max(0, Number(qty) || 0) * Math.max(0, Number(unitPrice) || 0)).toLocaleString("id-ID")}
                </p>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Keterangan</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Opsional"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button
                  onClick={save}
                  disabled={busy || !itemName.trim() || Number(unitPrice) <= 0}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
