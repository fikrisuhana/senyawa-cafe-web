import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";

/**
 * Backup database (pg_dump → gzip) sebagai stream. Butuh postgresql16-client di image.
 * URL Prisma membawa "?schema=public" yang tak dikenal pg_dump → dibuang.
 */
export function pgDumpStream(): ReadableStream {
  const url = (process.env.DATABASE_URL || "").split("?")[0];
  if (!url) throw new Error("DATABASE_URL kosong");
  const p = spawn("pg_dump", ["--no-owner", "--no-privileges", `--dbname=${url}`], { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => (err += String(d)));
  const gz = createGzip();
  p.stdout.pipe(gz);
  p.on("close", (code) => {
    if (code !== 0) gz.destroy(new Error(`pg_dump gagal (${code}): ${err.slice(0, 200)}`));
  });
  return Readable.toWeb(gz) as ReadableStream;
}
