import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { APK_DIR, KEEP_RELEASES, apkPath, publicInfo } from "@/lib/app-release";

export const dynamic = "force-dynamic";

// ADMIN (middleware /api/admin): daftar rilis APK.
export async function GET() {
  const rows = await prisma.appRelease.findMany({ orderBy: { versionCode: "desc" } });
  return NextResponse.json({ ok: true, releases: rows.map((r) => ({ id: r.id, createdBy: r.createdBy, ...publicInfo(r) })) });
}

/**
 * Terbitkan APK (multipart: file, versionCode, versionName, notes). versionCode WAJIB
 * sama dengan angka build di APK (pubspec "x.y.z+CODE") — kalau lebih besar, HP akan
 * terus menawari update. Rilis lama dipangkas, sisa KEEP_RELEASES terbaru.
 */
export async function POST(req: Request) {
  const me = await getAuthFromRequest(req);
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Form tidak valid" }, { status: 400 });
  const file = form.get("file");
  const versionCode = Number(form.get("versionCode"));
  const versionName = String(form.get("versionName") || "").trim().slice(0, 40);
  const notes = String(form.get("notes") || "").trim().slice(0, 2000);
  if (!(file instanceof File) || file.size < 1024) return NextResponse.json({ error: "File APK wajib" }, { status: 400 });
  if (!Number.isInteger(versionCode) || versionCode < 1) return NextResponse.json({ error: "Kode versi (angka) wajib" }, { status: 400 });
  if (!/^\d+(\.\d+){0,3}$/.test(versionName)) return NextResponse.json({ error: "Nama versi mis. 1.1.0" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  // APK = ZIP → harus diawali "PK\x03\x04".
  if (buf.readUInt32LE(0) !== 0x04034b50) return NextResponse.json({ error: "Bukan file APK" }, { status: 400 });
  const latest = await prisma.appRelease.findFirst({ orderBy: { versionCode: "desc" } });
  if (latest && versionCode < latest.versionCode)
    return NextResponse.json({ error: `Kode versi harus ≥ ${latest.versionCode} (rilis terakhir)` }, { status: 400 });

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const fileName = `senyawa-kaligondang-${versionName}-${versionCode}.apk`;
  await mkdir(APK_DIR, { recursive: true });
  const tmp = apkPath(fileName) + ".tmp";
  await writeFile(tmp, buf);
  await rename(tmp, apkPath(fileName));

  const r = await prisma.appRelease.upsert({
    where: { versionCode },
    create: { versionCode, versionName, notes, size: buf.length, sha256, fileName, createdBy: me?.name || null },
    update: { versionName, notes, size: buf.length, sha256, fileName, createdBy: me?.name || null, createdAt: new Date() },
  });

  const old = await prisma.appRelease.findMany({ orderBy: { versionCode: "desc" }, skip: KEEP_RELEASES });
  for (const o of old) {
    await unlink(apkPath(o.fileName)).catch(() => {});
    await prisma.appRelease.delete({ where: { id: o.id } });
  }
  return NextResponse.json({ ok: true, release: publicInfo(r) });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const r = await prisma.appRelease.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "tidak ditemukan" }, { status: 404 });
  await unlink(apkPath(r.fileName)).catch(() => {});
  await prisma.appRelease.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
