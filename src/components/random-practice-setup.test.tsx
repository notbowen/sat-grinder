/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RandomPracticeSetup } from "@/components/random-practice-setup";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  startPractice: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/supabase-api", () => ({
  startPractice: mocks.startPractice,
}));

beforeEach(() => {
  mocks.startPractice.mockResolvedValue("session-id");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RandomPracticeSetup", () => {
  it("defaults to a mixed quiz", async () => {
    render(<RandomPracticeSetup pool={{ total: 30, math: 12, readingWriting: 18 }} />);

    expect(screen.getByRole("radio", { name: /Mix/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Start quiz" }));

    await waitFor(() => expect(mocks.startPractice).toHaveBeenCalledWith(10, "mixed"));
    expect(mocks.push).toHaveBeenCalledWith("/practice/session/?session=session-id");
  });

  it("selects English-only practice and clamps the quiz size to that pool", async () => {
    render(<RandomPracticeSetup pool={{ total: 80, math: 75, readingWriting: 5 }} />);
    const count = screen.getByRole("spinbutton", { name: "Number of questions" });

    expect(count).toHaveValue(10);
    fireEvent.click(screen.getByRole("radio", { name: /English only/ }));
    expect(count).toHaveValue(5);
    fireEvent.click(screen.getByRole("button", { name: "Start quiz" }));

    await waitFor(() => expect(mocks.startPractice).toHaveBeenCalledWith(5, "english"));
  });

  it("disables starting when the selected subject has no eligible questions", () => {
    render(<RandomPracticeSetup pool={{ total: 12, math: 12, readingWriting: 0 }} />);

    fireEvent.click(screen.getByRole("radio", { name: /English only/ }));

    expect(screen.getByRole("button", { name: "Start quiz" })).toBeDisabled();
  });
});
