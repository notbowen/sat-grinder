const TIMER_VISIBLE_KEY = "sat-grinder:timer-visible";
const CROSS_OUT_KEY = "sat-grinder:cross-out-enabled";
const CROSS_OUT_FALLBACK_KEY = "sat-grinder:eliminator-enabled";

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "boolean") return parsed;
  } catch {
    // Fall back to string comparison
  }
  return value === "true";
}

/** Reads timer visibility preference from localStorage, defaulting to visible (true). */
export function readTimerVisible(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return parseBoolean(localStorage.getItem(TIMER_VISIBLE_KEY), true);
  } catch {
    return true;
  }
}

/** Persists timer visibility preference to localStorage. */
export function saveTimerVisible(visible: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIMER_VISIBLE_KEY, JSON.stringify(visible));
  } catch {
    /* Preference only. */
  }
}

/** Reads cross-out tool preference from localStorage, defaulting to enabled (true). */
export function readCrossOutEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(CROSS_OUT_KEY) ?? localStorage.getItem(CROSS_OUT_FALLBACK_KEY);
    return parseBoolean(stored, true);
  } catch {
    return true;
  }
}

/** Persists cross-out tool preference to localStorage. */
export function saveCrossOutEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(enabled);
    localStorage.setItem(CROSS_OUT_KEY, serialized);
    localStorage.setItem(CROSS_OUT_FALLBACK_KEY, serialized);
  } catch {
    /* Preference only. */
  }
}
