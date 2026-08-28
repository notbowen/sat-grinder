/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StatisticsPage from "@/app/(app)/statistics/page";
import { dashboardFixture } from "../../../../test/dashboard-fixture";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));

vi.mock("@/lib/supabase-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase-api")>();
  return { ...original, getDashboard: mocks.getDashboard };
});

beforeEach(() => mocks.getDashboard.mockResolvedValue(dashboardFixture));
afterEach(() => { cleanup(); mocks.getDashboard.mockReset(); });

describe("StatisticsPage", () => {
  it("sorts skill diagnostics by a selected metric and reloads a time range", async () => {
    render(<StatisticsPage />);
    await screen.findByRole("heading", { name: "Skill diagnostics" });

    fireEvent.click(screen.getByRole("button", { name: "Sort by Clean solve" }));
    let table = screen.getByRole("heading", { name: "Skill diagnostics" }).closest("section")?.querySelector("tbody");
    expect(table?.querySelector("tr")?.textContent).toContain("Words in Context");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Clean solve" }));
    table = screen.getByRole("heading", { name: "Skill diagnostics" }).closest("section")?.querySelector("tbody");
    expect(table?.querySelector("tr")?.textContent).toContain("Lower accuracy");

    fireEvent.click(screen.getByRole("button", { name: "All time" }));
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenLastCalledWith("all"));
  });

  it("filters skills by section, domain, search, and sample size while recomputing the slice", async () => {
    render(<StatisticsPage />);
    await screen.findByRole("heading", { name: "Filtered slice" });

    expect(screen.getByText("3", { selector: ".filter-meta strong" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Math" }));
    expect(screen.getByText("2", { selector: ".filter-meta strong" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Algebra" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Craft and Structure" })).toBeNull();
    // 16 completed, 10 clean across the two math skills.
    expect(screen.getByText("10 of 16 on the first try")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All sections" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search skills" }), { target: { value: "words" } });
    expect(screen.getByText("1", { selector: ".filter-meta strong" })).not.toBeNull();
    expect(screen.getByText("3 of 3 on the first try")).not.toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "n ≥ 5 only" }));
    expect(screen.getByText("of 3 skills", { exact: false }).textContent).toContain("0 of 3 skills");
    expect(screen.getAllByText("No skills match these filters.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("3", { selector: ".filter-meta strong" })).not.toBeNull();
  });

  it("filters sessions by status", async () => {
    render(<StatisticsPage />);
    const sessions = (await screen.findByRole("heading", { name: "Sessions" })).closest("section") as HTMLElement;
    expect(sessions.textContent).toContain("Math");

    fireEvent.click(screen.getByRole("button", { name: "abandoned" }));
    expect(sessions.textContent).toContain("No sessions match this filter.");
  });
});
