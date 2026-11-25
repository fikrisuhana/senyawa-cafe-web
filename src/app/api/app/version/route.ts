import { NextResponse } from "next/server";
import { latestRelease, publicInfo } from "@/lib/app-release";

export const dynamic = "force-dynamic";

/** PUBLIK: versi APK terbaru yang diterbitkan admin (dipakai HP untuk cek update). */
export async function GET() {
  const r = await latestRelease();
  return NextResponse.json({ ok: true, latest: r ? publicInfo(r) : null }, { headers: { "Cache-Control": "no-store" } });
}
