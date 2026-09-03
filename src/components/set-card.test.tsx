/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetCard, SetStrip } from "@/components/set-card";

const mocks = vi.hoisted(() => ({ submitPracticeAnswer: vi.fn(), abandonPracticeSession: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/supabase-api", () => ({
  submitPracticeAnswer: mocks.submitPracticeAnswer,
  abandonPracticeSession: mocks.abandonPracticeSession,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: mocks.replace }),
}));

const question = {
  id: "question-1",
  displayId: "Q1",
  section: "reading-writing" as const,
  domainName: "Craft and Structure",
  skillName: "Words in Context",
  difficulty: "medium" as const,
  type: "mcq" as const,
  stimulusHtml: null,
  stemHtml: "<p>Choose the best answer.</p>",
  answerOptions: [
    { letter: "A", content: "<p>Alpha</p>" },
    { letter: "B", content: "<p>Beta</p>" },
  ],
  retryCount: 0,
  position: 0,
};

function renderCard(overrides: Partial<React.ComponentProps<typeof SetCard>> = {}) {
  return render(<SetCard sessionId="session-1" question={question} resolved={0} total={3} onRefresh={async () => {}} {...overrides} />);
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  mocks.submitPracticeAnswer.mockReset();
  mocks.abandonPracticeSession.mockReset();
  mocks.replace.mockReset();
});

describe("SetCard", () => {
  it("shows the section, position and per-question strip in the bar", () => {
    renderCard();

    expect(screen.getByText("Reading & Writing · 1 of 3")).not.toBeNull();
    expect(screen.getByRole("img", { name: "0 of 3 answered" }).querySelectorAll("i").length).toBe(3);
    expect(screen.getByText("Craft and Structure")).not.toBeNull();
    expect(screen.getByText("ID Q1")).not.toBeNull();
  });

  it("starts with cross-out on and can hide unused controls", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "Cross out" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Cross out choice A" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cross out" }));
    expect(screen.getByRole("button", { name: "Cross out" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Cross out choice A" })).toBeNull();
  });

  it("crosses out a choice, clears it if selected, and remembers it for the session", () => {
    const { container } = renderCard();
    const optionB = container.querySelector<HTMLInputElement>('input[value="B"]') as HTMLInputElement;

    fireEvent.click(optionB);
    expect(screen.getByRole("button", { name: "Check" }).hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Cross out choice B" }));
    expect(optionB.checked).toBe(false);
    expect(optionB.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Check" }).hasAttribute("disabled")).toBe(true);
    expect(sessionStorage.getItem("sat-grinder:eliminated:session-1:question-1")).toBe('["B"]');

    fireEvent.click(screen.getByRole("button", { name: "Undo elimination of choice B" }));
    expect(optionB.disabled).toBe(false);
  });

  it("records a miss inline and colours the strip", async () => {
    mocks.submitPracticeAnswer.mockResolvedValue({ correct: false, message: "Try again.", retries: 1 });
    const { container } = renderCard();

    fireEvent.click(container.querySelector<HTMLInputElement>('input[value="A"]') as HTMLInputElement);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    await vi.waitFor(() => expect(mocks.submitPracticeAnswer).toHaveBeenCalledWith("session-1", "question-1", "A", expect.any(Number)));
    expect(await screen.findByRole("heading", { name: "Not yet." })).not.toBeNull();
    expect(screen.getByText("Attempt 1 recorded. Pick again and check.")).not.toBeNull();
    expect(screen.getByRole("img", { name: "0 of 3 answered" }).querySelector("i")?.className).toBe("miss");
    expect(screen.getByRole("button", { name: "Check" })).not.toBeNull();
  });

  it("marks a first-try solve as mastered and offers Next", async () => {
    mocks.submitPracticeAnswer.mockResolvedValue({ correct: true, message: "ok", firstAttempt: true, completed: false, rationaleHtml: "<p>Because.</p>" });
    const { container } = renderCard();

    fireEvent.click(container.querySelector<HTMLInputElement>('input[value="A"]') as HTMLInputElement);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByRole("heading", { name: "Correct, first try." })).not.toBeNull();
    expect(screen.getByText("Mastered. It leaves your pool.")).not.toBeNull();
    expect(screen.getByText("Because.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeNull();
  });

  it("stops the set after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.abandonPracticeSession.mockResolvedValue(undefined);
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Stop set" }));

    expect(window.confirm).toHaveBeenCalledWith("Stop this set? Answers so far are saved.");
    await vi.waitFor(() => expect(mocks.abandonPracticeSession).toHaveBeenCalledWith("session-1"));
    expect(mocks.replace).toHaveBeenCalledWith("/practice/");
  });

  it("toggles timer visibility on click and persists across different tests", () => {
    const { unmount } = renderCard({ sessionId: "session-1" });

    const timerBtn = screen.getByRole("button", { name: /hide timer/i });
    expect(timerBtn.textContent).toBe("0:00");

    fireEvent.click(timerBtn);
    const hiddenBtn = screen.getByRole("button", { name: /show timer/i });
    expect(hiddenBtn.querySelector("svg")).not.toBeNull();
    expect(localStorage.getItem("sat-grinder:timer-visible")).toBe("false");

    // Start a different test / session
    unmount();
    renderCard({ sessionId: "session-2" });

    const secondTestHiddenBtn = screen.getByRole("button", { name: /show timer/i });
    expect(secondTestHiddenBtn.querySelector("svg")).not.toBeNull();

    // Toggle back on
    fireEvent.click(secondTestHiddenBtn);
    expect(screen.getByRole("button", { name: /hide timer/i }).textContent).toBe("0:00");
    expect(localStorage.getItem("sat-grinder:timer-visible")).toBe("true");
  });

  it("persists cross-out toggle state across different tests", () => {
    const { unmount } = renderCard({ sessionId: "session-1" });

    const crossOutBtn = screen.getByRole("button", { name: "Cross out" });
    expect(crossOutBtn.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(crossOutBtn);
    expect(crossOutBtn.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem("sat-grinder:cross-out-enabled")).toBe("false");

    // Start a different test
    unmount();
    renderCard({ sessionId: "session-2" });

    const secondTestBtn = screen.getByRole("button", { name: "Cross out" });
    expect(secondTestBtn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Cross out choice A" })).toBeNull();
  });

  it("makes MCQ answers and elimination tools non-interactable after a correct submission", async () => {
    mocks.submitPracticeAnswer.mockResolvedValue({ correct: true, message: "ok", firstAttempt: true, completed: false });
    const { container } = renderCard();

    const optionA = container.querySelector<HTMLInputElement>('input[value="A"]') as HTMLInputElement;
    const optionB = container.querySelector<HTMLInputElement>('input[value="B"]') as HTMLInputElement;

    fireEvent.click(optionA);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    await screen.findByRole("heading", { name: "Correct, first try." });

    // Answers should now be disabled
    expect(optionA.disabled).toBe(true);
    expect(optionB.disabled).toBe(true);

    // Clicking other choices should do nothing
    fireEvent.click(optionB);
    expect(optionB.checked).toBe(false);
    expect(optionA.checked).toBe(true);

    // Eliminator tools should be disabled
    const crossOutToggle = screen.getByRole("button", { name: "Cross out" });
    expect(crossOutToggle.hasAttribute("disabled")).toBe(true);
    fireEvent.click(crossOutToggle);
    expect(crossOutToggle.getAttribute("aria-pressed")).toBe("true");

    const eliminateBtn = screen.getByRole("button", { name: "Cross out choice B" });
    expect(eliminateBtn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(eliminateBtn);
    expect(optionB.disabled).toBe(true);
    expect(sessionStorage.getItem("sat-grinder:eliminated:session-1:question-1")).toBeNull();
  });

  it("makes SPR answers non-interactable after a correct submission", async () => {
    mocks.submitPracticeAnswer.mockResolvedValue({ correct: true, message: "ok", firstAttempt: true, completed: false });
    const sprQuestion = {
      ...question,
      id: "question-2",
      type: "spr" as const,
      answerOptions: [],
    };
    renderCard({ question: sprQuestion });

    const input = screen.getByLabelText("Your answer") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    await screen.findByRole("heading", { name: "Correct, first try." });

    expect(input.disabled).toBe(true);
    expect(input.readOnly).toBe(true);

    fireEvent.change(input, { target: { value: "99" } });
    expect(input.value).toBe("42");
  });
});

describe("SetStrip", () => {
  it("colours answered positions and marks the current one", () => {
    render(<SetStrip total={4} resolved={2} results={{ 0: "clean", 1: "miss" }} />);
    const cells = [...screen.getByRole("img", { name: "2 of 4 answered" }).querySelectorAll("i")].map((cell) => cell.className);
    expect(cells).toEqual(["clean", "miss", "current", ""]);
  });

  it("shows answered positions without a recorded outcome as done", () => {
    render(<SetStrip total={2} resolved={1} results={{}} />);
    const cells = [...screen.getByRole("img", { name: "1 of 2 answered" }).querySelectorAll("i")].map((cell) => cell.className);
    expect(cells).toEqual(["done", "current"]);
  });
});
