"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Flame, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";
import { ColumnChart, HBarList, LineChart, SegmentBar, Sparkline } from "@/components/charts";
import { getDashboard, type DashboardData, type DashboardWindow } from "@/lib/supabase-api";
import { attentionSkills } from "@/lib/analytics";
import { coveragePercent, formatDate, formatDuration, formatPace, formatPercent, formatTrendDate, sectionLabel, windowOptions } from "@/lib/format";

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="stat-delta flat">Need 5+ answers in both periods</span>;
  const positive = value >= 0;
  return <span className={`stat-delta ${positive ? "up" : "down"}`}>
    {positive ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
    {positive ? "+" : ""}{value} pts vs prior period
  </span>;
}

function coverageSegments(item: { mastered: number; review: number; unseen: number }) {
  return [
    { key: "mastered", label: "Mastered", value: item.mastered, fill: "mastered" as const },
    { key: "review", label: "In review", value: item.review, fill: "review" as const },
    { key: "unseen", label: "Unseen", value: item.unseen, fill: "unseen" as const },
  ];
}

export default function DashboardPage() {
  const [window, setWindow] = useState<DashboardWindow>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getDashboard(window).then((result) => { if (!cancelled) setData(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Dashboard unavailable."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [window]);

  function selectWindow(nextWindow: DashboardWindow) {
    if (nextWindow === window) return;
    setLoading(true);
    setError("");
    setWindow(nextWindow);
  }

  const attention = useMemo(() => data ? attentionSkills(data) : [], [data]);
  const trend = useMemo(() => {
    if (!data) return { completed: [], rate: [], sparkCompleted: [], sparkRate: [], sparkTime: [], sparkMastered: [] };
    const label = (start: string) => formatTrendDate(start, data.trendGranularity);
    return {
      completed: data.trend.map((point) => ({ label: label(point.start), value: point.completed, detail: `${point.cleanSolved} clean on the first try` })),
      rate: data.trend.map((point) => ({ label: label(point.start), value: point.cleanSolveRate, detail: `n=${point.completed}` })),
      sparkCompleted: data.trend.map((point) => point.completed),
      sparkRate: data.trend.map((point) => point.cleanSolveRate ?? 0),
      sparkTime: data.trend.map((point) => point.activeTimeMs),
      sparkMastered: data.trend.map((point) => point.cleanSolved),
    };
  }, [data]);

  if (!data && loading) return <main className="loading-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading dashboard" /></main>;
  if (!data) return <main className="page"><p className="form-error" role="alert">{error || "Dashboard unavailable."}</p></main>;

  const selected = windowOptions.find((option) => option.value === data.window) ?? windowOptions[2];
  const total = Math.max(data.snapshot.total, 1);
  const masteredPercent = Math.round(data.snapshot.mastered * 100 / total);
  const ageBuckets = data.reviewAnalytics.ageBuckets;
  const reviewMax = Math.max(ageBuckets.fresh, ageBuckets.aging, ageBuckets.stale, 1);
  const hasEvidence = data.skills.some((skill) => skill.completed >= 5);

  return <main className="page" aria-busy={loading} style={{ opacity: loading ? .6 : 1, transition: "opacity .15s ease" }}>
    <div className="page-head">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h1 className="page-title">Your practice, {selected.phrase}.</h1>
        <p className="page-subtitle">Coverage shows what you have learned. Clean-solve rate, retries, and active time show how reliably you can do it.</p>
      </div>
      <div className="page-head-actions">
        <div className="seg" role="group" aria-label="Dashboard time range">
          {windowOptions.map((option) => <button key={option.value} type="button" className={window === option.value ? "active" : ""} aria-pressed={window === option.value} onClick={() => selectWindow(option.value)}>{option.label}</button>)}
        </div>
        {!data.activeSession && <Link href="/practice/random/" className="btn btn-primary"><BookOpen className="size-4" aria-hidden="true" /> Start practice</Link>}
      </div>
    </div>

    {error && <p className="form-error mt-6" role="alert">{error}</p>}
    {loading && <p className="loading-inline mt-4"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Updating</p>}

    {data.activeSession && <section className="active-session-card" aria-label="Active session">
      <div>
        <p className="eyebrow">Active session</p>
        <h2>{data.activeSession.subject} · {data.activeSession.resolved} of {data.activeSession.requestedCount} complete</h2>
        <p>{data.activeSession.cleanSolved} clean solves · {data.activeSession.timedAttempts ? formatDuration(data.activeSession.activeTimeMs) : "Timing starts with your next answer"}</p>
      </div>
      <Link href={`/practice/session/?session=${data.activeSession.id}`} className="active-session-link">Resume <ArrowRight className="size-4" aria-hidden="true" /></Link>
    </section>}

    {data.snapshot.total === 0 && <div className="empty-banner"><BookOpen className="size-5" aria-hidden="true" /><div><p>Question bank not ready yet.</p><p className="small">Stats appear after the nightly sync.</p></div></div>}

    <section className="section" aria-labelledby="summary-title">
      <div className="section-head"><div><span className="section-index">01</span><h2 id="summary-title" className="section-title">Performance summary</h2></div><p>{selected.label} · {data.timezone}</p></div>
      <div className="stat-grid">
        <article className="stat">
          <p className="stat-label">Questions completed</p>
          <p className="stat-value">{data.summary.completed.toLocaleString()}</p>
          <p className="stat-detail">Including retries</p>
          <Sparkline values={trend.sparkCompleted} />
        </article>
        <article className="stat">
          <p className="stat-label">Clean-solve rate</p>
          <p className="stat-value">{formatPercent(data.summary.cleanSolveRate)}</p>
          <p className="stat-detail">{data.summary.cleanSolved} of {data.summary.completed} on the first try</p>
          <Delta value={data.summary.cleanSolveDelta} />
          <Sparkline values={trend.sparkRate} series="accent" />
        </article>
        <article className="stat">
          <p className="stat-label">Active study time</p>
          <p className="stat-value">{data.summary.timedAttempts ? formatDuration(data.summary.activeTimeMs) : "—"}</p>
          <p className="stat-detail">{data.summary.timedAttempts ? `${data.summary.timedAttempts} timed attempts` : "Timing starts with new attempts"}</p>
          <Sparkline values={trend.sparkTime} />
        </article>
        <article className="stat">
          <p className="stat-label">Practice days</p>
          <p className="stat-value">{data.summary.practiceDays}</p>
          <p className="stat-detail">Days with practice</p>
          <span className="stat-delta flat"><Flame className="size-3.5" aria-hidden="true" /> {data.summary.currentStreak}-day current streak</span>
        </article>
        <article className="stat">
          <p className="stat-label">Newly mastered</p>
          <p className="stat-value">{data.summary.newlyMastered.toLocaleString()}</p>
          <p className="stat-detail">Clean first attempts</p>
          <Sparkline values={trend.sparkMastered} />
        </article>
      </div>
    </section>

    <div className="section grid-12">
      <section className="span-7" aria-labelledby="trend-title">
        <div className="section-head"><div><span className="section-index">02</span><h2 id="trend-title" className="section-title">Activity over time</h2></div><p>Per {data.trendGranularity}</p></div>
        <div className="panel" style={{ display: "grid", gap: "1.75rem" }}>
          <ColumnChart title="Questions completed" subtitle="Per period" points={trend.completed} format={(value) => value.toLocaleString()} unit="Completed" />
          <LineChart title="Clean-solve rate" subtitle="Right on the first try" points={trend.rate} format={(value) => `${Math.round(value)}%`} unit="Clean solve" />
        </div>
      </section>

      <section className="span-5" aria-labelledby="coverage-title">
        <div className="section-head"><div><span className="section-index">03</span><h2 id="coverage-title" className="section-title">Bank coverage</h2></div><p>{data.snapshot.total.toLocaleString()} eligible</p></div>
        <div className="panel">
          <p className="stat-label">Mastered</p>
          <div className="hero-number-row"><p className="hero-number">{masteredPercent}%</p><span>{data.snapshot.mastered.toLocaleString()} of {data.snapshot.total.toLocaleString()}</span></div>
          <div className="mt-5"><SegmentBar segments={coverageSegments(data.snapshot)} total={data.snapshot.total} legend /></div>
          <div className="coverage-sections">{data.sections.map((item) => <article key={item.key}>
            <div><strong>{item.label}</strong><span>{item.mastered}/{item.total} mastered · {item.review} in review</span></div><b>{coveragePercent(item)}%</b>
            <SegmentBar segments={coverageSegments(item)} total={item.total} thin />
          </article>)}</div>
        </div>
      </section>
    </div>

    <div className="section grid-12">
      <section className="span-5" aria-labelledby="review-title">
        <div className="section-head"><div><span className="section-index">04</span><h2 id="review-title" className="section-title">Review queue</h2></div><p>Current snapshot</p></div>
        <div className="panel">
          <div className="hero-number-row"><p className="hero-number">{data.reviewAnalytics.total}</p><span>questions waiting</span></div>
          <p className="panel-copy mt-3">{data.reviewAnalytics.repeatedMisses} missed more than once. Age counts from the last miss.</p>
          <div className="mt-5"><HBarList accent rows={[
            { key: "fresh", label: "0–7 days", value: ageBuckets.fresh, max: reviewMax, display: String(ageBuckets.fresh) },
            { key: "aging", label: "8–30 days", value: ageBuckets.aging, max: reviewMax, display: String(ageBuckets.aging) },
            { key: "stale", label: "30+ days", value: ageBuckets.stale, max: reviewMax, display: String(ageBuckets.stale) },
          ]} /></div>
          <div className="review-split">{data.reviewAnalytics.bySection.map((item) => <span key={item.section}><strong>{item.count}</strong> {item.label}</span>)}</div>
        </div>
      </section>

      <section className="span-7" aria-labelledby="attention-title">
        <div className="section-head"><div><span className="section-index">05</span><h2 id="attention-title" className="section-title">Needs attention</h2></div><p>{hasEvidence ? "Lowest clean-solve skills with n ≥ 5" : "Largest review piles until n ≥ 5"}</p></div>
        <div className="panel">
          {attention.length ? <HBarList accent rows={attention.map((skill) => ({
            key: skill.key,
            label: skill.skill,
            sub: `${skill.domain} · ${sectionLabel(skill.section)}`,
            value: hasEvidence ? (skill.cleanSolveRate ?? 0) : skill.review,
            max: hasEvidence ? 100 : Math.max(...attention.map((item) => item.review), 1),
            display: hasEvidence ? formatPercent(skill.cleanSolveRate) : String(skill.review),
            detail: hasEvidence ? `n=${skill.completed} · ${skill.review} review` : `${formatPace(skill.medianFirstAttemptMs)} pace`,
          }))} /> : <div className="chart-empty"><CheckCircle2 className="size-5" aria-hidden="true" /><p>Not enough data to rank skills yet.</p></div>}
          <p className="mt-5"><Link href="/statistics/" className="link-arrow">All skills and filters <ArrowRight className="size-3.5" aria-hidden="true" /></Link></p>
        </div>
      </section>
    </div>

    <section className="section" aria-labelledby="sessions-title">
      <div className="section-head"><div><span className="section-index">06</span><h2 id="sessions-title" className="section-title">Recent sessions</h2></div><Link href="/statistics/#sessions" className="link-arrow">All statistics <ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>
      {data.recentSessions.length ? <div className="table-wrap panel-flat"><table className="data-table">
        <thead><tr><th>Session</th><th>Date</th><th>Complete</th><th>Clean solve</th><th>Retries</th><th>Active</th></tr></thead>
        <tbody>{data.recentSessions.slice(0, 5).map((session) => <tr key={session.id}>
          <td><strong>{session.subject}</strong><small><span className={`status-pill ${session.status}`}>{session.status}</span></small></td>
          <td>{formatDate(session.createdAt)}</td>
          <td><strong>{session.resolved}/{session.requestedCount}</strong></td>
          <td><strong>{formatPercent(session.cleanSolveRate)}</strong><small>n={session.resolved}</small></td>
          <td>{session.retries}</td>
          <td>{session.timedAttempts ? formatDuration(session.activeTimeMs) : "—"}</td>
        </tr>)}</tbody>
      </table></div> : <div className="chart-empty compact">Finished and abandoned sessions appear here.</div>}
    </section>
  </main>;
}
