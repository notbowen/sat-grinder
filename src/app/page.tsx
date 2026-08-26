"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => { if (!loading) router.replace(user ? "/dashboard/" : "/login/"); }, [loading, router, user]);
  return <main className="grid min-h-screen place-items-center"><LoaderCircle className="size-7 animate-spin text-[var(--blue)]" aria-label="Loading" /></main>;
}
