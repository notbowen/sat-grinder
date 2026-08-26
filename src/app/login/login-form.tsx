"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!authLoading && user) router.replace("/dashboard/"); }, [authLoading, router, user]);

  async function submit() {
    setLoading(true); setError("");
    try { await signInWithGoogle(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in could not be started."); setLoading(false); }
  }

  return <div className="mt-8 space-y-5">
    {(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}
    <button type="button" className="primary-button w-full" disabled={loading || authLoading} onClick={submit}>
      {loading || authLoading ? <LoaderCircle className="size-5 animate-spin" /> : <><span className="grid size-6 place-items-center rounded-full bg-white text-sm font-black text-[#4285f4]">G</span> Continue with Google</>}
    </button>
    <p className="text-center text-xs leading-5 text-[var(--muted)]">SAT Grinder receives only your basic Google profile and email address.</p>
  </div>;
}
