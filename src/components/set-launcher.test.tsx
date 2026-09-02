/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetLauncher } from "@/components/set-launcher";

const mocks = vi.hoisted(() => ({ push: vi.fn(), startPractice: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/supabase-api", () => ({ startPractice: mocks.startPractice }));

beforeEach(() => { mocks.startPractice.mockResolvedValue("session-id"); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe("SetLauncher", () => {
  it("defaults to a mixed set of 10 and says what it starts", async () => {
    render(<SetLauncher pool={{ total: 30, math: 12, readingWriting: 18 }} />);

    expect(screen.getByRole("radio", { name: /Mix/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Start 10 questions" }));

    await waitFor(() => expect(mocks.startPractice).toHaveBeenCalledWith(10, "mixed"));
    expect(mocks.push).toHaveBeenCalledWith("/practice/set/?set=session-id");
  });

  it("clamps the size to the chosen mix", async () => {
    render(<SetLauncher pool={{ total: 80, math: 75, readingWriting: 5 }} />);
    const count = screen.getByRole("spinbutton", { name: "Number of questions" });

    expect(count).toHaveValue(10);
    fireEvent.click(screen.getByRole("radio", { name: /Reading & Writing/ }));
    expect(count).toHaveValue(5);
    fireEvent.click(screen.getByRole("button", { name: "Start 5 questions" }));

    await waitFor(() => expect(mocks.startPractice).toHaveBeenCalledWith(5, "english"));
  });

  it("remembers the last mix and size on this browser", async () => {
    const first = render(<SetLauncher pool={{ total: 80, math: 40, readingWriting: 40 }} />);
    fireEvent.click(screen.getByRole("radio", { name: /Math/ }));
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    fireEvent.click(screen.getByRole("button", { name: "Start 20 questions" }));
    await waitFor(() => expect(mocks.startPractice).toHaveBeenCalledWith(20, "math"));
    first.unmount();

    render(<SetLauncher pool={{ total: 80, math: 40, readingWriting: 40 }} />);
    expect(screen.getByRole("radio", { name: /Math/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Start 20 questions" })).not.toBeNull();
  });

  it("cannot start with an empty mix or while blocked", () => {
    const { unmount } = render(<SetLauncher pool={{ total: 12, math: 12, readingWriting: 0 }} />);
    fireEvent.click(screen.getByRole("radio", { name: /Reading & Writing/ }));
    expect(screen.getByRole("button", { name: "Start 1 question" })).toBeDisabled();
    unmount();

    render(<SetLauncher pool={{ total: 12, math: 12, readingWriting: 0 }} blocked="Finish the set in progress first." />);
    expect(screen.getByRole("button", { name: "Start 10 questions" })).toBeDisabled();
    expect(screen.getByText("Finish the set in progress first.")).not.toBeNull();
  });
});
