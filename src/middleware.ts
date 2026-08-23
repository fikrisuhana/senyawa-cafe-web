import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

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

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;

  if (PUBLIC.includes(pathname)) {
    if (user) return NextResponse.redirect(new URL("/kasir", req.url));
    return NextResponse.next();
  }

  if (!user) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // Halaman & API admin hanya untuk ADMIN.
  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    user.role !== "ADMIN"
  ) {
    if (pathname.startsWith("/api/"))
      return NextResponse.json({ error: "Khusus admin" }, { status: 403 });
    return NextResponse.redirect(new URL("/kasir", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
