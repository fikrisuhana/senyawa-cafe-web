"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { rupiah } from "@/lib/format";

type Part = { method: string; amount: number };
type Trx = { id: string; code: string; cashierName: string; payment: string; total: number; parts: Part[] };

const METODE = ["TUNAI", "QRIS", "TRANSFER"];
const SPLIT = "SPLIT";

/** Tombol + modal ADMIN koreksi transaksi: ganti kasir & metode bayar (termasuk SPLIT 2 metode). */
export default function EditTrx({ trx, employees }: { trx: Trx; employees: string[] }) {
  const router = useRouter();
  const wasSplit = trx.payment === SPLIT && trx.parts.length === 2;
  const [open, setOpen] = useState(false);
  const [cashier, setCashier] = useState(trx.cashierName);
  const [payment, setPayment] = useState(trx.payment);
  // Split: metode A + nominal A diketik; metode B = sisanya (total − A) otomatis.
  const [methodA, setMethodA] = useState(wasSplit ? trx.parts[0].method : "TUNAI");
  const [methodB, setMethodB] = useState(wasSplit ? trx.parts[1].method : "TRANSFER");
  const [amountA, setAmountA] = useState(wasSplit ? String(trx.parts[0].amount) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Pastikan nilai lama tetap muncul di dropdown walau tak ada di daftar aktif.
  const kasirOpts = employees.includes(trx.cashierName) ? employees : [trx.cashierName, ...employees];
  const base = [...METODE, SPLIT];
  const metodeOpts = base.includes(trx.payment) ? base : [trx.payment, ...base];

  const isSplit = payment === SPLIT;
  const a = Math.round(Number(amountA) || 0);
  const b = trx.total - a;
  const splitErr = !isSplit
    ? ""
    : methodA === methodB
      ? "Metode split harus beda"
      : a <= 0 || b <= 0
        ? `Nominal ${methodA} harus antara Rp1 dan ${rupiah(trx.total - 1)}`
        : "";

  function pickA(m: string) {
    setMethodA(m);
    // Hindari A = B: geser B ke metode lain yang pertama.
    if (m === methodB) setMethodB(METODE.find((x) => x !== m) || "TRANSFER");
  }

  async function save() {
    if (splitErr) {
      setErr(splitErr);
      return;
    }
    setBusy(true);
    setErr("");
    const body = isSplit
      ? { id: trx.id, cashierName: cashier, payments: [{ method: methodA, amount: a }, { method: methodB, amount: b }] }
      : { id: trx.id, cashierName: cashier, payment };
    const res = await fetch("/api/transactions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none";

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
            <p className="mb-3 font-mono text-xs text-slate-400">
              {trx.code} · Total <span className="font-bold text-slate-600">{rupiah(trx.total)}</span>
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-slate-600">Kasir</label>
                <select value={cashier} onChange={(e) => setCashier(e.target.value)} className={inputCls}>
                  {kasirOpts.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-600">Metode Bayar</label>
                <select value={payment} onChange={(e) => setPayment(e.target.value)} className={inputCls}>
                  {metodeOpts.map((m) => (
                    <option key={m} value={m}>{m === SPLIT ? "SPLIT (2 metode)" : m}</option>
                  ))}
                </select>
                {!isSplit && payment !== "TUNAI" && (
                  <p className="mt-1 text-[11px] text-slate-400">Non-tunai → kembalian otomatis jadi 0 (bayar pas).</p>
                )}
              </div>

              {isSplit && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <select value={methodA} onChange={(e) => pickA(e.target.value)} className={inputCls}>
                      {METODE.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={amountA}
                      onChange={(e) => setAmountA(e.target.value)}
                      placeholder="Nominal"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <select value={methodB} onChange={(e) => setMethodB(e.target.value)} className={inputCls}>
                      {METODE.filter((m) => m !== methodA).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className={`${inputCls} bg-slate-50 font-mono text-slate-600`}>
                      {b > 0 ? rupiah(b) : "—"}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {methodB} otomatis = sisa dari total. Koreksi admin dianggap bayar pas (kembalian 0).
                  </p>
                </div>
              )}

              {err || splitErr ? <p className="text-xs font-medium text-rose-600">{err || splitErr}</p> : null}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">
                  Batal
                </button>
                <button
                  onClick={save}
                  disabled={busy || !!splitErr}
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
