import { getSettings } from "@/lib/settings";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const s = await getSettings();
  return (
    <LoginForm storeName={s.storeName} logoEmoji={s.logoEmoji} logoImage={s.logoImage} />
  );
}
