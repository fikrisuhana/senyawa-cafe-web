import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

// Rate limit sederhana per (IP+username) — tahan brute force di deploy publik.
// In-memory per instance; cukup untuk 1 container. Untuk skala besar pakai Redis.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW = 5 * 60 * 1000; // 5 menit
const MAX_TRY = 10;

function tooMany(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_TRY;
}
function resetTry(key: string) {
  attempts.delete(key);
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => ({}));
  const username = String(raw.username || "").trim().toLowerCase();
  const password = String(raw.password || "");
  if (!username || !password)
    return NextResponse.json({ error: "Isi username & password" }, { status: 400 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const key = `${ip}:${username}`;
  if (tooMany(key))
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi beberapa menit." },
      { status: 429 }
    );

  const GENERIC = "Username atau password salah";
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active)
    return NextResponse.json({ error: GENERIC }, { status: 401 });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.json({ error: GENERIC }, { status: 401 });

  resetTry(key);
  await createSession({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  return NextResponse.json({ ok: true, role: user.role });
}
