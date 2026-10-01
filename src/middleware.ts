import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";
import { homeFor, belanjaAllowed } from "@/lib/roles";

const PUBLIC = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Aset & API auth dilewati (API lain cek sendiri).
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  // Auth dari cookie (web) ATAU header Authorization: Bearer <token> (aplikasi HP).
  const cookieTok = req.cookies.get(SESSION_COOKIE)?.value;
  const authz = req.headers.get("authorization") || "";
  const bearerTok = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
  const token = bearerTok || cookieTok;
  const user = token ? await verifyToken(token) : null;

  const isApi = pathname.startsWith("/api/");

  if (PUBLIC.includes(pathname)) {
    if (user) return NextResponse.redirect(new URL(homeFor(user.role), req.url));
    return NextResponse.next();
  }

  if (!user) {
    // API → 401 JSON (jangan redirect HTML ke /login, biar HP terbaca bener).
    if (isApi) return NextResponse.json({ error: "Belum login" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Staf BELANJA: allowlist ketat (catat belanja + absen). Selain itu ditolak —
  // termasuk kasir/rekap/transaksi/katalog, jadi akun ini gak bisa jualan.
  if (user.role === "BELANJA" && !belanjaAllowed(pathname, req.method)) {
    if (isApi) return NextResponse.json({ error: "Akun staf belanja tidak punya akses" }, { status: 403 });
    return NextResponse.redirect(new URL("/belanja", req.url));
  }

  // Halaman & API admin hanya untuk ADMIN.
  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    user.role !== "ADMIN"
  ) {
    if (isApi)
      return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
    return NextResponse.redirect(new URL(homeFor(user.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
