import { prisma } from "@/lib/db";
import { expireOldIntents, MASTER_ONLINE_MS } from "@/lib/gopay";
import PerangkatClient, { type DeviceRow, type PaymentRow, type IntentRow } from "@/components/PerangkatClient";
import { Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Perangkat & deteksi pembayaran GoPay (tanpa payment gateway): pilih HP MASTER
 * (yang login GoPay Merchant) — dia membaca notif/riwayat GoPay & melapor ke
 * server; server mencocokkan ke tagihan QR kasir.
 */
export default async function PerangkatPage() {
  await expireOldIntents();
  const [devices, payments, intents] = await Promise.all([
    prisma.device.findMany({ orderBy: [{ isMaster: "desc" }, { lastSeenAt: "desc" }] }),
    prisma.gopayPayment.findMany({ orderBy: { paidAt: "desc" }, take: 30 }),
    prisma.paymentIntent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const now = Date.now();
  const intentLabel = new Map(intents.map((i) => [i.id, i.label || "(tanpa nama)"]));

  const deviceRows: DeviceRow[] = devices.map((d) => ({
    id: d.id,
    name: d.name,
    userName: d.userName,
    appVersion: d.appVersion,
    notifAccess: d.notifAccess,
    historyAccess: d.historyAccess,
    hasGopay: d.hasGopay,
    isMaster: d.isMaster,
    enabled: d.enabled,
    lastSeenAt: d.lastSeenAt.toISOString(),
    online: now - d.lastSeenAt.getTime() < MASTER_ONLINE_MS,
  }));
  const paymentRows: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    ref: p.ref,
    hasNotif: p.hasNotif,
    hasHistory: p.hasHistory,
    matched: p.intentId ? intentLabel.get(p.intentId) || "tagihan lama" : null,
  }));
  const intentRows: IntentRow[] = intents.map((i) => ({
    id: i.id,
    label: i.label,
    amount: i.amount,
    uniqueCode: i.uniqueCode,
    status: i.status,
    paidVia: i.paidVia,
    source: i.source,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Smartphone className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Perangkat &amp; Deteksi Pembayaran GoPay</h2>
          <p className="text-xs text-slate-500">
            Pilih <b>HP master</b> (yang login GoPay Merchant). Master membaca notifikasi &amp; riwayat GoPay lalu
            melapor ke server — tagihan QRIS di kasir otomatis LUNAS saat pembayaran cocok.
          </p>
        </div>
      </div>
      <PerangkatClient devices={deviceRows} payments={paymentRows} intents={intentRows} />
    </div>
  );
}
