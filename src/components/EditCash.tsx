"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

type Entry = { id: string; type: string; amount: number; category: string; note: string | null };

/** Tombol + modal EDIT catatan kas (nominal / keterangan / kategori / tipe). */
export default function EditCash({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(entry.type === "MASUK" ? "MASUK" : "KELUAR");
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category || "");
  const [note, setNote] = useState(entry.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/cash", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: entry.id, type, amount: Number(amount), category, note }),
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
        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition inline-flex items-center"
        title="Edit Catatan"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Edit Catatan Kas</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-slate-600">Tipe</label>
                <div className="flex gap-2">
                  {(["MASUK", "KELUAR"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 font-semibold transition ${
                        type === t
                          ? t === "MASUK"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {t === "MASUK" ? "Kas Masuk" : "Kas Keluar"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Nominal (Rp)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Kategori</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="mis. LAINNYA"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
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
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={save}
                  disabled={busy || Number(amount) <= 0}
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
