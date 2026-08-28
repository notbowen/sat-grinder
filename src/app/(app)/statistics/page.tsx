"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CheckCircle2, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { ColumnChart, HBarList, LineChart, SegmentBar } from "@/components/charts";
import { getDashboard, type DashboardBreakdown, type DashboardData, type DashboardWindow } from "@/lib/supabase-api";
import { domainRollups, sliceTotals, sortSkills, type SkillSort } from "@/lib/analytics";
import { coveragePercent, formatDate, formatDuration, formatPace, formatPercent, formatSigned, formatTrendDate, sectionLabel, windowOptions } from "@/lib/format";

type SectionFilter = "all" | "math" | "reading-writing";
type SortDirection = "asc" | "desc";

const sectionOptions: { value: SectionFilter; label: string }[] = [
  { value: "all", label: "All sections" },
  { value: "reading-writing", label: "Reading & Writing" },
  { value: "math", label: "Math" },
];

function segments(item: { mastered: number; review: number; unseen: number }) {
  return [
    { key: "mastered", label: "Mastered", value: item.mastered, fill: "mastered" as const },
    { key: "review", label: "In review", value: item.review, fill: "review" as const },
    { key: "unseen", label: "Unseen", value: item.unseen, fill: "unseen" as const },
  ];
}

function CompareCard({ item }: { item: DashboardBreakdown }) {
  return <article className="compare-card">
    <p className="stat-label">{item.label}</p>
    <p className="stat-value">{formatPercent(item.cleanSolveRate)}</p>
    <p className="stat-detail">Clean solve · n={item.completed}</p>
    <SegmentBar segments={segments(item)} total={item.total} thin />
    <div className="compare-details">
      <span><strong>{coveragePercent(item)}%</strong> bank complete</span>
      <span><strong>{formatPercent(item.retryRate)}</strong> retried</span>
      <span><strong>{formatPace(item.medianFirstAttemptMs)}</strong> median pace</span>
    </div>
  </article>;
}

export default function StatisticsPage() {
  const [window, setWindow] = useState<DashboardWindow>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionFilter>("all");
  const [domain, setDomain] = useState("all");
  const [query, setQuery] = useState("");
  const [minSample, setMinSample] = useState(false);
  const [sort, setSort] = useState<SkillSort>("review");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [sessionStatus, setSessionStatus] = useState<"all" | "completed" | "abandoned">("all");

  useEffect(() => {
    let cancelled = false;
    void getDashboard(window).then((result) => { if (!cancelled) setData(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Statistics unavailable."); })
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
    else { setSort(next); setDirection(next === "skill" ? "asc" : "desc"); }
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
  const rollups = useMemo(() => domainRollups(filteredSkills), [filteredSkills]);
  const sortedSkills = useMemo(() => sortSkills(filteredSkills, sort, direction), [direction, filteredSkills, sort]);
  const reviewSkills = useMemo(() => {
    if (!data) return [];
    return data.reviewAnalytics.topSkills.filter((skill) => (section === "all" || skill.section === section)
      && (domain === "all" || skill.domain === domain)
      && (!normalizedQuery || `${skill.skill} ${skill.domain}`.toLowerCase().includes(normalizedQuery)));
  }, [data, domain, normalizedQuery, section]);
  const sessions = useMemo(() => data ? data.recentSessions.filter((session) => sessionStatus === "all" || session.status === sessionStatus) : [], [data, sessionStatus]);
  const trend = useMemo(() => {
    if (!data) return { completed: [], rate: [], time: [] };
    const label = (start: string) => formatTrendDate(start, data.trendGranularity);
    return {
      completed: data.trend.map((point) => ({ label: label(point.start), value: point.completed, detail: `${point.cleanSolved} clean` })),
      rate: data.trend.map((point) => ({ label: label(point.start), value: point.cleanSolveRate, detail: `n=${point.completed}` })),
      time: data.trend.map((point) => ({ label: label(point.start), value: Math.round(point.activeTimeMs / 60_000), detail: `${point.timedAttempts} timed attempts` })),
    };
  }, [data]);

  if (!data && loading) return <main className="loading-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading statistics" /></main>;
  if (!data) return <main className="page"><p className="form-error" role="alert">{error || "Statistics unavailable."}</p></main>;

  const selected = windowOptions.find((option) => option.value === data.window) ?? windowOptions[2];
  const filtersActive = section !== "all" || domain !== "all" || normalizedQuery !== "" || minSample;
  const rateMax = 100;

  return <main className="page" aria-busy={loading} style={{ opacity: loading ? .6 : 1, transition: "opacity .15s ease" }}>
    <div className="page-head">
      <div>
        <p className="eyebrow">Statistics</p>
        <h1 className="page-title">Every number, with its denominator.</h1>
        <p className="page-subtitle">Filter by section, domain, or skill. Every rate is recomputed from the filtered counts.</p>
      </div>
      <div className="page-head-actions">
        <div className="seg" role="group" aria-label="Statistics time range">
          {windowOptions.map((option) => <button key={option.value} type="button" className={window === option.value ? "active" : ""} aria-pressed={window === option.value} onClick={() => selectWindow(option.value)}>{option.label}</button>)}
        </div>
      </div>
    </div>

    {error && <p className="form-error mt-6" role="alert">{error}</p>}
    {loading && <p className="loading-inline mt-4"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Updating</p>}

    <div className="filter-row mt-8" role="group" aria-label="Skill filters">
      <div className="seg" role="group" aria-label="Filter by section">
        {sectionOptions.map((option) => <button key={option.value} type="button" className={section === option.value ? "active" : ""} aria-pressed={section === option.value} onClick={() => changeSection(option.value)}>{option.label}</button>)}
      </div>
      <label className="field"><span>Domain</span><select className="select" value={domain} onChange={(event) => setDomain(event.target.value)}>
        <option value="all">All domains</option>
        {domains.map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
      <label className="field field-grow"><span>Search skills</span><span style={{ position: "relative" }}><input className="input" type="search" placeholder="e.g. Linear equations" value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingRight: "2.25rem" }} /><Search className="size-4" aria-hidden="true" style={{ position: "absolute", right: ".7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} /></span></label>
      <label className="checkbox-field"><input type="checkbox" checked={minSample} onChange={(event) => setMinSample(event.target.checked)} /> n ≥ 5 only</label>
      {filtersActive && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw className="size-3.5" aria-hidden="true" /> Reset</button>}
    </div>
    <p className="filter-meta" aria-live="polite">
      <span><strong>{filteredSkills.length}</strong> of {data.skills.length} skills</span>
      <span><strong>{slice.completed.toLocaleString()}</strong> completed</span>
      <span><strong>{formatPercent(slice.cleanSolveRate)}</strong> clean solve</span>
      <span><strong>{slice.review.toLocaleString()}</strong> in review</span>
      <span>{selected.label} · {data.timezone}</span>
    </p>

    <section className="section" aria-labelledby="slice-title">
      <div className="section-head"><div><span className="section-index">01</span><h2 id="slice-title" className="section-title">Filtered slice</h2></div><p>{filtersActive ? "Recomputed from matching skills" : "All skills"}</p></div>
      <div className="stat-grid stat-grid-4">
        <article className="stat"><p className="stat-label">Completed</p><p className="stat-value">{slice.completed.toLocaleString()}</p><p className="stat-detail">Resolved in {selected.phrase}</p></article>
        <article className="stat"><p className="stat-label">Clean-solve rate</p><p className="stat-value">{formatPercent(slice.cleanSolveRate)}</p><p className="stat-detail">{slice.cleanSolved} of {slice.completed} on the first try</p></article>
        <article className="stat"><p className="stat-label">Retry rate</p><p className="stat-value">{formatPercent(slice.retryRate)}</p><p className="stat-detail">{slice.retried} needed a second attempt</p></article>
        <article className="stat"><p className="stat-label">Bank complete</p><p className="stat-value">{coveragePercent(slice)}%</p><p className="stat-detail">{slice.mastered.toLocaleString()} of {slice.total.toLocaleString()} mastered</p><div className="mt-2 pr-4"><SegmentBar segments={segments(slice)} total={slice.total} thin /></div></article>
      </div>
    </section>

    <div className="section grid-12">
      <section className="span-5" aria-labelledby="domain-title">
        <div className="section-head"><div><span className="section-index">02</span><h2 id="domain-title" className="section-title">By domain</h2></div><p>Clean-solve rate</p></div>
        <div className="panel">
          {rollups.length ? <HBarList rows={rollups.map((group) => ({
            key: group.key, label: group.domain, sub: `${sectionLabel(group.section)} · ${group.skills} skill${group.skills === 1 ? "" : "s"}`,
            value: group.cleanSolveRate ?? 0, max: rateMax, display: formatPercent(group.cleanSolveRate), detail: `n=${group.completed}`,
          }))} /> : <div className="chart-empty compact">No domains match these filters.</div>}
        </div>
      </section>
      <section className="span-7" aria-labelledby="domain-table-title">
        <div className="section-head"><div><span className="section-index">03</span><h2 id="domain-table-title" className="section-title">Domain detail</h2></div><p>Counts behind the rates</p></div>
        <div className="panel"><div className="table-wrap"><table className="data-table">
          <thead><tr><th>Domain</th><th>Completed</th><th>Clean solve</th><th>Retry</th><th>Bank complete</th><th>Review</th></tr></thead>
          <tbody>{rollups.map((group) => <tr key={group.key}>
            <td><strong>{group.domain}</strong><small>{sectionLabel(group.section)}</small></td>
            <td>{group.completed}</td>
            <td><strong>{formatPercent(group.cleanSolveRate)}</strong><small>{group.cleanSolved} clean</small></td>
            <td>{formatPercent(group.retryRate)}</td>
            <td><strong>{coveragePercent(group)}%</strong><small>{group.mastered}/{group.total}</small></td>
            <td>{group.review}</td>
          </tr>)}</tbody>
        </table></div></div>
      </section>
    </div>

    <section className="section" aria-labelledby="skills-title">
      <div className="section-head"><div><span className="section-index">04</span><h2 id="skills-title" className="section-title">Skill diagnostics</h2></div><p>{sortedSkills.length} rows · click a column to sort</p></div>
      <div className="panel"><div className="table-wrap"><table className="data-table" style={{ minWidth: 1040 }}>
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
        <tbody>{sortedSkills.map((skill) => <tr key={skill.key}>
          <td><strong>{skill.skill}</strong><small>{skill.domain} · {sectionLabel(skill.section)}</small></td>
          <td><strong>{skill.completed}</strong><small>resolved</small></td>
          <td><strong>{formatPercent(skill.cleanSolveRate)}</strong><small>n={skill.completed}</small></td>
          <td><strong>{formatPercent(skill.retryRate)}</strong><small>{skill.retried} retried</small></td>
          <td><strong>{formatPace(skill.medianFirstAttemptMs)}</strong><small>{skill.timedFirstAttempts} timed</small></td>
          <td><strong>{coveragePercent(skill)}%</strong><small>{skill.mastered}/{skill.total}</small></td>
          <td><strong style={skill.review ? { color: "var(--accent)" } : undefined}>{skill.review}</strong><small>questions</small></td>
          <td><strong>{formatSigned(skill.cleanSolveDelta)}</strong><small>{skill.previousCompleted ? `prior n=${skill.previousCompleted}` : "not enough data"}</small></td>
        </tr>)}</tbody>
      </table></div>
      {!sortedSkills.length && <div className="chart-empty compact mt-4">No skills match these filters.</div>}</div>
    </section>

    <section className="section" aria-labelledby="comparison-title">
      <div className="section-head"><div><span className="section-index">05</span><h2 id="comparison-title" className="section-title">Section and difficulty</h2></div><p>Whole bank · pace needs 3 timed attempts</p></div>
      <div className="compare-grid">{[...data.sections, ...data.difficulties].map((item) => <CompareCard key={`${item.key}:${item.label}`} item={item} />)}</div>
    </section>

    <section className="section" aria-labelledby="trend-title">
      <div className="section-head"><div><span className="section-index">06</span><h2 id="trend-title" className="section-title">Trend detail</h2></div><p>Whole bank · per {data.trendGranularity}</p></div>
      <div className="grid-12">
        <div className="span-4 panel"><ColumnChart title="Questions completed" points={trend.completed} format={(value) => value.toLocaleString()} unit="Completed" height={170} /></div>
        <div className="span-4 panel"><LineChart title="Clean-solve rate" points={trend.rate} format={(value) => `${Math.round(value)}%`} unit="Clean solve" height={170} /></div>
        <div className="span-4 panel"><ColumnChart title="Active time" subtitle="Minutes of timed work" points={trend.time} format={(value) => `${value}m`} unit="Minutes" height={170} emptyMessage="Timing starts with new attempts." /></div>
      </div>
    </section>

    <div className="section grid-12">
      <section className="span-5" aria-labelledby="review-title">
        <div className="section-head"><div><span className="section-index">07</span><h2 id="review-title" className="section-title">Review composition</h2></div><p>{data.reviewAnalytics.total} in queue</p></div>
        <div className="panel">
          {reviewSkills.length ? <div className="list-rows">{reviewSkills.map((skill) => <div key={`${skill.section}:${skill.domain}:${skill.skill}`}>
            <span><strong>{skill.skill}</strong><small>{skill.domain} · {sectionLabel(skill.section)} · oldest miss {formatDate(skill.oldestAnsweredAt)}</small></span>
            <span className="num-cell"><strong>{skill.count}</strong><small>{skill.repeatedMisses} repeat {skill.repeatedMisses === 1 ? "miss" : "misses"}</small></span>
          </div>)}</div> : <div className="chart-empty compact"><CheckCircle2 className="size-5" aria-hidden="true" /><p>{filtersActive ? "No review skills match these filters." : "Your review queue is clear."}</p></div>}
        </div>
      </section>

      <section className="span-7" id="sessions" aria-labelledby="sessions-title">
        <div className="section-head"><div><span className="section-index">08</span><h2 id="sessions-title" className="section-title">Sessions</h2></div>
          <div className="seg" role="group" aria-label="Filter sessions by status">
            {(["all", "completed", "abandoned"] as const).map((value) => <button key={value} type="button" className={sessionStatus === value ? "active" : ""} aria-pressed={sessionStatus === value} onClick={() => setSessionStatus(value)}>{value === "all" ? "All" : value}</button>)}
          </div>
        </div>
        <div className="panel">
          {sessions.length ? <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Session</th><th>Date</th><th>Complete</th><th>Clean solve</th><th>Retries</th><th>Active</th></tr></thead>
            <tbody>{sessions.map((session) => <tr key={session.id}>
              <td><strong>{session.subject}</strong><small><span className={`status-pill ${session.status}`}>{session.status}</span></small></td>
              <td>{formatDate(session.createdAt)}</td>
              <td><strong>{session.resolved}/{session.requestedCount}</strong></td>
              <td><strong>{formatPercent(session.cleanSolveRate)}</strong><small>n={session.resolved}</small></td>
              <td>{session.retries}</td>
              <td>{session.timedAttempts ? formatDuration(session.activeTimeMs) : "—"}</td>
            </tr>)}</tbody>
          </table></div> : <div className="chart-empty compact">No sessions match this filter.</div>}
          <p className="small muted mt-4">Latest 10 sessions in {selected.phrase}.</p>
        </div>
      </section>
    </div>
  </main>;
}
