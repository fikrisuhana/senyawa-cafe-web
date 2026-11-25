import { NextResponse } from "next/server";
import { integrationAuth } from "@/lib/integration";
import { pgDumpStream } from "@/lib/pgdump";

export const dynamic = "force-dynamic";

/** Backup database outlet ini (pg_dump .sql.gz) untuk aplikasi pusat → Telegram. X-Integration-Key. */
export async function GET(req: Request) {
  const auth = integrationAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return new Response(pgDumpStream(), { headers: { "Content-Type": "application/gzip", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
