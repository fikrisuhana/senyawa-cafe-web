import { timingSafeEqual } from "crypto";

/**
 * Kunci integrasi antar-aplikasi (mis. aplikasi JADWAL karyawan) — env
 * INTEGRATION_KEY. Kosong = integrasi MATI. Dibandingkan constant-time.
 * Header: `X-Integration-Key: <kunci>`.
 */
export function integrationAuth(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const key = process.env.INTEGRATION_KEY || "";
  if (key.length < 16) return { ok: false, status: 503, error: "Integrasi belum diaktifkan (INTEGRATION_KEY)" };
  const got = req.headers.get("x-integration-key") || "";
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: "Kunci integrasi salah" };
  return { ok: true };
}
