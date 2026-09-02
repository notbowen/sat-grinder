"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, BookOpen, LoaderCircle, RotateCcw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { ColumnChart, HBarList, LineChart, SegmentBar } from "@/components/charts";
import { getDashboard, type DashboardBreakdown, type DashboardData, type DashboardWindow } from "@/lib/supabase-api";
import { sliceTotals, sortSkills, type SkillSort } from "@/lib/analytics";
import { coveragePercent, formatDate, formatDuration, formatPace, formatPercent, formatSigned, formatTrendDate, plural, sectionLabel, subjectLabel, windowOptions } from "@/lib/format";

type SectionFilter = "all" | "math" | "reading-writing";
type SortDirection = "asc" | "desc";
type SetStatus = "all" | "completed" | "abandoned";

const INITIAL_ROWS = 8;
const sectionOptions: { value: SectionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reading-writing", label: "Reading & Writing" },
  { value: "math", label: "Math" },
];
const setStatusOptions: { value: SetStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Stopped" },
];

function segments(item: { mastered: number; review: number; unseen: number }) {
  return [
    { key: "mastered", label: "Mastered", value: item.mastered, fill: "mastered" as const },
    { key: "review", label: "In review", value: item.review, fill: "review" as const },
    { key: "unseen", label: "Unseen", value: item.unseen, fill: "unseen" as const },
  ];
}

function Delta({ value, prior }: { value: number | null; prior: string }) {
  if (value === null) return <span className="stat-delta flat">n&lt;5 in a period</span>;
  const positive = value >= 0;
  return <span className={`stat-delta ${positive ? "up" : "down"}`}>
    {positive ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
    {positive ? "+" : ""}{value} pts {prior}
  </span>;
}

function CoverageRow({ item }: { item: DashboardBreakdown }) {
  return <article>
    <div><strong>{item.label}</strong><span>{item.mastered.toLocaleString()} of {item.total.toLocaleString()} · {item.review} in review</span></div>
    <b>{coveragePercent(item)}%</b>
    <SegmentBar segments={segments(item)} total={item.total} thin />
  </article>;
}

export default function ProgressPage() {
  const [window, setWindow] = useState<DashboardWindow>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionFilter>("all");
  const [domain, setDomain] = useState("all");
  const [query, setQuery] = useState("");
  const [minSample, setMinSample] = useState(false);
  const [sort, setSort] = useState<SkillSort>("accuracy");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [showAll, setShowAll] = useState(false);
  const [setStatus, setSetStatus] = useState<SetStatus>("all");

  useEffect(() => {
    let cancelled = false;
    void getDashboard(window).then((result) => { if (!cancelled) setData(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Progress unavailable."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [window]);

  function selectWindow(nextWindow: DashboardWindow) {
    if (nextWindow === window) return;
    setLoading(true); setError(""); setWindow(nextWindow);
  }
  function changeSection(next: SectionFilter) { setSection(next); setDomain("all"); }
  function resetFilters() { setSection("all"); setDomain("all"); setQuery(""); setMinSample(false); }
  function changeSort(next: SkillSort) {
    if (sort === next) setDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSort(next); setDirection(next === "skill" || next === "accuracy" ? "asc" : "desc"); }
  }
  function heading(label: string, key: SkillSort) {
    return <button type="button" className="sort-btn" onClick={() => changeSort(key)} aria-label={`Sort by ${label}`} aria-pressed={sort === key}>{label}<ArrowDownUp className="size-3" aria-hidden="true" /></button>;
  }

  const domains = useMemo(() => {
    if (!data) return [];
    const names = new Set(data.skills.filter((skill) => section === "all" || skill.section === section).map((skill) => skill.domain));
    return [...names].sort();
  }, [data, section]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSkills = useMemo(() => {
    if (!data) return [];
    return data.skills.filter((skill) => (section === "all" || skill.section === section)
      && (domain === "all" || skill.domain === domain)
      && (!normalizedQuery || `${skill.skill} ${skill.domain}`.toLowerCase().includes(normalizedQuery))
      && (!minSample || skill.completed >= 5));
  }, [data, domain, minSample, normalizedQuery, section]);
  const slice = useMemo(() => sliceTotals(filteredSkills), [filteredSkills]);
  const sortedSkills = useMemo(() => sortSkills(filteredSkills, sort, direction), [direction, filteredSkills, sort]);
  const sets = useMemo(() => data ? data.recentSessions.filter((set) => setStatus === "all" || set.status === setStatus) : [], [data, setStatus]);
  const trend = useMemo(() => {
    if (!data) return { completed: [], rate: [] };
    const label = (start: string) => formatTrendDate(start, data.trendGranularity);
    return {
      completed: data.trend.map((point) => ({ label: label(point.start), value: point.completed, detail: `${point.cleanSolved} clean` })),
      rate: data.trend.map((point) => ({ label: label(point.start), value: point.cleanSolveRate, detail: `n=${point.completed}` })),
    };
  }, [data]);

  if (!data && loading) return <main className="loading-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading progress" /></main>;
  if (!data) return <main className="page"><p className="form-error" role="alert">{error || "Progress unavailable."}</p></main>;

  const selected = windowOptions.find((option) => option.value === data.window) ?? windowOptions[2];
  const filtersActive = section !== "all" || domain !== "all" || normalizedQuery !== "" || minSample;
  const summary = data.summary;
  const retryRate = summary.completed ? Math.round(summary.retried * 1000 / summary.completed) / 10 : null;
  const masteredPercent = coveragePercent(data.snapshot);
  const review = data.reviewAnalytics;
  const ageBuckets = review.ageBuckets;
  const reviewMax = Math.max(ageBuckets.fresh, ageBuckets.aging, ageBuckets.stale, 1);
  const visibleSkills = showAll ? sortedSkills : sortedSkills.slice(0, INITIAL_ROWS);
  const hiddenSkills = sortedSkills.length - visibleSkills.length;
  const weakestFirst = sort === "accuracy" && direction === "asc";

  return <main className="page" aria-busy={loading} style={{ opacity: loading ? .6 : 1, transition: "opacity .15s ease" }}>
    <div className="page-head">
      <div>
        <p className="eyebrow">Progress</p>
        <h1 className="page-title">{selected.phrase}.</h1>
      </div>
      <div className="page-head-actions">
        <p className="small muted">Days in {data.timezone}</p>
        <div className="seg" role="group" aria-label="Time range">
          {windowOptions.map((option) => <button key={option.value} type="button" className={window === option.value ? "active" : ""} aria-pressed={window === option.value} onClick={() => selectWindow(option.value)}>{option.label}</button>)}
        </div>
      </div>
    </div>

    {error && <p className="form-error mt-6" role="alert">{error}</p>}
    {loading && <p className="loading-inline mt-4"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Updating</p>}
    {data.snapshot.total === 0 && <div className="empty-banner"><BookOpen className="size-5" aria-hidden="true" /><div><p>No questions yet.</p><p className="small">The bank syncs nightly.</p></div></div>}

    <section className="section" aria-labelledby="summary-title">
      <div className="section-head"><div><span className="section-index">01</span><h2 id="summary-title" className="section-title">Summary</h2></div></div>
      <div className="stat-grid">
        <article className="stat"><p className="stat-label">Completed</p><p className="stat-value num">{summary.completed.toLocaleString()}</p><p className="stat-detail">incl. retries</p></article>
        <article className="stat"><p className="stat-label">Clean solve</p><p className="stat-value num">{formatPercent(summary.cleanSolveRate)}</p><p className="stat-detail">{summary.cleanSolved} of {summary.completed} first try</p><Delta value={summary.cleanSolveDelta} prior={selected.prior} /></article>
        <article className="stat"><p className="stat-label">Active time</p><p className="stat-value num">{summary.timedAttempts ? formatDuration(summary.activeTimeMs) : "—"}</p><p className="stat-detail">{summary.timedAttempts ? `${summary.timedAttempts} timed` : "Nothing timed yet."}</p></article>
        <article className="stat"><p className="stat-label">Retried</p><p className="stat-value num">{formatPercent(retryRate)}</p><p className="stat-detail">{summary.retried} of {summary.completed} needed a second try</p></article>
      </div>
    </section>

    <section className="section" aria-labelledby="trend-title">
      <div className="section-head"><div><span className="section-index">02</span><h2 id="trend-title" className="section-title">Trend</h2></div><p>per {data.trendGranularity}</p></div>
      <div className="panel grid-12">
        <div className="span-6"><ColumnChart title="Completed" points={trend.completed} format={(value) => value.toLocaleString()} unit="Completed" emptyMessage="Nothing this period." /></div>
        <div className="span-6"><LineChart title="Clean solve" points={trend.rate} format={(value) => `${Math.round(value)}%`} unit="Clean solve" emptyMessage="No answers yet." /></div>
      </div>
    </section>

    <div className="section grid-12">
      <section className="span-7" aria-labelledby="coverage-title">
        <div className="section-head"><div><span className="section-index">03</span><h2 id="coverage-title" className="section-title">Coverage</h2></div><p>{data.snapshot.total.toLocaleString()} questions</p></div>
        <div className="panel">
          <p className="stat-label">Mastered</p>
          <div className="hero-number-row"><p className="hero-number num">{masteredPercent}%</p><span>{data.snapshot.mastered.toLocaleString()} of {data.snapshot.total.toLocaleString()}</span></div>
          <div className="mt-5"><SegmentBar segments={segments(data.snapshot)} total={data.snapshot.total} legend /></div>
          <div className="coverage-sections">{[...data.sections, ...data.difficulties].map((item) => <CoverageRow key={`${item.key}:${item.label}`} item={item} />)}</div>
        </div>
      </section>

      <section className="span-5" aria-labelledby="review-title">
        <div className="section-head"><div><span className="section-index">04</span><h2 id="review-title" className="section-title">Review</h2></div><p>now</p></div>
        <div className="panel">
          <div className="hero-number-row"><p className="hero-number num">{review.total}</p><span>in review</span></div>
          {review.total ? <>
            <p className="panel-copy mt-3">{review.repeatedMisses} missed twice or more. Age is since the last miss.</p>
            <div className="mt-5"><HBarList accent rows={[
              { key: "fresh", label: "0–7 days", value: ageBuckets.fresh, max: reviewMax, display: String(ageBuckets.fresh) },
              { key: "aging", label: "8–30 days", value: ageBuckets.aging, max: reviewMax, display: String(ageBuckets.aging) },
              { key: "stale", label: "30+ days", value: ageBuckets.stale, max: reviewMax, display: String(ageBuckets.stale) },
            ]} /></div>
            <div className="review-split mt-5">{review.bySection.map((item) => <span key={item.section} className="chip chip-plain">{item.count} {item.label}</span>)}</div>
          </> : <p className="panel-copy mt-3">Nothing in review.</p>}
        </div>
      </section>
    </div>

    <section className="section" aria-labelledby="skills-title">
      <div className="section-head"><div><span className="section-index">05</span><h2 id="skills-title" className="section-title">Skills</h2></div><p>{filtersActive ? `${sortedSkills.length} of ${data.skills.length}` : `${data.skills.length} ${plural(data.skills.length, "skill")}`}{weakestFirst ? " · weakest first" : ""}</p></div>
      <div className="filter-row" role="group" aria-label="Skill filters">
        <div className="seg" role="group" aria-label="Section">
          {sectionOptions.map((option) => <button key={option.value} type="button" className={section === option.value ? "active" : ""} aria-pressed={section === option.value} onClick={() => changeSection(option.value)}>{option.label}</button>)}
        </div>
        <label className="field"><span>Domain</span><select className="select" value={domain} onChange={(event) => setDomain(event.target.value)}>
          <option value="all">All domains</option>
          {domains.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <label className="field field-grow"><span>Search</span><span style={{ position: "relative" }}><input className="input" type="search" placeholder="e.g. Linear equations" value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingRight: "2.25rem" }} /><Search className="size-4" aria-hidden="true" style={{ position: "absolute", right: ".7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} /></span></label>
        <label className="checkbox-field"><input type="checkbox" checked={minSample} onChange={(event) => setMinSample(event.target.checked)} /> n ≥ 5</label>
        {filtersActive && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw className="size-3.5" aria-hidden="true" /> Reset</button>}
      </div>
      {filtersActive && <p className="filter-meta" aria-live="polite">
        <span><strong>{slice.completed.toLocaleString()}</strong> completed</span>
        <span><strong>{formatPercent(slice.cleanSolveRate)}</strong> clean solve</span>
        <span><strong>{slice.review.toLocaleString()}</strong> in review</span>
      </p>}
      {sortedSkills.length ? <div className="table-wrap panel-flat mt-5"><table className="data-table" style={{ minWidth: 960 }}>
        <thead><tr>
          <th>{heading("Skill", "skill")}</th>
          <th>{heading("Completed", "completed")}</th>
          <th>{heading("Clean solve", "accuracy")}</th>
          <th>{heading("Retry", "retry")}</th>
          <th>{heading("Pace", "time")}</th>
          <th>{heading("Coverage", "coverage")}</th>
          <th>{heading("Review", "review")}</th>
          <th>{heading("Change", "trend")}</th>
        </tr></thead>
        <tbody>{visibleSkills.map((skill) => <tr key={`${skill.key}:${skill.skill}`}>
          <td><strong>{skill.skill}</strong><small>{skill.domain} · {sectionLabel(skill.section)}</small></td>
          <td>{skill.completed}</td>
          <td><strong>{formatPercent(skill.cleanSolveRate)}</strong><small>n={skill.completed}</small></td>
          <td><strong>{formatPercent(skill.retryRate)}</strong><small>{skill.retried} retried</small></td>
          <td><strong>{formatPace(skill.medianFirstAttemptMs)}</strong><small>{skill.timedFirstAttempts} timed</small></td>
          <td><strong>{coveragePercent(skill)}%</strong><small>{skill.mastered}/{skill.total}</small></td>
          <td>{skill.review ? <strong style={{ color: "var(--accent)" }}>{skill.review}</strong> : 0}</td>
          <td><strong>{formatSigned(skill.cleanSolveDelta)}</strong><small>{skill.previousCompleted ? `prior n=${skill.previousCompleted}` : "n<5 in a period"}</small></td>
        </tr>)}</tbody>
      </table></div> : <div className="chart-empty compact mt-5">No matches.</div>}
      {hiddenSkills > 0 && <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setShowAll(true)}>{hiddenSkills} more {plural(hiddenSkills, "skill")}</button>}
      {showAll && sortedSkills.length > INITIAL_ROWS && <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setShowAll(false)}>Show fewer</button>}
    </section>

    <section className="section" id="sets" aria-labelledby="sets-title">
      <div className="section-head"><div><span className="section-index">06</span><h2 id="sets-title" className="section-title">Sets</h2></div>
        <div className="seg" role="group" aria-label="Set status">
          {setStatusOptions.map((option) => <button key={option.value} type="button" className={setStatus === option.value ? "active" : ""} aria-pressed={setStatus === option.value} onClick={() => setSetStatus(option.value)}>{option.label}</button>)}
        </div>
      </div>
      {sets.length ? <div className="table-wrap panel-flat"><table className="data-table">
        <thead><tr><th>Set</th><th>Date</th><th>Completed</th><th>Clean solve</th><th>Retries</th><th>Active time</th></tr></thead>
        <tbody>{sets.map((set) => <tr key={set.id}>
          <td><span className="row-title">{subjectLabel(set.subject)}{set.status === "abandoned" && <span className="status-pill status-muted">stopped</span>}</span></td>
          <td>{formatDate(set.createdAt)}</td>
          <td>{set.resolved}/{set.requestedCount}</td>
          <td><strong>{formatPercent(set.cleanSolveRate)}</strong><small>n={set.resolved}</small></td>
          <td>{set.retries}</td>
          <td>{set.timedAttempts ? formatDuration(set.activeTimeMs) : "—"}</td>
        </tr>)}</tbody>
      </table></div> : <div className="chart-empty compact">No matches.</div>}
    </section>
  </main>;
}
