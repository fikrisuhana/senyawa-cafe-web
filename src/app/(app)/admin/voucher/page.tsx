import { prisma } from "@/lib/db";
import VoucherClient, { type VoucherRow } from "@/components/VoucherClient";

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
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Voucher / Diskon</h1>
      <p className="text-xs text-slate-500">
        Voucher bisa dipilih kasir saat bayar. Atur <b>kuota</b> (maks berapa kali) &amp;
        <b> periode</b> (kosongkan = tak terbatas). Voucher ditolak otomatis kalau kuota habis
        atau di luar periode.
      </p>
      <VoucherClient rows={rows} />
    </div>
  );
}
