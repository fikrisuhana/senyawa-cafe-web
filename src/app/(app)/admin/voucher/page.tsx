import { prisma } from "@/lib/db";
import VoucherClient, { type VoucherRow } from "@/components/VoucherClient";
import { TicketPercent } from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function VoucherPage() {
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: "asc" } });
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
      <VoucherClient rows={rows} />
    </div>
  );
}
