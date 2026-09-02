import type { DashboardData } from "@/lib/supabase-api";

export function formatDuration(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) return milliseconds ? "<1m" : "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

/** Minutes and seconds for a running clock: 0:07, 1:24, 12:05. */
export function formatClock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatPace(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

/** "Today", "Yesterday", or a short date for lists of recent sets. */
export function formatRelativeDay(value: string, now = new Date()) {
  const date = new Date(value);
  const startOfDay = (input: Date) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatShortDate(value);
}

/** Calendar date (YYYY-MM-DD) of "now" in the given zone; matches the dashboard's trend keys. */
export function localDateKey(timezone: string, now = new Date()) {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  try { return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timezone }).format(now); }
  catch { return new Intl.DateTimeFormat("en-CA", options).format(now); }
}

export function formatTrendDate(value: string, granularity: DashboardData["trendGranularity"]) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, granularity === "month"
    ? { month: "short", year: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

export function formatPercent(value: number | null, digits = 0) {
  return value === null ? "—" : `${value.toFixed(digits)}%`;
}

export function formatSigned(value: number | null, suffix = " pts") {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function coveragePercent(item: { total: number; mastered: number }) {
  return item.total ? Math.round(item.mastered * 100 / item.total) : 0;
}

export function sectionLabel(section: "math" | "reading-writing") {
  return section === "math" ? "Math" : "Reading & Writing";
}

/** Session subjects come from the server as "Mixed"; learners see "Mix". */
export function subjectLabel(subject: string) {
  return subject === "Mixed" ? "Mix" : subject;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

export const windowOptions: { value: DashboardData["window"]; label: string; phrase: string; prior: string }[] = [
  { value: "1d", label: "1 day", phrase: "Today", prior: "vs yesterday" },
  { value: "14d", label: "2 weeks", phrase: "The last two weeks", prior: "vs prior 2 weeks" },
  { value: "30d", label: "1 month", phrase: "The last month", prior: "vs prior month" },
  { value: "all", label: "All time", phrase: "All time", prior: "vs prior period" },
];
