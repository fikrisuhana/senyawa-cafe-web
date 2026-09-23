import { NextResponse } from "next/server";
import { setSettings, parsePaymentMethods } from "@/lib/settings";

const ALLOWED = [
  "storeName",
  "logoEmoji",
  "logoImage",
  "openHour",
  "closeHour",
  "dayCutoffHour",
  "receiptHeader",
  "receiptFooter",
  "quickCash",
  "paperWidth",
  "shifts",
  "shiftHours", // BUG FIX: dulu kelewat → rentang jam shift gak pernah kesimpen
  "kasAwal",
  "paymentMethods", // metode bayar yang tampil di kasir (WAJIB di sini, lihat bug shiftHours)
] as const;

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, string> = {};
  for (const k of ALLOWED) {
    if (b[k] === undefined) continue;
    const val = String(b[k]);
    // Batas ukuran: logo (data URL) ≤ 800KB, teks lain ≤ 5KB.
    const limit = k === "logoImage" ? 800_000 : 5_000;
    if (val.length > limit)
      return NextResponse.json(
        { error: `Nilai ${k} terlalu besar` },
        { status: 413 }
      );
    patch[k] = val;
  }
  if (patch.paymentMethods !== undefined) {
    // Minimal 1 metode biasa aktif — SPLIT sendiri gak bisa dipakai bayar.
    const list = parsePaymentMethods(patch.paymentMethods);
    if (!list.some((m) => m !== "SPLIT"))
      return NextResponse.json({ error: "Aktifkan minimal 1 metode bayar (Tunai/QRIS/Transfer)" }, { status: 400 });
    patch.paymentMethods = list.join(",");
  }
  await setSettings(patch as any);
  return NextResponse.json({ ok: true });
}
