"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

type Trx = { id: string; code: string; cashierName: string; payment: string };

const METODE = ["TUNAI", "QRIS", "TRANSFER"];

/** Tombol + modal ADMIN koreksi transaksi: ganti kasir & metode bayar. */
export default function EditTrx({ trx, employees }: { trx: Trx; employees: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cashier, setCashier] = useState(trx.cashierName);
  const [payment, setPayment] = useState(trx.payment);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Pastikan nilai lama tetap muncul di dropdown walau tak ada di daftar aktif.
  const kasirOpts = employees.includes(trx.cashierName) ? employees : [trx.cashierName, ...employees];
  const metodeOpts = METODE.includes(trx.payment) ? METODE : [trx.payment, ...METODE];

  async function save() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/transactions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: trx.id, cashierName: cashier, payment }),
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
        className="px-2 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded font-semibold text-[11px] transition inline-flex items-center gap-1"
        title="Koreksi kasir / metode"
      >
        <Pencil className="w-3 h-3" /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl text-left" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Koreksi Transaksi</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 font-mono text-xs text-slate-400">{trx.code}</p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-slate-600">Kasir</label>
                <select
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                >
                  {kasirOpts.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Metode Bayar</label>
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                >
                  {metodeOpts.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {payment !== "TUNAI" && (
                  <p className="mt-1 text-[11px] text-slate-400">Non-tunai → kembalian otomatis jadi 0 (bayar pas).</p>
                )}
              </div>

              {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button
                  onClick={save}
                  disabled={busy}
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
