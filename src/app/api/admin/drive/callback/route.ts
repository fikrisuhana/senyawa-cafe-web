import { NextResponse } from "next/server";
import { exchangeDriveCode } from "@/lib/gsheet";

// Callback OAuth Google ("Hubungkan Google Drive") → tukar code jadi refresh
// token, simpan, balikin user ke halaman Pengaturan. Aman via state sekali-pakai.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const base = (process.env.APP_BASE_URL || "https://ruangsenyawa.iprime.web.id").replace(/\/$/, "");
  const err = u.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(`${base}/admin/pengaturan?drive=err&msg=${encodeURIComponent(err)}`);
  }
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state") || "";
  if (!code) return NextResponse.redirect(`${base}/admin/pengaturan?drive=err`);
  try {
    const email = await exchangeDriveCode(code, state);
    return NextResponse.redirect(
      `${base}/admin/pengaturan?drive=ok&email=${encodeURIComponent(email)}`,
    );
  } catch (e) {
    return NextResponse.redirect(
      `${base}/admin/pengaturan?drive=err&msg=${encodeURIComponent((e as Error).message)}`,
    );
  }
}
