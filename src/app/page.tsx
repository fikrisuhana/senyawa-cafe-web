import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const user = await getSession();
  if (!user) redirect("/login");
  redirect(homeFor(user.role));
}
