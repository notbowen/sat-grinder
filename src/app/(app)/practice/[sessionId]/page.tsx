import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Home, RotateCcw } from "lucide-react";
import { QuizCard } from "@/components/quiz-card";
import { getPracticeSession, PracticeError } from "@/lib/practice";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Practice" };

export default async function PracticeSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const current = await requireSession(); const { sessionId } = await params;
  let practice;
  try { practice = await getPracticeSession(current.user.id, sessionId); } catch (error) { if (error instanceof PracticeError && error.status === 404) notFound(); throw error; }
  if (practice.session.status === "abandoned") return <main className="page-container"><div className="completion-card"><RotateCcw className="mx-auto size-10 text-[var(--muted)]" /><h1 className="mt-5 section-title">This quiz was abandoned.</h1><p className="mt-3 text-[var(--muted)]">Your submitted attempts are safe and untouched questions are back in the pool.</p><Link href="/dashboard" className="primary-button mt-7">Back to dashboard</Link></div></main>;
  if (!practice.current) {
    const percent = practice.total ? Math.round(practice.firstAttemptCorrect / practice.total * 100) : 0;
    return <main className="page-container"><div className="completion-card"><span className="feedback-icon correct mx-auto"><CheckCircle2 className="size-7" /></span><p className="eyebrow mt-6 text-[var(--green)]">Quiz complete</p><h1 className="page-title">Round finished.</h1><p className="mt-4 text-lg text-[var(--muted)]">{practice.firstAttemptCorrect} of {practice.total} mastered on the first try · {percent}% clean solve rate</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/dashboard" className="primary-button"><Home className="size-4" /> Dashboard</Link><Link href={practice.session.mode === "random" ? "/practice/random" : "/practice/topics"} className="secondary-button">Start another</Link></div></div></main>;
  }
  return <main className="page-container max-w-[1320px]"><QuizCard key={practice.current.id} sessionId={sessionId} question={practice.current} resolved={practice.resolved} total={practice.total} /></main>;
}
