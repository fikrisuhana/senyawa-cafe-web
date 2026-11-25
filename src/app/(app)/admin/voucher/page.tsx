import { prisma } from "@/lib/db";
import VoucherClient, { type VoucherRow } from "@/components/VoucherClient";
import { TicketPercent } from "lucide-react";
import { voucherManaged } from "@/lib/menu-sync";

export const dynamic = "force-dynamic";

function ymd(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function VoucherPage() {
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: "asc" } });
  const locked = await voucherManaged();
  const rows: VoucherRow[] = vouchers.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type as "PERCENT" | "NOMINAL",
    value: v.value,
    active: v.active,
    maxUses: v.maxUses,
    usedCount: v.usedCount,
    validFrom: ymd(v.validFrom),
    validUntil: ymd(v.validUntil),
  }));
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <TicketPercent className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Manajemen Voucher &amp; Kupon Diskon</h2>
          <p className="text-xs text-slate-500">
            Kelola promosi diskon persen / nominal rupiah, kuota pemakaian, dan masa berlaku voucher
          </p>
        </div>
      </div>
      {locked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
          <b>Voucher diatur dari pusat (timetable.iprime.web.id → Voucher).</b> Di sini cuma bisa dilihat; kasir tetap bisa memakai voucher saat transaksi.
        </div>
      )}
      <div className={locked ? "pointer-events-none select-none opacity-70" : ""}>
        <VoucherClient rows={rows} />
      </div>
    </div>
  );
}
