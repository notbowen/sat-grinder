import type { PracticeSubject } from "@/lib/supabase-api";

export type SetSettings = { subject: PracticeSubject; count: number };

const key = "sat-grinder:last-set";
export const defaultSetSettings: SetSettings = { subject: "mixed", count: 10 };
const subjects: PracticeSubject[] = ["mixed", "math", "english"];

/** The mix and size of the last set started on this browser, so "Another 10" means the same 10. */
export function readLastSetSettings(): SetSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!stored || typeof stored !== "object") return defaultSetSettings;
    const { subject, count } = stored as Partial<SetSettings>;
    return {
      subject: subjects.includes(subject as PracticeSubject) ? (subject as PracticeSubject) : defaultSetSettings.subject,
      count: Number.isInteger(count) && (count as number) >= 1 && (count as number) <= 50 ? (count as number) : defaultSetSettings.count,
    };
  } catch {
    return defaultSetSettings;
  }
}

export function saveLastSetSettings(settings: SetSettings) {
  try { localStorage.setItem(key, JSON.stringify(settings)); } catch { /* Preference only. */ }
}
