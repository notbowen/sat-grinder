"use client";

import { AppShell } from "@/components/app-shell";
import { AuthLoading, shellUser, useRequireAuth } from "@/components/require-auth";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useRequireAuth();
  if (!ready || !user) return <AuthLoading />;
  return <AppShell user={shellUser(user)}>{children}</AppShell>;
}
