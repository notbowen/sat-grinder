"use client";

import { AuthLoading, useRequireAuth } from "@/components/require-auth";

// Signed-in pages without the app shell: the set screen carries its own bar.
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth();
  if (!ready) return <AuthLoading />;
  return <>{children}</>;
}
