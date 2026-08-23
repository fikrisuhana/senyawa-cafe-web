import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <Nav
        user={user}
        storeName={settings.storeName}
        logo={settings.logoEmoji}
        logoImage={settings.logoImage}
      />
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
