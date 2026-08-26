"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => { if (!loading && !user) router.replace("/login/"); }, [loading, router, user]);
  if (loading || !user) return <main className="grid min-h-screen place-items-center"><LoaderCircle className="size-7 animate-spin text-[var(--blue)]" aria-label="Loading account" /></main>;
  const metadata = user.user_metadata;
  const name = metadata.full_name || metadata.name || user.email?.split("@")[0] || "Learner";
  return <AppShell user={{ name, email: user.email ?? "" }}>{children}</AppShell>;
}
