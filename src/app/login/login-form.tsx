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

  useEffect(() => { if (!authLoading && user) router.replace("/practice/"); }, [authLoading, router, user]);

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
    <button type="button" className="btn btn-primary w-full" disabled={loading || authLoading} onClick={submit}>
      {loading || authLoading ? <LoaderCircle className="size-5 animate-spin" /> : <><span className="google-mark" aria-hidden="true">G</span> Continue with Google</>}
    </button>
    <p className="small muted text-center">We get your name, email and avatar. Nothing else.</p>
    {LOCAL_SUPABASE_AUTH && <form className="dev-login" onSubmit={submitLocal}>
      <p className="stat-label">Local Supabase</p>
      <p className="small muted">Google is not set up locally. This account is created on first use and never exists in production.</p>
      <label className="form-label">Email<input className="form-input" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="form-label">Password<input className="form-input" type="password" autoComplete="off" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button type="submit" className="btn btn-secondary w-full" disabled={loading || authLoading}>Sign in as a local test user</button>
    </form>}
  </div>;
}
