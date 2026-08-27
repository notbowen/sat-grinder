"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  LoaderCircle,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  getDashboard,
  type DashboardBreakdown,
  type DashboardData,
  type DashboardSkill,
  type DashboardWindow,
} from "@/lib/supabase-api";

const windows: { value: DashboardWindow; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "14d", label: "2 weeks" },
  { value: "30d", label: "1 month" },
  { value: "all", label: "All time" },
];

type SkillSort = "skill" | "completed" | "accuracy" | "retry" | "time" | "coverage" | "review" | "trend";
type SortDirection = "asc" | "desc";

function formatDuration(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) return milliseconds ? "<1m" : "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatPace(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatTrendDate(value: string, granularity: DashboardData["trendGranularity"]) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, granularity === "month"
    ? { month: "short", year: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function coveragePercent(item: { total: number; mastered: number }) {
  return item.total ? Math.round(item.mastered * 100 / item.total) : 0;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="metric-delta metric-delta-neutral">Need 5+ in both periods</span>;
  const positive = value >= 0;
  return <span className={`metric-delta ${positive ? "metric-delta-positive" : "metric-delta-negative"}`}>
    {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
    {positive ? "+" : ""}{value} pts vs prior period
  </span>;
}

function CoverageBar({ mastered, review, unseen, total }: { mastered: number; review: number; unseen: number; total: number }) {
  const divisor = Math.max(total, 1);
  return <div className="coverage-bar" aria-label={`${mastered} mastered, ${review} in review, ${unseen} unseen`}>
    <span className="coverage-mastered" style={{ width: `${mastered * 100 / divisor}%` }} />
    <span className="coverage-review" style={{ width: `${review * 100 / divisor}%` }} />
    <span className="coverage-unseen" style={{ width: `${unseen * 100 / divisor}%` }} />
  </div>;
}

function ComparisonCard({ item }: { item: DashboardBreakdown }) {
  return <article className="comparison-card">
    <div className="flex items-start justify-between gap-4">
      <div><p className="metric-label">{item.label}</p><p className="comparison-rate">{item.cleanSolveRate === null ? "—" : `${item.cleanSolveRate}%`}</p></div>
      <span className="sample-chip">n={item.completed}</span>
    </div>
    <p className="mt-1 text-xs text-[var(--muted)]">First-attempt clean solve</p>
    <div className="mt-5"><CoverageBar mastered={item.mastered} review={item.review} unseen={item.unseen} total={item.total} /></div>
    <div className="comparison-details">
      <span><strong>{coveragePercent(item)}%</strong> bank complete</span>
      <span><strong>{item.retryRate === null ? "—" : `${item.retryRate}%`}</strong> retried</span>
      <span><strong>{formatPace(item.medianFirstAttemptMs)}</strong> median pace</span>
    </div>
  </article>;
}

function TrendChart({ data }: { data: DashboardData }) {
  const maxCompleted = Math.max(...data.trend.map((point) => point.completed), 1);
  const maxActive = Math.max(...data.trend.map((point) => point.activeTimeMs), 1);
  const hasActivity = data.trend.some((point) => point.completed || point.activeTimeMs);
  const minimumWidth = Math.max(620, data.trend.length * 34);

  if (!hasActivity) return <div className="analytics-empty"><BarChart3 className="size-6" /><p>Your activity trend will appear after you submit some answers.</p></div>;

  return <>
    <div className="trend-legend" aria-hidden="true">
      <span><i className="legend-swatch legend-completed" /> Completed</span>
      <span><i className="legend-swatch legend-time" /> Active time</span>
      <span><i className="legend-dot" /> Clean solve rate</span>
    </div>
    <div className="trend-scroll">
      <div className="trend-chart" style={{ minWidth: minimumWidth }}>
        {data.trend.map((point, index) => {
          const showLabel = data.trend.length <= 10 || index === 0 || index === data.trend.length - 1 || index % Math.ceil(data.trend.length / 6) === 0;
          const style = {
            "--completed-height": `${point.completed * 100 / maxCompleted}%`,
            "--time-height": `${point.activeTimeMs * 100 / maxActive}%`,
            "--accuracy-height": `${point.cleanSolveRate ?? 0}%`,
          } as CSSProperties;
          return <div className="trend-column" key={point.start} style={style} title={`${formatTrendDate(point.start, data.trendGranularity)}: ${point.completed} completed, ${point.cleanSolveRate ?? "—"}% clean solve, ${formatDuration(point.activeTimeMs)} active time`}>
            <div className="trend-plot-column">
              <span className="trend-bar trend-bar-completed" />
              <span className="trend-bar trend-bar-time" />
              {point.cleanSolveRate !== null && <span className="trend-accuracy-dot" />}
            </div>
            <span className="trend-label">{showLabel ? formatTrendDate(point.start, data.trendGranularity) : ""}</span>
            <span className="sr-only">{point.completed} questions completed at a {point.cleanSolveRate ?? 0}% clean-solve rate with {formatDuration(point.activeTimeMs)} active time.</span>
          </div>;
        })}
      </div>
    </div>
  </>;
}

function getSortValue(skill: DashboardSkill, sort: SkillSort) {
  if (sort === "skill") return skill.skill.toLowerCase();
  if (sort === "completed") return skill.completed;
  if (sort === "accuracy") return skill.cleanSolveRate;
  if (sort === "retry") return skill.retryRate;
  if (sort === "time") return skill.medianFirstAttemptMs;
  if (sort === "coverage") return coveragePercent(skill);
  if (sort === "review") return skill.review;
  return skill.cleanSolveDelta;
}

function SkillTable({ skills }: { skills: DashboardSkill[] }) {
  const [sort, setSort] = useState<SkillSort>("review");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [section, setSection] = useState<"all" | "math" | "reading-writing">("all");
  const sorted = useMemo(() => {
    return skills.filter((skill) => section === "all" || skill.section === section).sort((a, b) => {
      const aValue = getSortValue(a, sort);
      const bValue = getSortValue(b, sort);
      if (aValue === null && bValue === null) return a.skill.localeCompare(b.skill);
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      const compared = typeof aValue === "string" && typeof bValue === "string" ? aValue.localeCompare(bValue) : Number(aValue) - Number(bValue);
      return (direction === "asc" ? compared : -compared) || a.skill.localeCompare(b.skill);
    });
  }, [direction, section, skills, sort]);

  function changeSort(next: SkillSort) {
    if (sort === next) setDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSort(next); setDirection(next === "skill" ? "asc" : "desc"); }
  }
  function heading(label: string, key: SkillSort) {
    return <button type="button" onClick={() => changeSort(key)} aria-label={`Sort by ${label}`} aria-pressed={sort === key}>
      {label}<ArrowDownUp className="size-3.5" />
    </button>;
  }

  return <>
    <div className="analytics-filter" aria-label="Filter skills by section">
      {(["all", "reading-writing", "math"] as const).map((value) => <button key={value} type="button" className={section === value ? "active" : ""} onClick={() => setSection(value)}>
        {value === "all" ? "All skills" : value === "math" ? "Math" : "Reading & Writing"}
      </button>)}
    </div>
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead><tr>
          <th>{heading("Skill", "skill")}</th>
          <th>{heading("Completed", "completed")}</th>
          <th>{heading("Clean solve", "accuracy")}</th>
          <th>{heading("Retry rate", "retry")}</th>
          <th>{heading("Median pace", "time")}</th>
          <th>{heading("Bank complete", "coverage")}</th>
          <th>{heading("Review", "review")}</th>
          <th>{heading("Change", "trend")}</th>
        </tr></thead>
        <tbody>{sorted.map((skill) => <tr key={skill.key}>
          <td><strong>{skill.skill}</strong><small>{skill.domain} · {skill.section === "math" ? "Math" : "Reading & Writing"}</small></td>
          <td><strong>{skill.completed}</strong><small>resolved</small></td>
          <td><strong>{skill.cleanSolveRate === null ? "—" : `${skill.cleanSolveRate}%`}</strong><small>n={skill.completed}</small></td>
          <td><strong>{skill.retryRate === null ? "—" : `${skill.retryRate}%`}</strong><small>{skill.retried} retried</small></td>
          <td><strong>{formatPace(skill.medianFirstAttemptMs)}</strong><small>{skill.timedFirstAttempts} timed</small></td>
          <td><strong>{coveragePercent(skill)}%</strong><small>{skill.mastered}/{skill.total}</small></td>
          <td><strong className={skill.review ? "text-[var(--coral-dark)]" : ""}>{skill.review}</strong><small>questions</small></td>
          <td><strong>{skill.cleanSolveDelta === null ? "—" : `${skill.cleanSolveDelta > 0 ? "+" : ""}${skill.cleanSolveDelta} pts`}</strong><small>{skill.previousCompleted ? `prior n=${skill.previousCompleted}` : "not enough data"}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
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

  const attentionSkills = useMemo(() => {
    if (!data) return [];
    const enoughEvidence = data.skills.filter((skill) => skill.completed >= 5);
    const source = enoughEvidence.length ? enoughEvidence : data.skills.filter((skill) => skill.review > 0);
    return [...source].sort((a, b) => {
      if (enoughEvidence.length) return (a.cleanSolveRate ?? 101) - (b.cleanSolveRate ?? 101) || b.review - a.review;
      return b.review - a.review || b.retried - a.retried;
    }).slice(0, 4);
  }, [data]);

  if (!data && loading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-[var(--blue)]" aria-label="Loading dashboard" /></main>;
  if (!data) return <main className="page-container"><p className="form-error" role="alert">{error || "Dashboard unavailable."}</p></main>;

  const total = Math.max(data.snapshot.total, 1);
  const reviewMax = Math.max(data.reviewAnalytics.ageBuckets.fresh, data.reviewAnalytics.ageBuckets.aging, data.reviewAnalytics.ageBuckets.stale, 1);

  return <main className="page-container analytics-dashboard" aria-busy={loading}>
    <div className="dashboard-heading">
      <div><p className="eyebrow">Performance analytics</p><h1 className="page-title">See the pattern. Sharpen the next set.</h1><p className="page-subtitle">Coverage shows what you have learned. Clean-solve rate, retries, and active time show how reliably you can do it.</p></div>
      <div className="dashboard-actions">
        <div className="window-picker" aria-label="Dashboard time range">
          {windows.map((option) => <button key={option.value} type="button" className={window === option.value ? "active" : ""} aria-pressed={window === option.value} onClick={() => selectWindow(option.value)}>{option.label}</button>)}
        </div>
        {!data.activeSession && <Link href="/practice/random/" className="primary-button"><BookOpen className="size-4" /> Start practice</Link>}
      </div>
    </div>

    {error && <p className="form-error mb-5" role="alert">{error}</p>}
    {loading && <div className="analytics-loading"><LoaderCircle className="size-4 animate-spin" /> Updating analytics</div>}

    {data.activeSession && <section className="active-session-card">
      <div className="active-session-icon"><BookOpen className="size-5" /></div>
      <div><p className="eyebrow text-white/65">Active session</p><h2>{data.activeSession.subject} · {data.activeSession.resolved} of {data.activeSession.requestedCount} complete</h2><p>{data.activeSession.cleanSolved} clean solves · {data.activeSession.timedAttempts ? formatDuration(data.activeSession.activeTimeMs) : "Timing starts with your next answer"}</p></div>
      <Link href={`/practice/session/?session=${data.activeSession.id}`} className="active-session-link">Resume <ArrowRight className="size-4" /></Link>
    </section>}

    {data.snapshot.total === 0 && <div className="empty-banner"><BookOpen className="size-6" /><div><p className="font-bold">The question bank is not ready yet.</p><p className="text-sm">Analytics will appear after the nightly authorized synchronization completes.</p></div></div>}

    <section aria-labelledby="period-summary-title">
      <div className="section-heading"><div><p className="eyebrow">Selected period</p><h2 id="period-summary-title" className="section-title">Performance summary</h2></div><p>{windows.find((item) => item.value === data.window)?.label} · {data.timezone}</p></div>
      <div className="kpi-grid">
        <article className="analytics-kpi analytics-kpi-primary"><span className="kpi-icon"><CheckCircle2 className="size-5" /></span><p className="metric-label">Questions completed</p><p className="metric-value">{data.summary.completed.toLocaleString()}</p><p className="kpi-detail">Resolved questions, including retries</p></article>
        <article className="analytics-kpi"><span className="kpi-icon"><Target className="size-5" /></span><p className="metric-label">Clean-solve rate</p><p className="metric-value">{data.summary.cleanSolveRate === null ? "—" : `${data.summary.cleanSolveRate}%`}</p><p className="kpi-detail">{data.summary.cleanSolved} of {data.summary.completed} on the first try</p><Delta value={data.summary.cleanSolveDelta} /></article>
        <article className="analytics-kpi"><span className="kpi-icon"><Clock3 className="size-5" /></span><p className="metric-label">Active study time</p><p className="metric-value">{data.summary.timedAttempts ? formatDuration(data.summary.activeTimeMs) : "—"}</p><p className="kpi-detail">{data.summary.timedAttempts ? `${data.summary.timedAttempts} timed attempts` : "Timing starts with new attempts"}</p></article>
        <article className="analytics-kpi"><span className="kpi-icon"><CalendarDays className="size-5" /></span><p className="metric-label">Practice rhythm</p><p className="metric-value">{data.summary.practiceDays}d</p><p className="kpi-detail">Active days in this period</p><span className="streak-detail"><Flame className="size-3.5" /> {data.summary.currentStreak}-day current streak</span></article>
        <article className="analytics-kpi"><span className="kpi-icon"><TrendingUp className="size-5" /></span><p className="metric-label">Newly mastered</p><p className="metric-value">{data.summary.newlyMastered.toLocaleString()}</p><p className="kpi-detail">Clean first attempts added to mastery</p></article>
      </div>
    </section>

    <div className="analytics-main-grid">
      <section className="analytics-panel coverage-panel" aria-labelledby="coverage-title">
        <div className="section-heading"><div><p className="eyebrow">Current snapshot</p><h2 id="coverage-title" className="section-title">Bank coverage</h2></div><p>{data.snapshot.total.toLocaleString()} eligible questions</p></div>
        <div className="coverage-total"><strong>{Math.round(data.snapshot.mastered * 100 / total)}%</strong><span>mastered</span></div>
        <CoverageBar {...data.snapshot} />
        <div className="coverage-legend">
          <span><i className="coverage-mastered" /><strong>{data.snapshot.mastered.toLocaleString()}</strong> Mastered</span>
          <span><i className="coverage-review" /><strong>{data.snapshot.review.toLocaleString()}</strong> Review</span>
          <span><i className="coverage-unseen" /><strong>{data.snapshot.unseen.toLocaleString()}</strong> Unseen</span>
        </div>
        <div className="coverage-sections">{data.sections.map((item) => <article key={item.key}>
          <div><strong>{item.label}</strong><span>{item.mastered}/{item.total} mastered</span></div><b>{coveragePercent(item)}%</b>
          <CoverageBar mastered={item.mastered} review={item.review} unseen={item.unseen} total={item.total} />
        </article>)}</div>
      </section>

      <section className="analytics-panel review-panel" aria-labelledby="review-title">
        <div className="section-heading"><div><p className="eyebrow">Current snapshot</p><h2 id="review-title" className="section-title">Review queue</h2></div><span className="review-total">{data.reviewAnalytics.total}</span></div>
        <p className="panel-copy">{data.reviewAnalytics.repeatedMisses} questions have been missed cleanly more than once.</p>
        <div className="review-age-chart">
          {[
            ["0–7 days", data.reviewAnalytics.ageBuckets.fresh],
            ["8–30 days", data.reviewAnalytics.ageBuckets.aging],
            ["30+ days", data.reviewAnalytics.ageBuckets.stale],
          ].map(([label, count]) => <div key={String(label)}><span>{label}</span><div><i style={{ width: `${Number(count) * 100 / reviewMax}%` }} /></div><strong>{count}</strong></div>)}
        </div>
        <div className="review-section-split">{data.reviewAnalytics.bySection.map((item) => <span key={item.section}><strong>{item.count}</strong> {item.label}</span>)}</div>
      </section>
    </div>

    <section className="analytics-panel mt-6" aria-labelledby="trend-title">
      <div className="section-heading"><div><p className="eyebrow">Activity over time</p><h2 id="trend-title" className="section-title">Performance trend</h2></div><p>Rates always include their question count</p></div>
      <TrendChart data={data} />
    </section>

    <section className="mt-10" aria-labelledby="comparison-title">
      <div className="section-heading"><div><p className="eyebrow">Performance split</p><h2 id="comparison-title" className="section-title">Section and difficulty</h2></div><p>Median pace appears after 3 timed attempts</p></div>
      <div className="comparison-grid">{[...data.sections, ...data.difficulties].map((item) => <ComparisonCard key={`${item.key}:${item.label}`} item={item} />)}</div>
    </section>

    <section className="mt-10" aria-labelledby="attention-title">
      <div className="section-heading"><div><p className="eyebrow">Diagnostic view</p><h2 id="attention-title" className="section-title">Needs attention</h2></div><p>{data.skills.some((skill) => skill.completed >= 5) ? "Lowest clean-solve skills with n≥5" : "Largest review piles until more evidence accumulates"}</p></div>
      {attentionSkills.length ? <div className="attention-grid">{attentionSkills.map((skill, index) => <article className="attention-card" key={skill.key}>
        <span className="attention-rank">{index + 1}</span><div><strong>{skill.skill}</strong><p>{skill.domain} · {skill.section === "math" ? "Math" : "Reading & Writing"}</p></div>
        <div className="attention-metrics"><span><b>{skill.cleanSolveRate === null ? "—" : `${skill.cleanSolveRate}%`}</b> clean · n={skill.completed}</span><span><b>{skill.review}</b> review · <b>{formatPace(skill.medianFirstAttemptMs)}</b> pace</span></div>
      </article>)}</div> : <div className="analytics-empty"><CheckCircle2 className="size-6" /><p>No skill has enough activity or review history to rank yet.</p></div>}
    </section>

    <section className="analytics-panel mt-6" aria-labelledby="skills-title">
      <div className="section-heading"><div><p className="eyebrow">All domains and skills</p><h2 id="skills-title" className="section-title">Skill diagnostics</h2></div><p>Click any column to sort</p></div>
      <SkillTable skills={[...data.skills]} />
    </section>

    <div className="analytics-lower-grid">
      <section className="analytics-panel" aria-labelledby="review-skills-title">
        <div className="section-heading"><div><p className="eyebrow">Review composition</p><h2 id="review-skills-title" className="section-title">Top review skills</h2></div></div>
        {data.reviewAnalytics.topSkills.length ? <div className="review-skill-list">{data.reviewAnalytics.topSkills.map((skill) => <div key={`${skill.section}:${skill.domain}:${skill.skill}`}>
          <span><strong>{skill.skill}</strong><small>{skill.domain} · {skill.section === "math" ? "Math" : "Reading & Writing"}</small></span>
          <span><strong>{skill.count}</strong><small>{skill.repeatedMisses} repeat misses</small></span>
        </div>)}</div> : <div className="analytics-empty compact"><CheckCircle2 className="size-6" /><p>Your review queue is clear.</p></div>}
      </section>

      <section className="analytics-panel" aria-labelledby="sessions-title">
        <div className="section-heading"><div><p className="eyebrow">Practice history</p><h2 id="sessions-title" className="section-title">Recent sessions</h2></div><p>Latest 10</p></div>
        {data.recentSessions.length ? <div className="session-list">{data.recentSessions.map((session) => <article key={session.id}>
          <div><strong>{session.subject}</strong><span className={`session-status ${session.status}`}>{session.status}</span><small>{formatDate(session.createdAt)}</small></div>
          <div><span><b>{session.resolved}/{session.requestedCount}</b> complete</span><span><b>{session.cleanSolveRate === null ? "—" : `${session.cleanSolveRate}%`}</b> clean · n={session.resolved}</span><span><b>{session.retries}</b> retries</span><span><b>{session.timedAttempts ? formatDuration(session.activeTimeMs) : "—"}</b> active</span></div>
        </article>)}</div> : <div className="analytics-empty compact"><RotateCcw className="size-6" /><p>Completed and abandoned sessions will appear here.</p></div>}
      </section>
    </div>
  </main>;
}
