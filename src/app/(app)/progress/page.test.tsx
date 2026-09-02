/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "@/app/(app)/progress/page";
import { dashboardFixture } from "../../../../test/dashboard-fixture";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));

vi.mock("@/lib/supabase-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase-api")>();
  return { ...original, getDashboard: mocks.getDashboard };
});

beforeEach(() => mocks.getDashboard.mockResolvedValue(dashboardFixture));
afterEach(() => { cleanup(); mocks.getDashboard.mockReset(); });

function skillRows() {
  return screen.getByRole("heading", { name: "Skills" }).closest("section")?.querySelectorAll("tbody tr") ?? [];
}

describe("ProgressPage", () => {
  it("summarises the window with denominators and reloads a selected range", async () => {
    render(<ProgressPage />);

    expect(await screen.findByRole("heading", { name: "The last month." })).not.toBeNull();
    expect(screen.getByText("10 of 16 first try")).not.toBeNull();
    expect(screen.getByText("+4.2 pts vs prior month")).not.toBeNull();
    expect(screen.getByText("6 of 16 needed a second try")).not.toBeNull();
    expect(screen.getByText("8 of 20")).not.toBeNull();
    expect(screen.getByText("1 missed twice or more. Age is since the last miss.")).not.toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Table" })[0]);
    expect(screen.getByRole("table", { name: "Completed by period" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All time" }));
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenLastCalledWith("all"));
  });

  it("lists skills weakest first and re-sorts on a column", async () => {
    render(<ProgressPage />);
    await screen.findByRole("heading", { name: "Skills" });

    expect(screen.getByText("3 skills · weakest first")).not.toBeNull();
    expect(skillRows()[0]?.textContent).toContain("Lower accuracy");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Clean solve" }));
    expect(skillRows()[0]?.textContent).toContain("Words in Context");
    expect(screen.queryByText("3 skills · weakest first")).toBeNull();
  });

  it("filters skills by section, domain, search and sample size while recomputing the slice", async () => {
    render(<ProgressPage />);
    await screen.findByRole("heading", { name: "Skills" });
    expect(screen.queryByText("completed", { selector: ".filter-meta span" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Math" }));
    expect(screen.getByRole("option", { name: "Algebra" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Craft and Structure" })).toBeNull();
    // 16 completed, 10 clean across the two math skills.
    expect(screen.getByText("16", { selector: ".filter-meta strong" })).not.toBeNull();
    expect(screen.getByText("63%", { selector: ".filter-meta strong" })).not.toBeNull();
    expect(screen.getByText("2 of 3 · weakest first")).not.toBeNull();

    fireEvent.click(within(screen.getByRole("group", { name: "Section" })).getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "words" } });
    expect(screen.getByText("100%", { selector: ".filter-meta strong" })).not.toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "n ≥ 5" }));
    expect(screen.getByText("0 of 3 · weakest first")).not.toBeNull();
    expect(screen.getAllByText("No matches.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("3 skills · weakest first")).not.toBeNull();
  });

  it("filters sets by status", async () => {
    render(<ProgressPage />);
    const sets = (await screen.findByRole("heading", { name: "Sets" })).closest("section") as HTMLElement;
    expect(sets.textContent).toContain("Math");

    fireEvent.click(screen.getByRole("button", { name: "Stopped" }));
    expect(sets.textContent).toContain("No matches.");
  });
});
