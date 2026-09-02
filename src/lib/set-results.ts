/**
 * Per-question outcomes for the set in progress, kept in the browser so the
 * progress strip and the completion screen can colour every position. The
 * server only reports totals, so a set opened on another device shows counts
 * without per-question detail.
 */

export type SetResult = "clean" | "miss";
export type SetResults = Record<number, SetResult>;

const prefix = "sat-grinder:set-results:";

export function readSetResults(sessionId: string): SetResults {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(`${prefix}${sessionId}`) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const results: SetResults = {};
    for (const [key, value] of Object.entries(stored)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && (value === "clean" || value === "miss")) results[index] = value;
    }
    return results;
  } catch {
    return {};
  }
}

/** A miss is permanent for the position; a first correct answer records clean. */
export function recordSetResult(sessionId: string, index: number, correct: boolean): SetResults {
  const results = readSetResults(sessionId);
  if (!correct) results[index] = "miss";
  else if (!results[index]) results[index] = "clean";
  try { sessionStorage.setItem(`${prefix}${sessionId}`, JSON.stringify(results)); } catch { /* The strip still works for this page load. */ }
  return results;
}
