"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, History, LoaderCircle } from "lucide-react";
import { claimLegacyHistory } from "@/lib/supabase-api";

export default function ClaimHistoryPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sessions: number; attempts: number; progress: number } | null>(null);

  async function claim(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try { setResult(await claimLegacyHistory(token.trim())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The history could not be imported."); }
    finally { setLoading(false); }
  }

  return <main className="page-container max-w-3xl">
    <p className="eyebrow">One-time migration</p><h1 className="page-title">Bring your old progress with you.</h1>
    <p className="page-subtitle">If you practiced on the original private deployment, enter the claim token supplied during migration. New accounts can ignore this page.</p>
    <section className="mt-9 rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
      {result ? <div className="text-center"><CheckCircle2 className="mx-auto size-10 text-[var(--green)]" /><h2 className="section-title mt-5">History imported.</h2><p className="mt-3 text-[var(--muted)]">Restored {result.sessions} quizzes, {result.attempts} attempts, and progress on {result.progress} questions.</p><Link href="/dashboard/" className="primary-button mt-7">View dashboard</Link></div>
        : <form onSubmit={claim}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[var(--blue-soft)] text-[var(--blue-dark)]"><History className="size-5" /></span><div><p className="font-bold">Legacy claim token</p><p className="text-sm text-[var(--muted)]">It can be used once and is never stored in plaintext.</p></div></div><label className="form-label mt-6">Token<input className="form-input font-mono" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required minLength={32} /></label>{error && <p className="form-error mt-4" role="alert">{error}</p>}<button className="primary-button mt-6" disabled={loading || token.trim().length < 32}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : "Import history"}</button></form>}
    </section>
  </main>;
}
