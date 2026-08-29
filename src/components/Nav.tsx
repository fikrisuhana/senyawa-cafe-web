"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import {
  LayoutGrid,
  Receipt,
  BarChart3,
  Clock,
  Utensils,
  Ticket,
  Package,
  Wallet,
  CalendarCheck,
  Users,
  Settings,
  LogOut,
  Coffee,
  RotateCcw,
} from "lucide-react";

type LinkItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const kasirLinks: LinkItem[] = [
  { href: "/kasir", label: "Kasir", icon: Receipt },
  { href: "/rekap", label: "Rekap", icon: BarChart3 },
  { href: "/absen", label: "Absen", icon: Clock },
];

const adminMain: LinkItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/kasir", label: "Kasir", icon: Receipt },
  { href: "/rekap", label: "Rekap", icon: BarChart3 },
  { href: "/absen", label: "Absen", icon: Clock },
];

const adminManage: LinkItem[] = [
  { href: "/admin/menu", label: "Menu", icon: Utensils },
  { href: "/admin/stok", label: "Stok & Bahan", icon: Package },
  { href: "/admin/keuangan", label: "Keuangan", icon: Wallet },
  { href: "/admin/absensi", label: "Absensi", icon: CalendarCheck },
  { href: "/admin/voucher", label: "Voucher", icon: Ticket },
];

const adminSystem: LinkItem[] = [
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

const allLinks = [...adminMain, ...adminManage, ...adminSystem];

export default function Nav({
  user,
  storeName,
  logo,
  logoImage,
  children,
}: {
  user: SessionUser;
  storeName: string;
  logo: string;
  logoImage?: string;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";
  const main = isAdmin ? adminMain : kasirLinks;
  const [syncingSheet, setSyncingSheet] = useState(false);

  const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const currentLink = allLinks.find((l) => active(l.href)) || { label: "Dashboard" };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleManualSheetSync() {
    setSyncingSheet(true);
    try {
      const res = await fetch("/api/admin/sheet", { method: "POST" });
      if (res.ok) {
        alert("✓ Sinkronisasi ulang Google Sheet berhasil!");
        router.refresh();
      } else {
        const b = await res.json().catch(() => ({}));
        alert(`❌ Sync Sheet gagal: ${b.error || "Coba lagi"}`);
      }
    } catch (e) {
      alert("❌ Sync Sheet error: " + (e as Error).message);
    } finally {
      setSyncingSheet(false);
    }
  }

  const Brand = (
    <div className="flex items-center space-x-3 px-6">
      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold shrink-0 overflow-hidden">
        {logoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoImage} alt="logo" className="h-full w-full object-cover" />
        ) : (
          <Coffee className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0">
        <span className="font-bold text-slate-900 text-base tracking-tight leading-tight block truncate">
          {storeName}
        </span>
        <span className="text-[11px] text-slate-400 font-medium block">
          {isAdmin ? "POS & Management" : "Kasir Operasional"}
        </span>
      </div>
    </div>
  );

  const itemCls = (l: LinkItem) =>
    `w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
      active(l.href)
        ? "text-blue-600 bg-blue-50/80 font-semibold"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
    }`;

  const iconCls = (l: LinkItem) =>
    `w-4 h-4 shrink-0 ${active(l.href) ? "text-blue-600" : "text-slate-400"}`;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col lg:flex-row font-sans antialiased text-sm">
      {/* Desktop: Sidebar Kiri Tetap (ala app-monitoring) */}
      <aside className="no-print w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col shrink-0 min-h-screen sticky top-0 h-screen z-20">
        {/* Brand Header */}
        <div className="h-16 flex items-center border-b border-slate-100">{Brand}</div>

        {/* Nav Links */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {main.map((l) => (
            <Link key={l.href} href={l.href} className={itemCls(l)}>
              <l.icon className={iconCls(l)} />
              <span>{l.label}</span>
            </Link>
          ))}

          {isAdmin && (
            <>
              <p className="px-3.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Kelola
              </p>
              {adminManage.map((l) => (
                <Link key={l.href} href={l.href} className={itemCls(l)}>
                  <l.icon className={iconCls(l)} />
                  <span>{l.label}</span>
                </Link>
              ))}

              <p className="px-3.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Sistem
              </p>
              {adminSystem.map((l) => (
                <Link key={l.href} href={l.href} className={itemCls(l)}>
                  <l.icon className={iconCls(l)} />
                  <span>{l.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center space-x-3 px-1 py-1">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800 leading-tight">{user.name}</p>
              <p className="text-[11px] text-slate-400">{user.role === "ADMIN" ? "Administrator" : "Kasir"}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar + Scroll Horizontal Menu */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              {logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoImage} alt="logo" className="h-full w-full object-cover rounded-lg" />
              ) : (
                <Coffee className="w-3.5 h-3.5" />
              )}
            </div>
            <span className="font-bold text-slate-900 text-sm truncate">{storeName}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {user.name}
            </span>
            <button
              onClick={logout}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-none">
          {main.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                active(l.href) ? "bg-blue-50 border border-blue-500 text-blue-600 font-semibold" : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              <l.icon className="h-3 w-3" />
              <span>{l.label}</span>
            </Link>
          ))}
          {isAdmin &&
            [...adminManage, ...adminSystem].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  active(l.href) ? "bg-blue-50 border border-blue-500 text-blue-600 font-semibold" : "bg-white border border-slate-200 text-slate-600"
                }`}
              >
                <l.icon className="h-3 w-3" />
                <span>{l.label}</span>
              </Link>
            ))}
        </nav>
      </header>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Sticky Header */}
        <header className="no-print hidden lg:flex h-16 bg-white border-b border-slate-200 px-8 items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="font-bold text-slate-800 text-sm">{storeName}</span>
            <span>/</span>
            <span className="font-medium text-slate-800">{currentLink.label}</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Kasir Aktif: <strong className="text-slate-700 font-semibold">{user.name}</strong></span>
              <span>·</span>
              <span className="text-slate-400 capitalize">{user.role.toLowerCase()}</span>
            </span>

            {isAdmin && (
              <button
                onClick={handleManualSheetSync}
                disabled={syncingSheet}
                title="Sinkronkan Ulang Google Sheet"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${syncingSheet ? "animate-spin" : ""}`} />
                <span>{syncingSheet ? "Syncing..." : "Sync Sheet"}</span>
              </button>
            )}

            <button
              onClick={() => router.refresh()}
              title="Muat Ulang Halaman"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div
              className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm"
              title={`${user.name} (${user.role})`}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
