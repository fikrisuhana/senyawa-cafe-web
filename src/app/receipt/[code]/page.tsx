import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { rupiah, waktu } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const trx = await prisma.transaction.findUnique({
    where: { code },
    include: { items: true },
  });
  if (!trx) notFound();
  const s = await getSettings();
  const width = `${s.paperWidth || 58}mm`;

  return (
    <main className="flex flex-col items-center p-4">
      <div
        className="rounded-lg bg-white p-3 text-[12px] leading-tight shadow ring-1 ring-slate-200 print:shadow-none print:ring-0"
        style={{ width }}
      >
        <div className="text-center">
          {s.logoImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoImage} alt="logo" className="mx-auto mb-1 h-12 w-12 rounded object-cover" />
          )}
          <div className="text-sm font-bold">{s.storeName}</div>
          {s.receiptHeader && (
            <div className="whitespace-pre-line text-[11px] text-slate-500">
              {s.receiptHeader}
            </div>
          )}
        </div>
        <hr className="my-2 border-dashed" />
        {trx.status === "VOID" && (
          <div className="my-1 rounded bg-red-50 py-1 text-center text-xs font-bold text-red-600">
            ** DIBATALKAN **
          </div>
        )}
        <div className="text-[11px] text-slate-500">
          <div className="flex justify-between">
            <span>{trx.code}</span>
            <span>{waktu(trx.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir: {trx.cashierName}</span>
            <span>{trx.orderType === "TAKEAWAY" ? "🥡 Bungkus" : "🍽️ Di tempat"}</span>
          </div>
        </div>
        <hr className="my-2 border-dashed" />
        <div className="space-y-1">
          {trx.items.map((it) => (
            <div key={it.id}>
              <div className="flex justify-between">
                <span>{it.name}</span>
                <span>{rupiah(it.subtotal)}</span>
              </div>
              {it.variants && <div className="text-[11px] text-slate-500">• {it.variants}</div>}
              {it.note && <div className="text-[11px] italic text-slate-500">• {it.note}</div>}
              <div className="text-[11px] text-slate-500">
                {it.qty} × {rupiah(it.price)}
              </div>
            </div>
          ))}
        </div>
        <hr className="my-2 border-dashed" />
        <div className="space-y-0.5">
          {trx.discount > 0 && (
            <>
              <Row k="Subtotal" v={rupiah(trx.grossTotal || trx.total + trx.discount)} />
              <Row k={`Diskon${trx.voucherName ? ` (${trx.voucherName})` : ""}`} v={"−" + rupiah(trx.discount)} />
            </>
          )}
          <Row k="Total" v={rupiah(trx.total)} bold />
          <Row k={`Bayar (${trx.payment})`} v={rupiah(trx.paid)} />
          {trx.payment === "TUNAI" && <Row k="Kembali" v={rupiah(trx.change)} />}
        </div>
        {trx.note && <p className="mt-2 text-[11px] text-slate-500">Catatan: {trx.note}</p>}
        {s.receiptFooter && (
          <>
            <hr className="my-2 border-dashed" />
            <p className="whitespace-pre-line text-center text-[11px] text-slate-500">
              {s.receiptFooter}
            </p>
          </>
        )}
      </div>
      <PrintButton />
    </main>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
