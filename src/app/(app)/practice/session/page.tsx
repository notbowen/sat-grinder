"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Home, LoaderCircle, RotateCcw } from "lucide-react";
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
  if (error) return <main className="page-container"><p className="form-error" role="alert">{error}</p><Link href="/dashboard/" className="secondary-button mt-5">Back to dashboard</Link></main>;
  if (!practice) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-[var(--blue)]" aria-label="Loading quiz" /></main>;
  if (practice.session.status === "abandoned") return <main className="page-container"><div className="completion-card"><RotateCcw className="mx-auto size-10 text-[var(--muted)]" /><h1 className="mt-5 section-title">This quiz was abandoned.</h1><p className="mt-3 text-[var(--muted)]">Your submitted attempts are safe and untouched questions are back in the pool.</p><Link href="/dashboard/" className="primary-button mt-7">Back to dashboard</Link></div></main>;
  if (!practice.current) {
    const percent = practice.total ? Math.round(practice.firstAttemptCorrect / practice.total * 100) : 0;
    return <main className="page-container"><div className="completion-card"><span className="feedback-icon correct mx-auto"><CheckCircle2 className="size-7" /></span><p className="eyebrow mt-6 text-[var(--green)]">Quiz complete</p><h1 className="page-title">Round finished.</h1><p className="mt-4 text-lg text-[var(--muted)]">{practice.firstAttemptCorrect} of {practice.total} mastered on the first try · {percent}% clean solve rate</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/dashboard/" className="primary-button"><Home className="size-4" /> Dashboard</Link><Link href="/practice/random/" className="secondary-button">Start another</Link></div></div></main>;
  }
  return <main className="page-container max-w-[1320px]"><QuizCard key={practice.current.id} sessionId={sessionId} question={practice.current} resolved={practice.resolved} total={practice.total} onRefresh={refresh} /></main>;
}

export default function PracticeSessionPage() {
  return <Suspense fallback={<main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-[var(--blue)]" /></main>}><PracticeSessionContent /></Suspense>;
}
