import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const current = await requireSession();
  return <AppShell user={{ name: current.user.name, username: current.user.username, role: current.user.role }}>{children}</AppShell>;
}
