"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Highlighter, LoaderCircle, RotateCcw, X } from "lucide-react";
import type { AnswerOption } from "@/lib/supabase-api";
import { abandonPracticeSession, submitPracticeAnswer } from "@/lib/supabase-api";
import { HighlightableQuestionHtml } from "@/components/highlightable-question-html";
import { MathExpression } from "@/components/math-expression";
import { QuestionHtml } from "@/components/question-html";
import { MAX_MATH_RESPONSE_LENGTH } from "@/lib/math-response";

type Question = {
  id: string; displayId: string; section: "math" | "reading-writing"; domainName: string; skillName: string; difficulty: "medium" | "hard";
  type: "mcq" | "spr"; stimulusHtml: string | null; stemHtml: string; answerOptions: AnswerOption[]; retryCount: number; position: number;
};
type Feedback = { correct: boolean; message: string; firstAttempt?: boolean; completed?: boolean; rationaleHtml?: string; correctAnswers?: string[] };

export function QuizCard({ sessionId, question, resolved, total, onRefresh }: { sessionId: string; question: Question; resolved: number; total: number; onRefresh: () => Promise<void> }) {
  const router = useRouter(); const [response, setResponse] = useState(""); const [feedback, setFeedback] = useState<Feedback | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [abandoning, setAbandoning] = useState(false);
  const [eliminatorEnabled, setEliminatorEnabled] = useState(false); const [eliminatedChoices, setEliminatedChoices] = useState<string[]>([]); const [eliminatorAnnouncement, setEliminatorAnnouncement] = useState("");

  useLayoutEffect(() => {
    const validLetters = new Set(question.answerOptions.map((option) => option.letter));
    let restored: string[] = [];
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(`sat-grinder:eliminated:${sessionId}:${question.id}`) ?? "[]");
      if (Array.isArray(stored)) restored = stored.filter((letter): letter is string => typeof letter === "string" && validLetters.has(letter));
    } catch { /* Choice elimination still works without persistence. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Browser-session state can only be restored after hydration.
    setEliminatedChoices([...new Set(restored)]);
  }, [question.answerOptions, question.id, sessionId]);

  function toggleChoiceElimination(letter: string) {
    const willEliminate = !eliminatedChoices.includes(letter);
    const updated = willEliminate ? [...eliminatedChoices, letter] : eliminatedChoices.filter((choice) => choice !== letter);
    setEliminatedChoices(updated);
    try { sessionStorage.setItem(`sat-grinder:eliminated:${sessionId}:${question.id}`, JSON.stringify(updated)); } catch { /* Choice elimination still works without persistence. */ }
    if (willEliminate && response === letter) setResponse("");
    if (feedback && !feedback.correct) setFeedback(null);
    setEliminatorAnnouncement(`${letter} ${willEliminate ? "crossed out" : "restored"}.`);
  }
  async function check() {
    setLoading(true); setError("");
    try { setFeedback(await submitPracticeAnswer(sessionId, question.id, response)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be checked."); }
    finally { setLoading(false); }
  }
  async function abandon() {
    if (!window.confirm("Abandon this quiz? Submitted attempts will be kept and untouched questions will return to your pool.")) return;
    setAbandoning(true);
    try { await abandonPracticeSession(sessionId); router.replace("/dashboard/"); }
    catch (cause) { setAbandoning(false); setError(cause instanceof Error ? cause.message : "The quiz could not be abandoned."); }
  }
  async function next() { setLoading(true); await onRefresh(); }

  return <div className="quiz-layout">
    <section>
      <div className="mb-5 flex items-center justify-between gap-4"><div><p className="eyebrow">Question {resolved + 1} of {total}</p><div className="mt-2 flex flex-wrap gap-2"><span className="question-chip question-id-chip">ID {question.displayId}</span><span className="question-chip">{question.section === "math" ? "Math" : "Reading & Writing"}</span><span className="question-chip">{question.domainName}</span><span className="question-chip">{question.skillName}</span><span className={`question-chip ${question.difficulty === "hard" ? "chip-hard" : ""}`}>{question.difficulty}</span></div></div><button className="icon-button" onClick={abandon} disabled={abandoning} aria-label="Abandon quiz">{abandoning ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}</button></div>
      <div className="progress-track"><div style={{ width: `${Math.round(resolved / total * 100)}%` }} /></div>
      <article className="question-card">
        <div className="question-annotation-hint"><Highlighter className="size-4" aria-hidden="true" /><span>Select text to highlight</span></div>
        <HighlightableQuestionHtml html={question.stimulusHtml} storageKey={`${sessionId}:${question.id}:stimulus`} />
        <HighlightableQuestionHtml html={question.stemHtml} storageKey={`${sessionId}:${question.id}:stem`} className={question.stimulusHtml ? "mt-5" : ""} />
        <div className="mt-8">
          {question.type === "mcq" ? <fieldset disabled={feedback?.correct}>
            <legend className="sr-only">Answer choices</legend>
            <div className="answer-choice-toolbar">
              <span>Cross out choices you think are wrong.</span>
              <button type="button" className={`choice-eliminator-toggle ${eliminatorEnabled ? "choice-eliminator-toggle-active" : ""}`} aria-pressed={eliminatorEnabled} onClick={() => setEliminatorEnabled((enabled) => !enabled)}>
                <span className="choice-eliminator-icon" aria-hidden="true">ABC</span>
                {eliminatorEnabled ? "Eliminator on" : "Eliminate choices"}
              </button>
            </div>
            <div className="space-y-3">
              {question.answerOptions.map((option) => {
                const eliminated = eliminatedChoices.includes(option.letter);
                const showEliminationControl = eliminatorEnabled || eliminated;
                return <div key={option.letter} className={`answer-option-row ${showEliminationControl ? "answer-option-row-with-tool" : ""} ${eliminated ? "answer-option-row-eliminated" : ""}`}>
                  <label className={`answer-option ${response === option.letter ? "answer-option-selected" : ""}`}>
                    <input type="radio" name="answer" value={option.letter} checked={response === option.letter} disabled={eliminated} onChange={() => { setResponse(option.letter); if (feedback && !feedback.correct) setFeedback(null); }} />
                    <span className="answer-letter">{option.letter}</span>
                    <span className="answer-option-content"><QuestionHtml html={option.content} /></span>
                  </label>
                  {showEliminationControl && <button type="button" className={`answer-eliminate-button ${eliminated ? "answer-eliminate-button-undo" : ""}`} aria-label={eliminated ? `Undo elimination of choice ${option.letter}` : `Cross out choice ${option.letter}`} onClick={() => toggleChoiceElimination(option.letter)}>
                    {eliminated ? <><RotateCcw className="size-4" aria-hidden="true" /><span>Undo</span></> : <span className="answer-eliminate-icon" aria-hidden="true">{option.letter}</span>}
                  </button>}
                </div>;
              })}
            </div>
            <span className="sr-only" aria-live="polite">{eliminatorAnnouncement}</span>
          </fieldset>
          : <div className="max-w-2xl"><label className="form-label" htmlFor={`answer-${question.id}`}>Your answer</label><div className="math-answer-row mt-2"><input id={`answer-${question.id}`} className="form-input math-answer-input" value={response} maxLength={MAX_MATH_RESPONSE_LENGTH} disabled={feedback?.correct} onChange={(event) => { setResponse(event.target.value); if (feedback && !feedback.correct) setFeedback(null); }} placeholder="e.g. 5/3 or 0.75" inputMode="text" autoCapitalize="none" autoComplete="off" spellCheck={false} /><span className={`math-answer-preview ${response.trim() ? "" : "math-answer-preview-empty"}`} aria-label="Rendered answer">{response.trim() ? <MathExpression value={response} /> : "Rendered answer"}</span></div><p className="mt-2 text-sm text-[var(--muted)]">The rendered version updates as you type. Use up to {MAX_MATH_RESPONSE_LENGTH} characters.</p></div>}
        </div>
      </article>
    </section>

    <aside className="feedback-panel">
      {!feedback && <><p className="eyebrow">Check your work</p><h2 className="section-title">Ready to commit?</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">You&apos;ll get feedback immediately. If it&apos;s wrong, adjust your answer and try again.</p>{error && <p className="form-error mt-4" role="alert">{error}</p>}<button className="primary-button mt-6 w-full" onClick={check} disabled={loading || !response}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : "Check answer"}</button></>}
      {feedback && !feedback.correct && <><span className="feedback-icon incorrect"><RotateCcw className="size-6" /></span><p className="eyebrow mt-5 text-[var(--coral-dark)]">Keep going</p><h2 className="section-title">Not quite yet.</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{feedback.message}</p><button className="secondary-button mt-6 w-full" onClick={() => setFeedback(null)}>Try again</button></>}
      {feedback?.correct && <><span className="feedback-icon correct"><CheckCircle2 className="size-6" /></span><p className="eyebrow mt-5 text-[var(--green)]">Correct</p><h2 className="section-title">{feedback.firstAttempt ? "Mastered." : "You got there."}</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{feedback.message}</p>{feedback.correctAnswers && (question.type === "spr" ? <div className="accepted-math-answer"><span>Accepted answer{feedback.correctAnswers.length === 1 ? "" : "s"}:</span><span className="accepted-math-values">{feedback.correctAnswers.map((answer, index) => <span key={`${answer}:${index}`}>{index > 0 && <span className="accepted-answer-separator">or</span>}<MathExpression value={answer} /></span>)}</span></div> : <p className="mt-4 rounded-lg bg-[var(--green-soft)] p-3 text-sm font-bold text-[var(--green)]">Accepted answer{feedback.correctAnswers.length === 1 ? "" : "s"}: {feedback.correctAnswers.join(", ")}</p>)}<div className="mt-6 border-t border-[var(--line)] pt-5"><p className="eyebrow">Explanation</p><QuestionHtml html={feedback.rationaleHtml} className="mt-3 text-sm" /></div><button className="primary-button mt-6 w-full" onClick={next}>{feedback.completed ? "View results" : <>Next question <ArrowRight className="size-4" /></>}</button></>}
    </aside>
  </div>;
}
