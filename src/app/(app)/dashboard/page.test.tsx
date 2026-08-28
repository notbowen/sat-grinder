/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import { dashboardFixture } from "../../../../test/dashboard-fixture";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));

vi.mock("@/lib/supabase-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase-api")>();
  return { ...original, getDashboard: mocks.getDashboard };
});

beforeEach(() => mocks.getDashboard.mockResolvedValue(dashboardFixture));
afterEach(() => { cleanup(); mocks.getDashboard.mockReset(); });

describe("DashboardPage", () => {
  it("renders denominated summary statistics and reloads a selected time range", async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Performance summary" })).not.toBeNull();
    expect(screen.getByText("10 of 16 on the first try")).not.toBeNull();
    expect(screen.getByText("+4.2 pts vs prior period")).not.toBeNull();
    expect(screen.getByRole("button", { name: "1 day" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "1 month" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "All time" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenLastCalledWith("14d"));
  });

  it("shows charts with table twins, coverage, and the needs-attention ranking", async () => {
    render(<DashboardPage />);
    await screen.findByRole("heading", { name: "Activity over time" });

    expect(screen.getByRole("img", { name: /Questions completed/ })).not.toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Table" })[0]);
    expect(screen.getByRole("table", { name: "Questions completed by period" })).not.toBeNull();

    expect(screen.getByRole("heading", { name: "Bank coverage" })).not.toBeNull();
    expect(screen.getByText("8 of 20")).not.toBeNull();

    const attention = screen.getByRole("region", { name: "Needs attention" });
    expect(attention.textContent).toContain("Lower accuracy");
    expect(attention.textContent).not.toContain("Words in Context");
    expect(screen.getByRole("link", { name: /All skills and filters/ }).getAttribute("href")).toMatch(/^\/statistics\/?$/);
  });
});
