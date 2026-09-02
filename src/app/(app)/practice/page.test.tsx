/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticePage from "@/app/(app)/practice/page";
import { dashboardFixture } from "../../../../test/dashboard-fixture";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn(), getPracticePool: vi.fn(), abandonPracticeSession: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/supabase-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase-api")>();
  return { ...original, getDashboard: mocks.getDashboard, getPracticePool: mocks.getPracticePool, abandonPracticeSession: mocks.abandonPracticeSession };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }) }));

beforeEach(() => {
  // The fixture's last trend point is 26 Aug 2026 in Asia/Singapore.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-26T12:00:00Z"));
  mocks.getDashboard.mockResolvedValue(dashboardFixture);
  mocks.getPracticePool.mockResolvedValue({ total: 30, math: 12, readingWriting: 18 });
  mocks.abandonPracticeSession.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.clear(); });

describe("PracticePage", () => {
  it("leads with the streak, today's count, review, the weakest skill and recent sets", async () => {
    render(<PracticePage />);

    expect(await screen.findByRole("heading", { name: "3-day streak." })).not.toBeNull();
    expect(screen.getByText("6 done today, 3 clean.")).not.toBeNull();
    expect(screen.getByText("4 in review")).not.toBeNull();
    expect(screen.getByText("1 older than 30 days.")).not.toBeNull();
    expect(screen.getByText("Lower accuracy")).not.toBeNull();
    expect(screen.getByText("40% clean · n=8 · Math")).not.toBeNull();
    expect(screen.getByText("Math · 10 of 10")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Start 10 questions" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("link", { name: /All sets/ }).getAttribute("href")).toMatch(/^\/progress\/?#sets$/);
    expect(mocks.getDashboard).toHaveBeenCalledWith("30d");
  });

  it("puts an unfinished set first and blocks a new one until it is stopped", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.getDashboard.mockResolvedValueOnce({
      ...dashboardFixture,
      activeSession: { id: "active-1", subject: "Mixed", requestedCount: 10, resolved: 4, cleanSolved: 3, activeTimeMs: 130_000, timedAttempts: 4, createdAt: "2026-08-26T10:00:00Z" },
    });
    render(<PracticePage />);

    expect(await screen.findByRole("heading", { name: "Mix · 4 of 10" })).not.toBeNull();
    expect(screen.getByText("3 clean · 2m")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Resume/ }).getAttribute("href")).toMatch(/^\/practice\/set\/?\?set=active-1$/);
    expect(screen.getByRole("button", { name: "Start 10 questions" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Finish or stop the set in progress first.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(window.confirm).toHaveBeenCalledWith("Stop this set? Answers so far are saved.");
    await waitFor(() => expect(mocks.abandonPracticeSession).toHaveBeenCalledWith("active-1"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Mix · 4 of 10" })).toBeNull());
    expect(screen.getByRole("button", { name: "Start 10 questions" }).hasAttribute("disabled")).toBe(false);
  });

  it("uses plain words when there is nothing to report yet", async () => {
    mocks.getDashboard.mockResolvedValueOnce({
      ...dashboardFixture,
      summary: { ...dashboardFixture.summary, currentStreak: 0 },
      trend: [],
      reviewAnalytics: { ...dashboardFixture.reviewAnalytics, total: 0 },
      skills: dashboardFixture.skills.map((skill) => ({ ...skill, completed: 2 })),
      recentSessions: [],
    });
    render(<PracticePage />);

    expect(await screen.findByRole("heading", { name: "Start a streak." })).not.toBeNull();
    expect(screen.getByText("Nothing yet today.")).not.toBeNull();
    expect(screen.getByText("Nothing in review.")).not.toBeNull();
    expect(screen.getByText("Needs 5 answers per skill.")).not.toBeNull();
    expect(screen.getByText("No sets yet.")).not.toBeNull();
  });
});
