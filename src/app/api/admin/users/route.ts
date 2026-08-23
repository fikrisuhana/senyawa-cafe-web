import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.username || !b.name || !b.password)
    return NextResponse.json({ error: "Lengkapi username, nama, password" }, { status: 400 });
  try {
    const u = await prisma.user.create({
      data: {
        username: String(b.username).trim().toLowerCase(),
        name: String(b.name).trim(),
        role: b.role === "ADMIN" ? "ADMIN" : "KASIR",
        password: await bcrypt.hash(String(b.password), 10),
      },
    });
    return NextResponse.json({ ok: true, id: u.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.code === "P2002" ? "Username sudah dipakai" : "Gagal membuat user" },
      { status: 400 }
    );
  }
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const data: any = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (b.role === "ADMIN" || b.role === "KASIR") data.role = b.role;
  if (typeof b.active === "boolean") data.active = b.active;
  if (b.password) data.password = await bcrypt.hash(String(b.password), 10);
  await prisma.user.update({ where: { id: b.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getSession();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  if (me?.id === id)
    return NextResponse.json({ error: "Tidak bisa menghapus diri sendiri" }, { status: 400 });

  const count = await prisma.transaction.count({ where: { cashierId: id } });
  if (count > 0)
    return NextResponse.json(
      { error: "User punya transaksi — nonaktifkan saja, jangan dihapus" },
      { status: 400 }
    );
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
