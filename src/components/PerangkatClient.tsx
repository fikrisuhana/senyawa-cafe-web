"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Power, Trash2, Bell, ScanSearch, Wallet, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { rupiah } from "@/lib/format";

export type DeviceRow = {
  id: string;
  name: string;
  userName: string | null;
  appVersion: string | null;
  notifAccess: boolean;
  historyAccess: boolean;
  hasGopay: boolean;
  isMaster: boolean;
  enabled: boolean;
  lastSeenAt: string;
  online: boolean;
};
export type PaymentRow = {
  id: string;
  amount: number;
  paidAt: string;
  ref: string | null;
  hasNotif: boolean;
  hasHistory: boolean;
  matched: string | null;
};
export type IntentRow = {
  id: string;
  label: string | null;
  amount: number;
  uniqueCode: number;
  status: string;
  paidVia: string | null;
  source: string;
  createdAt: string;
};

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  return `${Math.round(s / 86400)} hari lalu`;
}
const jam = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Flag({ on, label, icon: Icon }: { on: boolean; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

const STATUS_CLS: Record<string, string> = {
  PAID: "pill-green",
  PENDING: "pill-amber",
  CANCELLED: "pill-slate",
  EXPIRED: "pill-slate",
};

export default function PerangkatClient({ devices, payments, intents }: { devices: DeviceRow[]; payments: PaymentRow[]; intents: IntentRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  // Pantau terus (master online/offline, pembayaran baru) tanpa reload manual.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);

  async function put(id: string, data: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch("/api/admin/devices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    setBusy("");
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Gagal menyimpan");
    router.refresh();
  }

  async function del(d: DeviceRow) {
    if (!confirm(`Hapus perangkat "${d.name}" dari daftar? (Akan muncul lagi kalau aplikasinya masih login.)`)) return;
    await fetch(`/api/admin/devices?id=${d.id}`, { method: "DELETE" });
    router.refresh();
  }

  const master = devices.find((d) => d.isMaster && d.enabled);

  return (
    <div className="space-y-6 text-xs">
      {/* Ringkasan status master */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${master?.online ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/50"}`}>
        <Crown className={`w-5 h-5 ${master?.online ? "text-emerald-600" : "text-amber-600"}`} />
        <div className="flex-1">
          {master ? (
            <>
              <p className="font-bold text-slate-800">
                Master: {master.name} {master.online ? "· 🟢 online" : "· 🔴 offline"}
              </p>
              <p className="text-slate-500">
                Terakhir lapor {ago(master.lastSeenAt)}.{" "}
                {!master.notifAccess && !master.historyAccess
                  ? "⚠️ Izin baca notifikasi & riwayat GoPay belum aktif di HP ini."
                  : !master.hasGopay
                    ? "⚠️ GoPay Merchant tidak terdeteksi di HP ini."
                    : "Deteksi pembayaran otomatis aktif."}
              </p>
            </>
          ) : (
            <p className="font-bold text-amber-800">Belum ada HP master — kasir tetap bisa konfirmasi manual. Pilih master di daftar bawah.</p>
          )}
        </div>
        <button onClick={() => router.refresh()} className="p-2 rounded-lg hover:bg-white" title="Muat ulang">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Daftar perangkat */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Perangkat yang login ({devices.length})</div>
        <div className="divide-y divide-slate-100">
          {devices.map((d) => (
            <div key={d.id} className={`p-4 flex flex-wrap items-center gap-3 ${!d.enabled ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-[220px]">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  {d.isMaster && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                  {d.name}
                  <span className={`w-2 h-2 rounded-full ${d.online ? "bg-emerald-500" : "bg-slate-300"}`} />
                </p>
                <p className="text-slate-500">
                  {d.userName ? `akun ${d.userName} · ` : ""}
                  {d.appVersion ? `v${d.appVersion} · ` : ""}terakhir aktif {ago(d.lastSeenAt)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Flag on={d.hasGopay} label="GoPay Merchant" icon={Wallet} />
                  <Flag on={d.notifAccess} label="Baca notif" icon={Bell} />
                  <Flag on={d.historyAccess} label="Baca riwayat" icon={ScanSearch} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {d.isMaster ? (
                  <button disabled={busy === d.id} onClick={() => put(d.id, { isMaster: false })} className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200">
                    👑 Master — copot
                  </button>
                ) : (
                  <button disabled={busy === d.id || !d.enabled} onClick={() => put(d.id, { isMaster: true })} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-40">
                    Jadikan master
                  </button>
                )}
                <button disabled={busy === d.id} onClick={() => put(d.id, { enabled: !d.enabled, ...(d.enabled ? { isMaster: false } : {}) })} className="p-2 rounded-lg hover:bg-slate-100" title={d.enabled ? "Nonaktifkan" : "Aktifkan"}>
                  <Power className={`w-4 h-4 ${d.enabled ? "text-emerald-600" : "text-slate-400"}`} />
                </button>
                <button onClick={() => del(d)} className="p-2 rounded-lg hover:bg-rose-50" title="Hapus dari daftar">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <p className="p-6 text-center text-slate-400">Belum ada perangkat. Login aplikasi kasir di HP/tablet — otomatis muncul di sini.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pembayaran GoPay masuk */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Pembayaran GoPay masuk (dari master)</div>
          <div className="divide-y divide-slate-100">
            {payments.map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-bold text-slate-800">{rupiah(p.amount)}</p>
                  <p className="text-slate-500">
                    {jam(p.paidAt)} {p.ref ? `· ref ${p.ref}` : ""} · {[p.hasNotif && "notif", p.hasHistory && "riwayat"].filter(Boolean).join(" + ")}
                  </p>
                </div>
                {p.matched ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{p.matched}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400"><XCircle className="w-3.5 h-3.5" />belum cocok</span>
                )}
              </div>
            ))}
            {payments.length === 0 && <p className="p-6 text-center text-slate-400">Belum ada laporan pembayaran.</p>}
          </div>
        </div>

        {/* Tagihan QR */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">Tagihan QRIS terbaru</div>
          <div className="divide-y divide-slate-100">
            {intents.map((i) => (
              <div key={i.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{i.label || "(tanpa nama)"} <span className="text-slate-400 font-normal">· {i.source}</span></p>
                  <p className="text-slate-500">
                    {jam(i.createdAt)} · <span className="font-mono">{rupiah(i.amount)}</span>
                    {i.uniqueCode > 0 && <span className="text-amber-600"> (kode unik +{i.uniqueCode})</span>}
                  </p>
                </div>
                <span className={`${STATUS_CLS[i.status] || "pill-slate"} text-[10px]`}>
                  {i.status}{i.paidVia ? ` · ${i.paidVia}` : ""}
                </span>
              </div>
            ))}
            {intents.length === 0 && <p className="p-6 text-center text-slate-400">Belum ada tagihan QRIS.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
