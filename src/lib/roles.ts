/**
 * Role akun login (sejajar enum Role di Prisma). Modul MURNI (tanpa server-only
 * import) → aman dipakai middleware (edge), komponen client, maupun server.
 *
 * - ADMIN   : semua.
 * - KASIR   : jualan (kasir/rekap) + absen.
 * - BELANJA : staf belanja — cuma catat belanja (+ tambah stok) & absen DIRI
 *             SENDIRI (akun dicocokkan ke Karyawan lewat nama yang sama).
 */
export type Role = "ADMIN" | "KASIR" | "BELANJA";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  KASIR: "Kasir",
  BELANJA: "Staf Belanja",
};

/** Halaman awal setelah login per role. */
export function homeFor(role: string): string {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "BELANJA") return "/belanja";
  return "/kasir";
}

/**
 * Akses role BELANJA (allowlist — selain ini DITOLAK di middleware):
 * halaman /belanja & /absen, API catat/edit belanja & absen.
 */
export const BELANJA_PAGES = ["/belanja", "/absen"];
export const BELANJA_APIS: { path: string; methods: string[] }[] = [
  { path: "/api/purchases", methods: ["POST", "PUT"] },
  { path: "/api/attendance", methods: ["POST"] },
];

export function belanjaAllowed(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/")) {
    return BELANJA_APIS.some((a) => pathname === a.path && a.methods.includes(method));
  }
  return BELANJA_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
