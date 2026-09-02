"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth-provider";

/** Sends signed-out visitors to /login and reports whether the page may render. */
export function useRequireAuth() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => { if (!loading && !user) router.replace("/login/"); }, [loading, router, user]);
  return { user: loading ? null : user, ready: !loading && Boolean(user) };
}

/** Name, email and avatar for the app shell, from Google's profile metadata. */
export function shellUser(user: User) {
  const metadata = user.user_metadata;
  const name = metadata.full_name || metadata.name || user.email?.split("@")[0] || "Learner";
  const avatarUrl = metadata.avatar_url || metadata.picture || null;
  return { name, email: user.email ?? "", avatarUrl };
}

export function AuthLoading() {
  return <main className="loading-screen min-h-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading account" /></main>;
}
