"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

// Both operands are inlined at build time, so this folds to `false` in a
// production build and the local sign-in form below is dropped from the bundle.
// `localSupabaseAuth()` in @/lib/supabase is the matching runtime guard.
const LOCAL_SUPABASE_AUTH = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SUPABASE_LOCAL === "true";

export function LoginForm() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError, signInWithGoogle, signInWithLocalPassword } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("dev@local.test");
  const [password, setPassword] = useState("localdev123");

  useEffect(() => { if (!authLoading && user) router.replace("/dashboard/"); }, [authLoading, router, user]);

  async function submit() {
    setLoading(true); setError("");
    try { await signInWithGoogle(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in could not be started."); setLoading(false); }
  }

  async function submitLocal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    try { await signInWithLocalPassword(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Local sign-in failed."); setLoading(false); }
  }

  return <div className="mt-8 space-y-5">
    {(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}
    <button type="button" className="primary-button w-full" disabled={loading || authLoading} onClick={submit}>
      {loading || authLoading ? <LoaderCircle className="size-5 animate-spin" /> : <><span className="grid size-6 place-items-center rounded-full bg-white text-sm font-black text-[#4285f4]">G</span> Continue with Google</>}
    </button>
    <p className="text-center text-xs leading-5 text-[var(--muted)]">SAT Grinder receives only your basic Google profile and email address.</p>
    {LOCAL_SUPABASE_AUTH && <form className="space-y-4 rounded-2xl border border-dashed border-[var(--line)] p-4" onSubmit={submitLocal}>
      <p className="metric-label">Local Supabase</p>
      <p className="text-xs leading-5 text-[var(--muted)]">Google is not configured on the local stack. This account is created on first use and never exists in production.</p>
      <label className="form-label">Email<input className="form-input" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="form-label">Password<input className="form-input" type="password" autoComplete="off" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button type="submit" className="secondary-button w-full" disabled={loading || authLoading}>Sign in as a local test user</button>
    </form>}
  </div>;
}
