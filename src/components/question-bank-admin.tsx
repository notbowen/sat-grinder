"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, LoaderCircle, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

type SyncRun = { id: string; status: "running" | "completed" | "failed"; startedAt: string; completedAt: string | null; totalMetadata: number; fetchedDetails: number; imported: number; activeExcluded: number; error: string | null };
type Stats = { latest: SyncRun | null; total: number; eligible: number; active: number };

export function QuestionBankAdmin({ initial, authorized }: { initial: Stats; authorized: boolean }) {
  const [stats, setStats] = useState(initial); const [error, setError] = useState(""); const running = stats.latest?.status === "running";
  async function refresh() { const response = await fetch("/api/admin/question-bank/status", { cache: "no-store" }); if (response.ok) setStats(await response.json()); }
  useEffect(() => { if (!running) return; const timer = window.setInterval(refresh, 2000); return () => window.clearInterval(timer); }, [running]);
  async function start() { setError(""); const response = await fetch("/api/admin/question-bank", { method: "POST" }); const data = await response.json(); if (!response.ok) { setError(data.error || "The sync could not start."); return; } await refresh(); }
  const progress = stats.latest?.totalMetadata ? Math.round(stats.latest.fetchedDetails / stats.latest.totalMetadata * 100) : 0;

  return <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3"><div className="mini-metric"><p>Eligible bank</p><strong>{stats.eligible.toLocaleString()}</strong></div><div className="mini-metric"><p>Active excluded</p><strong>{stats.active.toLocaleString()}</strong></div><div className="mini-metric"><p>Stored records</p><strong>{stats.total.toLocaleString()}</strong></div></div>
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
        <div className="flex items-start gap-4"><span className={`feedback-icon ${stats.latest?.status === "completed" ? "correct" : stats.latest?.status === "failed" ? "incorrect" : "bg-[var(--paper-deep)] text-[var(--blue)]"}`}>{running ? <LoaderCircle className="size-6 animate-spin" /> : stats.latest?.status === "completed" ? <CheckCircle2 className="size-6" /> : stats.latest?.status === "failed" ? <XCircle className="size-6" /> : <Database className="size-6" />}</span><div><p className="eyebrow">Latest sync</p><h2 className="section-title">{!stats.latest ? "No sync has run" : running ? "Fetching question details" : stats.latest.status === "completed" ? "Question bank is current" : "Sync needs attention"}</h2>{stats.latest && <p className="mt-2 text-sm text-[var(--muted)]">Started {new Date(stats.latest.startedAt).toLocaleString()}</p>}</div></div>
        {running && <div className="mt-6"><div className="flex justify-between text-sm font-bold"><span>{stats.latest?.fetchedDetails.toLocaleString()} of {stats.latest?.totalMetadata.toLocaleString()}</span><span>{progress}%</span></div><div className="progress-track mt-2"><div style={{ width: `${progress}%` }} /></div><p className="mt-3 text-sm text-[var(--muted)]">Existing questions remain available while the new bank is validated.</p></div>}
        {stats.latest?.status === "completed" && <div className="mt-6 rounded-xl bg-[var(--green-soft)] p-4 text-sm text-[var(--green)]"><strong>{stats.latest.imported.toLocaleString()} medium and hard questions validated.</strong><p className="mt-1">{stats.latest.activeExcluded.toLocaleString()} current Bluebook items are stored but excluded from practice.</p></div>}
        {stats.latest?.status === "failed" && <pre className="mt-6 whitespace-pre-wrap rounded-xl bg-[var(--coral-soft)] p-4 text-xs leading-5 text-[var(--coral-dark)]">{stats.latest.error}</pre>}
      </div>
    </section>
    <aside className="h-fit rounded-2xl border border-[var(--line)] bg-white p-6"><span className="feedback-icon bg-[var(--gold-soft)] text-[var(--gold-dark)]"><ShieldAlert className="size-5" /></span><h2 className="section-title mt-5">Authorized source sync</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">This refresh reads SAT metadata and question details, validates and sanitizes them, stores diagrams on the attached volume, and keeps active Bluebook items out of practice.</p>{!authorized && <p className="form-error mt-5">Sync is locked. Set <code>COLLEGE_BOARD_EQB_AUTHORIZED=true</code> only when your written permission covers this deployment.</p>}{error && <p className="form-error mt-5" role="alert">{error}</p>}<button className="primary-button mt-6 w-full" onClick={start} disabled={!authorized || running}>{running ? <><LoaderCircle className="size-5 animate-spin" /> Sync in progress</> : <><RefreshCw className="size-4" /> {stats.latest ? "Refresh bank" : "Run first sync"}</>}</button></aside>
  </div>;
}
