import type { DashboardData } from "@/lib/supabase-api";

const breakdown = {
  total: 10, mastered: 4, review: 2, unseen: 4, completed: 8, cleanSolved: 5,
  cleanSolveRate: 62.5, retried: 3, retryRate: 37.5, timedFirstAttempts: 5,
  medianFirstAttemptMs: 75_000, previousCompleted: 6, cleanSolveDelta: 4.2,
};

export const dashboardFixture: DashboardData = {
  window: "30d", timezone: "Asia/Singapore", generatedAt: "2026-08-26T12:00:00Z", trendGranularity: "day",
  snapshot: { total: 20, mastered: 8, review: 4, unseen: 8 },
  summary: { completed: 16, cleanSolved: 10, cleanSolveRate: 62.5, cleanSolveDelta: 4.2, retried: 6, activeTimeMs: 600_000, timedAttempts: 12, practiceDays: 4, currentStreak: 3, newlyMastered: 5, previousCompleted: 14 },
  trend: [
    { start: "2026-08-25", completed: 4, cleanSolved: 3, cleanSolveRate: 75, activeTimeMs: 180_000, timedAttempts: 4 },
    { start: "2026-08-26", completed: 6, cleanSolved: 3, cleanSolveRate: 50, activeTimeMs: 240_000, timedAttempts: 6 },
  ],
  sections: [
    { key: "reading-writing", label: "Reading & Writing", ...breakdown },
    { key: "math", label: "Math", ...breakdown },
  ],
  difficulties: [
    { key: "medium", label: "Medium", ...breakdown },
    { key: "hard", label: "Hard", ...breakdown },
  ],
  skills: [
    { key: "math:a:low", section: "math", domain: "Algebra", skill: "Lower accuracy", ...breakdown, cleanSolveRate: 40, review: 1 },
    { key: "math:a:high", section: "math", domain: "Algebra", skill: "Higher accuracy", ...breakdown, cleanSolveRate: 90, review: 3 },
    { key: "rw:c:words", section: "reading-writing", domain: "Craft and Structure", skill: "Words in Context", ...breakdown, completed: 3, cleanSolved: 3, cleanSolveRate: 100, review: 0 },
  ],
  reviewAnalytics: {
    total: 4, repeatedMisses: 1, ageBuckets: { fresh: 2, aging: 1, stale: 1 },
    bySection: [{ section: "math", label: "Math", count: 4 }],
    topSkills: [{ section: "math", domain: "Algebra", skill: "Higher accuracy", count: 3, repeatedMisses: 1, oldestAnsweredAt: "2026-08-01T00:00:00Z" }],
  },
  recentSessions: [{ id: "session-1", subject: "Math", status: "completed", requestedCount: 10, resolved: 10, cleanSolved: 7, cleanSolveRate: 70, retries: 3, activeTimeMs: 420_000, timedAttempts: 12, createdAt: "2026-08-25T00:00:00Z", completedAt: "2026-08-25T01:00:00Z", abandonedAt: null }],
  activeSession: null,
};
