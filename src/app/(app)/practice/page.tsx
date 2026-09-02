"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, LoaderCircle, X } from "lucide-react";
import { STOP_SET_PROMPT } from "@/components/set-card";
import { SetLauncher, setPath } from "@/components/set-launcher";
import { abandonPracticeSession, getDashboard, getPracticePool, type DashboardData, type PracticePool } from "@/lib/supabase-api";
import { attentionSkills } from "@/lib/analytics";
import { formatDuration, formatPercent, formatRelativeDay, localDateKey, plural, sectionLabel, subjectLabel } from "@/lib/format";

function fetchAll() {
  return Promise.all([getDashboard("30d"), getPracticePool()]);
}

/** Today's completed and clean counts, read off the daily trend the dashboard already returns. */
function today(data: DashboardData) {
  if (data.trendGranularity !== "day") return { completed: 0, cleanSolved: 0 };
  const key = localDateKey(data.timezone);
  const point = data.trend.find((item) => item.start === key);
  return { completed: point?.completed ?? 0, cleanSolved: point?.cleanSolved ?? 0 };
}

export default function PracticePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [pool, setPool] = useState<PracticePool | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAll()
      .then(([nextData, nextPool]) => { if (!cancelled) { setData(nextData); setPool(nextPool); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Practice unavailable."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function stopActive(sessionId: string) {
    if (!window.confirm(STOP_SET_PROMPT)) return;
    setStopping(true); setError("");
    try { await abandonPracticeSession(sessionId); const [nextData, nextPool] = await fetchAll(); setData(nextData); setPool(nextPool); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not stop."); }
    finally { setStopping(false); }
  }

  const weakest = useMemo(() => data ? attentionSkills(data, 1)[0] ?? null : null, [data]);

  if (loading && (!data || !pool)) return <main className="loading-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading practice" /></main>;
  if (!data || !pool) return <main className="page"><p className="form-error" role="alert">{error || "Practice unavailable."}</p></main>;

  const done = today(data);
  const streak = data.summary.currentStreak;
  const review = data.reviewAnalytics;
  const hasEvidence = weakest !== null && weakest.completed >= 5;
  const active = data.activeSession;
  const recent = data.recentSessions.slice(0, 5);

  return <main className="page">
    {active && <section className="in-progress-card mb-8" aria-label="Set in progress">
      <div>
        <p className="eyebrow">In progress</p>
        <h2>{subjectLabel(active.subject)} · {active.resolved} of {active.requestedCount}</h2>
        <p className="detail">{active.cleanSolved} clean · {active.timedAttempts ? formatDuration(active.activeTimeMs) : "Not timed yet"}</p>
      </div>
      <div className="in-progress-actions">
        <Link href={setPath(active.id)} className="in-progress-link">Resume <ArrowRight className="size-4" aria-hidden="true" /></Link>
        <button type="button" className="in-progress-stop" onClick={() => void stopActive(active.id)} disabled={stopping}>{stopping ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />} Stop</button>
      </div>
    </section>}

    <div className="page-head">
      <div>
        <p className="eyebrow">Practice</p>
        <h1 className="page-title">{streak > 0 ? `${streak}-day streak.` : "Start a streak."}</h1>
        <p className="page-subtitle">{done.completed > 0 ? `${done.completed} done today, ${done.cleanSolved} clean.` : "Nothing yet today."}</p>
      </div>
      <div className="head-stats">
        <div className="head-stat">
          <p className="stat-label">Review</p>
          <p className="head-stat-value num">{review.total} in review</p>
          <p className="stat-detail">{review.total === 0 ? "Nothing in review." : `${review.ageBuckets.stale} older than 30 days.`}</p>
        </div>
        <div className="head-stat">
          <p className="stat-label">Weakest skill</p>
          {hasEvidence && weakest
            ? <><p className="head-stat-text">{weakest.skill}</p><p className="stat-detail">{formatPercent(weakest.cleanSolveRate)} clean · n={weakest.completed} · {sectionLabel(weakest.section)}</p></>
            : <p className="head-stat-text muted">Needs 5 answers per skill.</p>}
        </div>
      </div>
    </div>

    {error && <p className="form-error mt-6" role="alert">{error}</p>}
    {data.snapshot.total === 0 && <div className="empty-banner"><BookOpen className="size-5" aria-hidden="true" /><div><p>No questions yet.</p><p className="small">The bank syncs nightly.</p></div></div>}

    <div className="practice-grid">
      <SetLauncher pool={pool} blocked={active ? "Finish or stop the set in progress first." : undefined} />
      <section aria-labelledby="recent-title">
        <div className="section-head"><div><span className="section-index">Recent</span><h2 id="recent-title" className="section-title">Sets</h2></div><Link href="/progress/#sets" className="link-arrow">All sets <ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>
        {recent.length ? <div className="list-rows">
          {recent.map((set) => <div key={set.id}>
            <span>
              <span className="row-title">{subjectLabel(set.subject)} · {set.resolved} of {set.requestedCount}{set.status === "abandoned" && <span className="status-pill status-muted">stopped</span>}</span>
              <small>{formatRelativeDay(set.createdAt)} · {set.timedAttempts ? formatDuration(set.activeTimeMs) : "Not timed"}</small>
            </span>
            <span className="num-cell"><strong>{formatPercent(set.cleanSolveRate)}</strong><small>{set.cleanSolved} clean · {set.retries} {plural(set.retries, "retry", "retries")}</small></span>
          </div>)}
        </div> : <div className="chart-empty compact">No sets yet.</div>}
      </section>
    </div>
  </main>;
}
