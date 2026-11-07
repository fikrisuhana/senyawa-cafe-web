"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { rupiah } from "@/lib/format";

type Status = { status: string; paidVia: string | null; online: boolean; master: { name: string } | null };

/**
 * Bayar QRIS di kasir WEB: buat tagihan di server (nominal + kode unik bila
 * bentrok) → tampilkan QR bernominal → polling status tiap 2 dtk. HP MASTER
 * (GoPay Merchant) melapor pembayaran → server cocokkan → LUNAS otomatis.
 * Cadangan: kasir konfirmasi manual setelah cek GoPay Merchant.
 */
export default function QrisPayModal({
  amount,
  label,
  onPaid,
  onClose,
}: {
  amount: number;
  label?: string;
  onPaid: (via: string) => void;
  onClose: () => void;
}) {
  const [intent, setIntent] = useState<{ id: string; amount: number; uniqueCode: number } | null>(null);
  const [qrImg, setQrImg] = useState("");
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const done = useRef(false);

  // Buat tagihan sekali saat modal dibuka.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/payment-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, label: label || null, source: "WEB" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok || !j.qris) {
        setErr(j.error || "QRIS toko belum diatur di Pengaturan");
        return;
      }
      setIntent({ id: j.id, amount: j.amount, uniqueCode: j.uniqueCode });
      setSt({ status: "PENDING", paidVia: null, online: j.online, master: j.master });
      setQrImg(await QRCode.toDataURL(j.qris, { width: 280, margin: 1, errorCorrectionLevel: "M" }));
    })();
    return () => {
      alive = false;
    };
  }, [amount, label]);

  // Polling status.
  useEffect(() => {
    if (!intent) return;
    const t = setInterval(async () => {
      if (done.current) return;
      const j = await fetch(`/api/payment-intents/${intent.id}`).then((r) => r.json()).catch(() => null);
      if (!j?.ok) return;
      setSt({ status: j.status, paidVia: j.paidVia, online: j.online, master: j.master });
      if (j.status === "PAID" && !done.current) {
        done.current = true;
        setTimeout(() => onPaid(j.paidVia || "AUTO"), 1200); // tampilkan LUNAS sebentar
      } else if (j.status === "EXPIRED") {
        setErr("Tagihan kedaluwarsa (15 menit) — tutup lalu buat ulang.");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [intent, onPaid]);

  async function action(a: "manual" | "cancel") {
    if (intent) {
      await fetch(`/api/payment-intents/${intent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: a }),
      });
    }
    if (a === "manual") {
      done.current = true;
      onPaid("MANUAL");
    } else onClose();
  }

  const paid = st?.status === "PAID";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl text-center text-xs">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-800">Bayar QRIS</h3>
          <button onClick={() => action("cancel")} className="p-1 rounded hover:bg-slate-100" title="Batal">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <p className="text-3xl font-black text-[#7A5540] font-mono">{rupiah(intent?.amount ?? amount)}</p>
        {intent && intent.uniqueCode > 0 && (
          <p className="text-amber-700 font-semibold">
            Termasuk kode unik +{intent.uniqueCode} (ada tagihan lain dgn nominal sama)
          </p>
        )}
        {label && <p className="text-slate-500">{label}</p>}

        <div className="my-3 flex justify-center">
          {paid ? (
            <div className="w-[260px] h-[260px] rounded-2xl bg-emerald-50 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-600" />
              <p className="mt-2 font-bold text-emerald-700">PEMBAYARAN DITERIMA</p>
              <p className="text-emerald-600">{st?.paidVia === "MANUAL" ? "konfirmasi kasir" : `terdeteksi via ${st?.paidVia?.toLowerCase()}`}</p>
            </div>
          ) : err ? (
            <p className="p-6 text-rose-600 font-medium">{err}</p>
          ) : qrImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImg} alt="QRIS" className="w-[260px] h-[260px]" />
          ) : (
            <div className="w-[260px] h-[260px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        {!paid && !err && (
          <p className={`mb-3 ${st?.online ? "text-emerald-700" : "text-amber-700"}`}>
            {st?.online
              ? `⏳ Menunggu pembayaran… lunas otomatis (master: ${st.master?.name}).`
              : st?.master
                ? `⚠️ HP master (${st.master.name}) sedang offline — cek GoPay Merchant lalu konfirmasi manual.`
                : "⚠️ Belum ada HP master — cek GoPay Merchant lalu konfirmasi manual."}
          </p>
        )}

        {!paid && (
          <div className="flex gap-2">
            <button onClick={() => action("cancel")} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">
              Batal
            </button>
            <button
              onClick={() => action("manual")}
              disabled={!intent}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              ✓ Sudah dibayar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
