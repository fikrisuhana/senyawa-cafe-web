import { NextResponse } from "next/server";
import { setSettings } from "@/lib/settings";

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
  "kasAwal",
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
  await setSettings(patch as any);
  return NextResponse.json({ ok: true });
}
