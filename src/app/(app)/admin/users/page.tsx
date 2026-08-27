import { prisma } from "@/lib/db";
import UsersClient, { type UserRow } from "@/components/UsersClient";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
  }));
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Manajemen User &amp; Hak Akses Tim</h2>
          <p className="text-xs text-slate-500">Kelola akun kasir dan administrator untuk otentikasi sistem POS</p>
        </div>
      </div>
      <UsersClient rows={rows} />
    </div>
  );
}
