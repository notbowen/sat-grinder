/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizCard } from "@/components/quiz-card";

const mocks = vi.hoisted(() => ({ submitPracticeAnswer: vi.fn(), abandonPracticeSession: vi.fn() }));

vi.mock("@/lib/supabase-api", () => ({
  submitPracticeAnswer: mocks.submitPracticeAnswer,
  abandonPracticeSession: mocks.abandonPracticeSession,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
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

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  mocks.submitPracticeAnswer.mockReset();
  mocks.abandonPracticeSession.mockReset();
});

describe("QuizCard choice eliminator", () => {
  it("crosses out and restores a choice without selecting it", () => {
    const { container } = render(<QuizCard sessionId="session-1" question={question} resolved={0} total={1} onRefresh={async () => {}} />);

    expect(screen.queryByRole("button", { name: "Cross out choice A" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Eliminate choices" }));

    const optionA = container.querySelector<HTMLInputElement>('input[value="A"]');
    expect(optionA).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cross out choice A" }));

    expect(optionA?.disabled).toBe(true);
    expect(optionA?.checked).toBe(false);
    expect(optionA?.closest(".answer-option-row")?.classList.contains("answer-option-row-eliminated")).toBe(true);
    expect(sessionStorage.getItem("sat-grinder:eliminated:session-1:question-1")).toBe('["A"]');

    fireEvent.click(screen.getByRole("button", { name: "Undo elimination of choice A" }));

    expect(optionA?.disabled).toBe(false);
    expect(optionA?.closest(".answer-option-row")?.classList.contains("answer-option-row-eliminated")).toBe(false);
    expect(sessionStorage.getItem("sat-grinder:eliminated:session-1:question-1")).toBe("[]");
  });

  it("clears a selected answer when that choice is crossed out", () => {
    const { container } = render(<QuizCard sessionId="session-1" question={question} resolved={0} total={1} onRefresh={async () => {}} />);
    const optionB = container.querySelector<HTMLInputElement>('input[value="B"]');

    expect(optionB).not.toBeNull();
    fireEvent.click(optionB as HTMLInputElement);
    expect(optionB?.checked).toBe(true);
    expect(screen.getByRole("button", { name: "Check answer" }).hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Eliminate choices" }));
    fireEvent.click(screen.getByRole("button", { name: "Cross out choice B" }));

    expect(optionB?.checked).toBe(false);
    expect(optionB?.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Check answer" }).hasAttribute("disabled")).toBe(true);
  });

  it("restores valid eliminated choices for the current quiz session", () => {
    sessionStorage.setItem("sat-grinder:eliminated:session-1:question-1", '["B","unknown"]');

    const { container } = render(<QuizCard sessionId="session-1" question={question} resolved={0} total={1} onRefresh={async () => {}} />);
    const optionB = container.querySelector<HTMLInputElement>('input[value="B"]');

    expect(optionB?.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Undo elimination of choice B" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cross out choice A" })).toBeNull();
  });

  it("submits active time with every answer attempt", async () => {
    mocks.submitPracticeAnswer.mockResolvedValue({ correct: false, message: "Try again." });
    const { container } = render(<QuizCard sessionId="session-1" question={question} resolved={0} total={1} onRefresh={async () => {}} />);

    fireEvent.click(container.querySelector<HTMLInputElement>('input[value="A"]') as HTMLInputElement);
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    await vi.waitFor(() => expect(mocks.submitPracticeAnswer).toHaveBeenCalledWith(
      "session-1", "question-1", "A", expect.any(Number),
    ));
  });
});
