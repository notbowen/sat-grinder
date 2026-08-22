import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(options: { allowPasswordChange?: boolean; admin?: boolean } = {}) {
  const current = await getCurrentSession();
  if (!current) redirect("/login");
  const currentUser = current.user as typeof current.user & { mustChangePassword?: boolean; role?: string; username?: string };
  if (currentUser.mustChangePassword && !options.allowPasswordChange) redirect("/account/change-password");
  if (options.admin && currentUser.role !== "admin") redirect("/dashboard");
  return { ...current, user: currentUser };
}

