"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, RotateCcw } from "lucide-react";
import { QuizCard } from "@/components/quiz-card";
import { getPracticeSession, type PracticeData } from "@/lib/supabase-api";

function PracticeSessionContent() {
  const sessionId = useSearchParams().get("session") ?? "";
  const [practice, setPractice] = useState<PracticeData | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!sessionId) { setError("Quiz not found."); return; }
    try { setPractice(await getPracticeSession(sessionId)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Quiz unavailable."); }
  }, [sessionId]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  if (error) return <main className="page"><p className="form-error" role="alert">{error}</p><Link href="/dashboard/" className="btn btn-secondary mt-5">Back to dashboard</Link></main>;
  if (!practice) return <main className="loading-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading quiz" /></main>;
  if (practice.session.status === "abandoned") return <main className="page"><div className="completion-card"><span className="feedback-icon" style={{ color: "var(--muted)" }}><RotateCcw className="size-5" aria-hidden="true" /></span><p className="eyebrow mt-6">Abandoned</p><h1 className="display-2 mt-2">This quiz was abandoned.</h1><p className="lede mt-4">Submitted answers are saved. Unanswered questions are back in the pool.</p><Link href="/dashboard/" className="btn btn-primary mt-8">Back to dashboard</Link></div></main>;
  if (!practice.current) {
    const percent = practice.total ? Math.round(practice.firstAttemptCorrect / practice.total * 100) : 0;
    return <main className="page"><div className="completion-card">
      <span className="feedback-icon correct"><CheckCircle2 className="size-5" aria-hidden="true" /></span>
      <p className="eyebrow mt-6" style={{ color: "var(--good)" }}>Quiz complete</p>
      <h1 className="display-1 mt-2">Round finished.</h1>
      <div className="stat-grid mt-8" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className="stat" style={{ minHeight: "auto" }}><p className="stat-label">Clean solves</p><p className="stat-value">{practice.firstAttemptCorrect}</p></article>
        <article className="stat" style={{ minHeight: "auto", paddingLeft: "1.25rem", borderLeft: "1px solid var(--line)" }}><p className="stat-label">Questions</p><p className="stat-value">{practice.total}</p></article>
        <article className="stat" style={{ minHeight: "auto", paddingLeft: "1.25rem", borderLeft: "1px solid var(--line)" }}><p className="stat-label">Clean rate</p><p className="stat-value">{percent}%</p></article>
      </div>
      <p className="lede mt-6" style={{ fontSize: ".95rem" }}>{practice.firstAttemptCorrect} of {practice.total} clean. Misses are in your review queue.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/dashboard/" className="btn btn-primary">Dashboard</Link><Link href="/practice/random/" className="btn btn-secondary">Start another</Link></div>
    </div></main>;
  }
  return <main className="page" style={{ maxWidth: 1320 }}><QuizCard key={practice.current.id} sessionId={sessionId} question={practice.current} resolved={practice.resolved} total={practice.total} onRefresh={refresh} /></main>;
}

export default function PracticeSessionPage() {
  return <Suspense fallback={<main className="loading-screen"><LoaderCircle className="size-6 animate-spin" /></main>}><PracticeSessionContent /></Suspense>;
}
