import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { apkPath } from "@/lib/app-release";

export const dynamic = "force-dynamic";

/** PUBLIK: unduh APK versi tertentu (stream dari disk, tidak dimuat ke memori). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = Number((await params).code);
  if (!Number.isInteger(code)) return new Response("versi tidak valid", { status: 400 });
  const r = await prisma.appRelease.findUnique({ where: { versionCode: code } });
  if (!r) return new Response("tidak ditemukan", { status: 404 });
  const file = apkPath(r.fileName);
  const st = await stat(file).catch(() => null);
  if (!st) return new Response("file APK hilang di server", { status: 410 });
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(st.size),
      "Content-Disposition": `attachment; filename="${r.fileName}"`,
      "Cache-Control": "no-store",
      "X-Sha256": r.sha256,
    },
  });
}
