/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SetPage from "@/app/(focus)/practice/set/page";
import type { PracticeData } from "@/lib/supabase-api";

const mocks = vi.hoisted(() => ({ getPracticeSession: vi.fn(), startPractice: vi.fn(), push: vi.fn(), params: new URLSearchParams("set=session-1") }));

vi.mock("@/lib/supabase-api", () => ({ getPracticeSession: mocks.getPracticeSession, startPractice: mocks.startPractice, submitPracticeAnswer: vi.fn(), abandonPracticeSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }), useSearchParams: () => mocks.params }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: null, loading: false }) }));

const finished: PracticeData = {
  session: { id: "session-1", mode: "random", requestedCount: 10, status: "completed", createdAt: "2026-09-02T00:00:00Z", completedAt: "2026-09-02T00:10:00Z", abandonedAt: null },
  total: 10, resolved: 10, firstAttemptCorrect: 7, current: null,
};

beforeEach(() => { mocks.startPractice.mockResolvedValue("session-2"); });
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); });

describe("SetPage", () => {
  it("shows the result strip and starts another set of the same size", async () => {
    sessionStorage.setItem("sat-grinder:set-results:session-1", JSON.stringify(Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index, [1, 5, 8].includes(index) ? "miss" : "clean"]))));
    mocks.getPracticeSession.mockResolvedValue(finished);
    render(<SetPage />);

    expect(await screen.findByRole("heading", { name: "7 of 10 clean." })).not.toBeNull();
    const cells = [...screen.getByRole("img", { name: "10 of 10 answered" }).querySelectorAll("i")].map((cell) => cell.className);
    expect(cells.filter((cell) => cell === "miss").length).toBe(3);
    expect(cells[1]).toBe("miss");
    expect(screen.getByText("Misses come back until solved first try.")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Progress" }).getAttribute("href")).toMatch(/^\/progress\/?$/);

    fireEvent.click(screen.getByRole("button", { name: "Another 10" }));
    await waitFor(() => expect(mocks.startPractice).toHaveBeenCalledWith(10, "mixed"));
    expect(mocks.push).toHaveBeenCalledWith("/practice/set/?set=session-2");
  });

  it("falls back to a proportional strip when positions were not recorded here", async () => {
    mocks.getPracticeSession.mockResolvedValue(finished);
    render(<SetPage />);

    await screen.findByRole("heading", { name: "7 of 10 clean." });
    const cells = [...screen.getByRole("img", { name: "10 of 10 answered" }).querySelectorAll("i")].map((cell) => cell.className);
    expect(cells).toEqual(["clean", "clean", "clean", "clean", "clean", "clean", "clean", "miss", "miss", "miss"]);
  });

  it("explains a stopped set", async () => {
    mocks.getPracticeSession.mockResolvedValue({ ...finished, session: { ...finished.session, status: "abandoned" }, resolved: 4 });
    render(<SetPage />);

    expect(await screen.findByRole("heading", { name: "Answers saved." })).not.toBeNull();
    expect(screen.getByText("The rest went back to the pool.")).not.toBeNull();
  });

  it("says set, not quiz, when the server cannot find it", async () => {
    mocks.getPracticeSession.mockRejectedValue(new Error("Quiz not found."));
    render(<SetPage />);

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Set not found.");
  });
});
