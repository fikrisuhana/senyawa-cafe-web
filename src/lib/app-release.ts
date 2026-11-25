import path from "node:path";
import { prisma } from "./db";

/** Folder APK (volume docker `apkdata`, lihat docker-compose). */
export const APK_DIR = process.env.APK_DIR || "/app/data/apk";
/** Simpan N rilis terakhir saja (file APK besar). */
export const KEEP_RELEASES = 3;

export const apkPath = (fileName: string) => path.join(APK_DIR, path.basename(fileName));

export async function latestRelease() {
  return prisma.appRelease.findFirst({ orderBy: { versionCode: "desc" } });
}

export function publicInfo(r: { versionCode: number; versionName: string; notes: string; size: number; sha256: string; createdAt: Date }) {
  return {
    versionCode: r.versionCode,
    versionName: r.versionName,
    notes: r.notes,
    size: r.size,
    sha256: r.sha256,
    publishedAt: r.createdAt.toISOString(),
    url: `/api/app/download/${r.versionCode}`,
  };
}
