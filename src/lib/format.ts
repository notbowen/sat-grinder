import type { DashboardData } from "@/lib/supabase-api";

export function formatDuration(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) return milliseconds ? "<1m" : "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
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

export const windowOptions: { value: DashboardData["window"]; label: string; phrase: string }[] = [
  { value: "1d", label: "1 day", phrase: "the last day" },
  { value: "14d", label: "2 weeks", phrase: "the last two weeks" },
  { value: "30d", label: "1 month", phrase: "the last month" },
  { value: "all", label: "All time", phrase: "all time" },
];
