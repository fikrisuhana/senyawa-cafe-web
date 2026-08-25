"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";

type LinkItem = { href: string; label: string; icon: string };

const kasirLinks: LinkItem[] = [
  { href: "/kasir", label: "Kasir", icon: "🧾" },
  { href: "/rekap", label: "Rekap", icon: "📊" },
  { href: "/absen", label: "Absen", icon: "⏱️" },
];

// Admin: link utama di depan, sisanya masuk dropdown "Kelola".
const adminPrimary: LinkItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📈" },
  { href: "/kasir", label: "Kasir", icon: "🧾" },
  { href: "/rekap", label: "Rekap", icon: "📊" },
];
const adminMore: LinkItem[] = [
  { href: "/admin/menu", label: "Menu", icon: "🍽️" },
  { href: "/admin/voucher", label: "Voucher", icon: "🎟️" },
  { href: "/admin/stok", label: "Stok", icon: "📦" },
  { href: "/admin/keuangan", label: "Keuangan", icon: "💰" },
  { href: "/admin/absensi", label: "Absensi", icon: "🗓️" },
  { href: "/admin/users", label: "User", icon: "👥" },
  { href: "/admin/pengaturan", label: "Setelan", icon: "⚙️" },
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
  const [openMore, setOpenMore] = useState(false);
  const isAdmin = user.role === "ADMIN";
  const primary = isAdmin ? adminPrimary : kasirLinks;
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = adminMore.some((l) => active(l.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2 font-bold">
          {logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoImage} alt="logo" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="text-xl">{logo || "☕"}</span>
          )}
          <span className="hidden sm:inline">{storeName}</span>
        </div>

        <nav className="flex flex-1 items-center gap-1">
          {primary.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                active(l.href) ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="mr-1">{l.icon}</span>
              {l.label}
            </Link>
          ))}

          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setOpenMore((v) => !v)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  moreActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                🛠️ Kelola ▾
              </button>
              {openMore && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMore(false)} />
                  <div className="absolute left-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {adminMore.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setOpenMore(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm ${
                          active(l.href)
                            ? "bg-brand-50 font-medium text-brand-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{l.icon}</span>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold leading-tight">{user.name}</div>
            <div className="text-[11px] text-slate-500">{user.role}</div>
          </div>
          <button onClick={logout} className="btn-ghost !px-2 !py-1 text-xs">
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}
