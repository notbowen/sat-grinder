"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { shellUser } from "@/components/require-auth";
import { SetCard, SetStrip } from "@/components/set-card";
import { setPath } from "@/components/set-launcher";
import { getPracticeSession, startPractice, type PracticeData } from "@/lib/supabase-api";
import { readSetResults, type SetResults } from "@/lib/set-results";
import { readLastSetSettings } from "@/lib/set-settings";

/** The server still says "quiz" in its errors; learners read "set". */
function setMessage(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message : "";
  return message.replace(/quiz/g, "set").replace(/Quiz/g, "Set") || fallback;
}

/** Positions are only known when this browser answered every question; otherwise show the proportion. */
function completionStrip(total: number, clean: number, results: SetResults): SetResults {
  const known = Array.from({ length: total }, (_, index) => results[index]).filter(Boolean).length;
  if (known === total) return results;
  return Object.fromEntries(Array.from({ length: total }, (_, index) => [index, index < clean ? "clean" : "miss"]));
}

/** Pages around the set (loading, stopped, complete) wear the app shell; the set itself has its own bar. */
function Framed({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <>{children}</>;
  return <AppShell user={shellUser(user)}>{children}</AppShell>;
}

function SetContent() {
  const router = useRouter();
  const sessionId = useSearchParams().get("set") ?? "";
  const [loaded, setLoaded] = useState<{ sessionId: string; data: PracticeData } | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const practice = loaded?.sessionId === sessionId ? loaded.data : null;

  const refresh = useCallback(async () => {
    if (!sessionId) { setError("Set not found."); return; }
    try { setLoaded({ sessionId, data: await getPracticeSession(sessionId) }); setError(""); }
    catch (cause) { setError(setMessage(cause, "Set unavailable.")); }
  }, [sessionId]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function another(count: number, subject: ReturnType<typeof readLastSetSettings>["subject"]) {
    setStarting(true); setError("");
    try { router.push(setPath(await startPractice(count, subject))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start."); setStarting(false); }
  }

  if (error && !practice) return <Framed><main className="page"><p className="form-error" role="alert">{error}</p><Link href="/practice/" className="btn btn-secondary mt-5">Practice</Link></main></Framed>;
  if (!practice) return <main className="loading-screen min-h-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading set" /></main>;

  if (practice.session.status === "abandoned") return <Framed><main className="page"><div className="completion-card">
    <div><p className="eyebrow">Set stopped</p><h1 className="page-title">Answers saved.</h1></div>
    <p className="lede">The rest went back to the pool.</p>
    <div className="flex flex-wrap gap-3"><Link href="/practice/" className="btn btn-primary">Practice</Link></div>
  </div></main></Framed>;

  if (!practice.current) {
    const settings = readLastSetSettings();
    const clean = practice.firstAttemptCorrect;
    const missed = practice.total - clean;
    const results = completionStrip(practice.total, clean, readSetResults(sessionId));
    return <Framed><main className="page"><div className="completion-card">
      <div><p className="eyebrow" style={{ color: "var(--good)" }}>Set complete</p><h1 className="page-title">{clean} of {practice.total} clean.</h1></div>
      <div>
        <SetStrip className="result-strip" total={practice.total} resolved={practice.total} results={results} />
        <div className="segbar-legend"><span><i className="fill-mastered" /><strong>{clean}</strong> clean</span><span><i className="fill-review" /><strong>{missed}</strong> in review</span></div>
      </div>
      <p className="lede">Misses come back until solved first try.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => void another(settings.count, settings.subject)} disabled={starting}>{starting ? <LoaderCircle className="size-4 animate-spin" /> : <>Another {settings.count} <ArrowRight className="size-4" aria-hidden="true" /></>}</button>
        <Link href="/progress/" className="btn btn-secondary">Progress</Link>
      </div>
    </div></main></Framed>;
  }

  return <SetCard key={practice.current.id} sessionId={sessionId} question={practice.current} resolved={practice.resolved} total={practice.total} onRefresh={refresh} />;
}

export default function SetPage() {
  return <Suspense fallback={<main className="loading-screen min-h-screen"><LoaderCircle className="size-6 animate-spin" /></main>}><SetContent /></Suspense>;
}
