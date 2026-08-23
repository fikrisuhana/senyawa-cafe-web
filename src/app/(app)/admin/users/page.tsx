import { prisma } from "@/lib/db";
import UsersClient, { type UserRow } from "@/components/UsersClient";

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
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Kelola User</h1>
      <UsersClient rows={rows} />
    </div>
  );
}
