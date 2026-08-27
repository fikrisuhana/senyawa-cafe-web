import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });
import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  // Tahan error: saat build/prerender DB belum tentu ada → pakai default.
  let storeName = "POS Cafe";
  let icon = "/icon.svg";
  try {
    const s = await getSettings();
    storeName = s.storeName || storeName;
    icon = s.logoImage || icon;
  } catch {}
  return {
    title: storeName,
    description: "Kasir & keuangan cafe",
    manifest: "/manifest.webmanifest",
    icons: { icon },
  };
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${jbmono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
