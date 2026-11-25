import { prisma } from "@/lib/db";
import { publicInfo } from "@/lib/app-release";
import AplikasiClient from "@/components/AplikasiClient";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

/** Terbitkan APK aplikasi HP → semua HP kasir dapat tawaran update dari web. */
export default async function AplikasiPage() {
  const [rows, devices] = await Promise.all([
    prisma.appRelease.findMany({ orderBy: { versionCode: "desc" } }),
    prisma.device.findMany({ orderBy: { lastSeenAt: "desc" }, select: { id: true, name: true, appVersion: true, lastSeenAt: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Download className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Aplikasi HP</h2>
          <p className="text-xs text-slate-500">
            Upload APK versi baru di sini — aplikasi kasir di HP/tablet otomatis menawarkan update (tanpa kabel).
          </p>
        </div>
      </div>
      <AplikasiClient
        releases={rows.map((r) => ({ id: r.id, createdBy: r.createdBy, ...publicInfo(r) }))}
        devices={devices.map((d) => ({ id: d.id, name: d.name, appVersion: d.appVersion, lastSeenAt: d.lastSeenAt.toISOString() }))}
      />
    </div>
  );
}
