/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import type { DashboardData } from "@/lib/supabase-api";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));

vi.mock("@/lib/supabase-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase-api")>();
  return { ...original, getDashboard: mocks.getDashboard };
});

const breakdown = {
  total: 10, mastered: 4, review: 2, unseen: 4, completed: 8, cleanSolved: 5,
  cleanSolveRate: 62.5, retried: 3, retryRate: 37.5, timedFirstAttempts: 5,
  medianFirstAttemptMs: 75_000, previousCompleted: 6, cleanSolveDelta: 4.2,
};

const data: DashboardData = {
  window: "30d", timezone: "Asia/Singapore", generatedAt: "2026-08-26T12:00:00Z", trendGranularity: "day",
  snapshot: { total: 20, mastered: 8, review: 4, unseen: 8 },
  summary: { completed: 16, cleanSolved: 10, cleanSolveRate: 62.5, cleanSolveDelta: 4.2, retried: 6, activeTimeMs: 600_000, timedAttempts: 12, practiceDays: 4, currentStreak: 3, newlyMastered: 5, previousCompleted: 14 },
  trend: [{ start: "2026-08-26", completed: 4, cleanSolved: 3, cleanSolveRate: 75, activeTimeMs: 180_000, timedAttempts: 4 }],
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
  ],
  reviewAnalytics: {
    total: 4, repeatedMisses: 1, ageBuckets: { fresh: 2, aging: 1, stale: 1 },
    bySection: [{ section: "math", label: "Math", count: 4 }],
    topSkills: [{ section: "math", domain: "Algebra", skill: "Higher accuracy", count: 3, repeatedMisses: 1, oldestAnsweredAt: "2026-08-01T00:00:00Z" }],
  },
  recentSessions: [{ id: "session-1", subject: "Math", status: "completed", requestedCount: 10, resolved: 10, cleanSolved: 7, cleanSolveRate: 70, retries: 3, activeTimeMs: 420_000, timedAttempts: 12, createdAt: "2026-08-25T00:00:00Z", completedAt: "2026-08-25T01:00:00Z", abandonedAt: null }],
  activeSession: null,
};

beforeEach(() => mocks.getDashboard.mockResolvedValue(data));
afterEach(() => { cleanup(); mocks.getDashboard.mockReset(); });

describe("DashboardPage", () => {
  it("renders denominated analytics and reloads a selected time range", async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Performance summary" })).not.toBeNull();
    expect(screen.getByText("10 of 16 on the first try")).not.toBeNull();
    expect(screen.getAllByText("n=8").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenLastCalledWith("7d"));
  });

  it("sorts skill diagnostics by a selected metric", async () => {
    render(<DashboardPage />);
    await screen.findByRole("heading", { name: "Skill diagnostics" });

    fireEvent.click(screen.getByRole("button", { name: "Sort by Clean solve" }));
    let rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Higher accuracy");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Clean solve" }));
    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Lower accuracy");
  });
});
