"use client";

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
  { href: "/admin/pengaturan", label: "Setelan", icon: Settings },
];

export default function Nav({
  user,
  storeName,
  logo,
  logoImage,
}: {
  user: SessionUser;
  storeName: string;
  logo: string;
  logoImage?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";
  const main = isAdmin ? adminMain : kasirLinks;
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const Brand = (
    <div className="flex items-center gap-3 px-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-600 text-white shadow-sm">
        {logoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoImage} alt="logo" className="h-full w-full object-cover" />
        ) : (
          <Coffee className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900">
          {storeName}
        </span>
        <span className="block text-[11px] font-medium text-slate-400">
          {isAdmin ? "Admin Console" : "Kasir"}
        </span>
      </div>
    </div>
  );

  const itemCls = (l: LinkItem) =>
    `flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
      active(l.href)
        ? "bg-brand-50 text-brand-600"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  const iconCls = (l: LinkItem) => `h-4 w-4 shrink-0 ${active(l.href) ? "text-brand-600" : "text-slate-400"}`;

  const sidebarLinks = (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
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
      <div className="border-t border-slate-100 p-4">
        <div className="mb-2 flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-800">{user.name}</p>
            <p className="text-[11px] text-slate-400">{user.role === "ADMIN" ? "Administrator" : "Kasir"}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          <span>Keluar</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: sidebar kiri tetap */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100">{Brand}</div>
        {sidebarLinks}
      </aside>

      {/* Mobile: top bar + menu scroll horizontal */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center border-b border-slate-100">{Brand}</div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2">
          {main.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                active(l.href) ? "bg-brand-50 text-brand-600" : "text-slate-600"
              }`}
            >
              <l.icon className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          ))}
          {isAdmin &&
            [...adminManage, ...adminSystem].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active(l.href) ? "bg-brand-50 text-brand-600" : "text-slate-600"
                }`}
              >
                <l.icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            ))}
          <button
            onClick={logout}
            className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-rose-500"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </nav>
      </header>
    </>
  );
}
