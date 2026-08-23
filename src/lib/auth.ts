import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "poscafe_session";
const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-ubah-di-produksi");

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "KASIR";
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Server dev diakses via http polos (tanpa TLS) → JANGAN paksa secure,
    // kalau tidak cookie dibuang browser & login mental. Set COOKIE_SECURE=1
    // hanya kalau sudah di belakang HTTPS.
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    // 1 tahun — akun kasir bersama tidak sering ke-logout.
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      username: payload.username as string,
      name: payload.name as string,
      role: payload.role as "ADMIN" | "KASIR",
    };
  } catch {
    return null;
  }
}

/** Verifikasi token dari string (dipakai di middleware, tanpa akses cookies()). */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      username: payload.username as string,
      name: payload.name as string,
      role: payload.role as "ADMIN" | "KASIR",
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
