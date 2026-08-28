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
  if (loading || !user) return <main className="loading-screen min-h-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading account" /></main>;
  const metadata = user.user_metadata;
  const name = metadata.full_name || metadata.name || user.email?.split("@")[0] || "Learner";
  const avatarUrl = metadata.avatar_url || metadata.picture || null;
  return <AppShell user={{ name, email: user.email ?? "", avatarUrl }}>{children}</AppShell>;
}
