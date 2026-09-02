"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Highlighter, LoaderCircle, RotateCcw, X } from "lucide-react";
import type { AnswerFeedback, PracticeQuestion } from "@/lib/supabase-api";
import { abandonPracticeSession, submitPracticeAnswer } from "@/lib/supabase-api";
import { Wordmark } from "@/components/app-shell";
import { HighlightableQuestionHtml } from "@/components/highlightable-question-html";
import { MathExpression } from "@/components/math-expression";
import { QuestionHtml } from "@/components/question-html";
import { formatClock, sectionLabel } from "@/lib/format";
import { MAX_MATH_RESPONSE_LENGTH } from "@/lib/math-response";
import { readSetResults, recordSetResult, type SetResults } from "@/lib/set-results";
import { useActiveAttemptTimer } from "@/lib/use-active-attempt-timer";

export const STOP_SET_PROMPT = "Stop this set? Answers so far are saved.";

/**
 * One cell per question: clean, missed, answered without a recorded outcome
 * (another browser), current, or still to come. A miss shows as soon as it
 * happens, before the question is resolved.
 */
export function SetStrip({ total, resolved, results, className = "qstrip" }: { total: number; resolved: number; results: SetResults; className?: string }) {
  return <div className={className} role="img" aria-label={`${resolved} of ${total} answered`}>
    {Array.from({ length: total }, (_, index) => {
      const state = results[index] ?? (index < resolved ? "done" : index === resolved ? "current" : "");
      return <i key={index} className={state} />;
    })}
  </div>;
}

export function SetCard({ sessionId, question, resolved, total, onRefresh }: { sessionId: string; question: PracticeQuestion; resolved: number; total: number; onRefresh: () => Promise<void> }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [eliminatorEnabled, setEliminatorEnabled] = useState(true);
  const [eliminatedChoices, setEliminatedChoices] = useState<string[]>([]);
  const [eliminatorAnnouncement, setEliminatorAnnouncement] = useState("");
  const [results, setResults] = useState<SetResults>({});
  // Misses so far on this question, including earlier visits the server reported.
  const [misses, setMisses] = useState(question.retryCount);
  const [elapsedMs, setElapsedMs] = useState(0);
  const attemptTimer = useActiveAttemptTimer(`${sessionId}:${question.id}`);
  const { elapsed } = attemptTimer;

  useLayoutEffect(() => {
    const validLetters = new Set(question.answerOptions.map((option) => option.letter));
    let restored: string[] = [];
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(`sat-grinder:eliminated:${sessionId}:${question.id}`) ?? "[]");
      if (Array.isArray(stored)) restored = stored.filter((letter): letter is string => typeof letter === "string" && validLetters.has(letter));
    } catch { /* Choice elimination still works without persistence. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Browser-session state can only be restored after hydration.
    setEliminatedChoices([...new Set(restored)]);
    setResults(readSetResults(sessionId));
  }, [question.answerOptions, question.id, sessionId]);

  useEffect(() => {
    const interval = setInterval(() => setElapsedMs(elapsed()), 1000);
    return () => clearInterval(interval);
  }, [elapsed, question.id]);

  function clearMiss() {
    if (feedback && !feedback.correct) { setFeedback(null); attemptTimer.resume(); }
  }
  function toggleChoiceElimination(letter: string) {
    const willEliminate = !eliminatedChoices.includes(letter);
    const updated = willEliminate ? [...eliminatedChoices, letter] : eliminatedChoices.filter((choice) => choice !== letter);
    setEliminatedChoices(updated);
    try { sessionStorage.setItem(`sat-grinder:eliminated:${sessionId}:${question.id}`, JSON.stringify(updated)); } catch { /* Choice elimination still works without persistence. */ }
    if (willEliminate && response === letter) setResponse("");
    clearMiss();
    setEliminatorAnnouncement(`${letter} ${willEliminate ? "crossed out" : "restored"}.`);
  }
  async function check() {
    setLoading(true); setError("");
    const activeDurationMs = attemptTimer.pause();
    try {
      const result = await submitPracticeAnswer(sessionId, question.id, response, activeDurationMs);
      setFeedback(result);
      setResults(recordSetResult(sessionId, resolved, result.correct));
      if (result.correct) attemptTimer.reset(false);
      else { setMisses(result.retries ?? misses + 1); attemptTimer.resume(); }
    }
    catch (cause) {
      attemptTimer.resume();
      setError(cause instanceof Error ? cause.message : "Could not check.");
    }
    finally { setLoading(false); }
  }
  async function stop() {
    if (!window.confirm(STOP_SET_PROMPT)) return;
    setStopping(true);
    try { await abandonPracticeSession(sessionId); router.replace("/practice/"); }
    catch (cause) { setStopping(false); setError(cause instanceof Error ? cause.message : "Could not stop."); }
  }
  async function next() { setLoading(true); await onRefresh(); }

  const split = Boolean(question.stimulusHtml);
  const solved = Boolean(feedback?.correct);
  const alsoAccepted = question.type === "spr" && feedback?.correctAnswers
    ? feedback.correctAnswers.filter((answer) => answer.trim() !== response.trim())
    : [];

  const hint = <p className="annotation-hint"><Highlighter className="size-3.5" aria-hidden="true" /><span>Select text to highlight</span></p>;

  return <div className="set-screen">
    <div className="set-bar">
      <div className="set-bar-lead"><Wordmark href="/practice" /><i aria-hidden="true" /><p className="eyebrow">{sectionLabel(question.section)} · {resolved + 1} of {total}</p></div>
      <SetStrip total={total} resolved={resolved} results={results} />
      <div className="set-bar-end">
        <span className="timer num" aria-label="Time on this question">{formatClock(elapsedMs)}</span>
        <button className="icon-btn" onClick={stop} disabled={stopping} aria-label="Stop set">{stopping ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}</button>
      </div>
    </div>

    <div className={`set-body ${split ? "set-split" : "set-single"}`}>
      {split && <section className="set-pane" aria-label="Passage">
        {hint}
        <HighlightableQuestionHtml html={question.stimulusHtml} storageKey={`${sessionId}:${question.id}:stimulus`} />
      </section>}
      <section className="set-pane" aria-label="Question">
        {!split && hint}
        <HighlightableQuestionHtml html={question.stemHtml} storageKey={`${sessionId}:${question.id}:stem`} />

        {question.type === "mcq" ? <fieldset disabled={solved}>
          <legend className="sr-only">Answer choices</legend>
          <div className="answer-choice-toolbar">
            <button type="button" className={`choice-eliminator-toggle ${eliminatorEnabled ? "choice-eliminator-toggle-active" : ""}`} aria-pressed={eliminatorEnabled} onClick={() => setEliminatorEnabled((enabled) => !enabled)}>
              <span className="choice-eliminator-icon" aria-hidden="true">ABC</span>
              Cross out
            </button>
          </div>
          <div className="answer-list">
            {question.answerOptions.map((option) => {
              const eliminated = eliminatedChoices.includes(option.letter);
              const showEliminationControl = eliminatorEnabled || eliminated;
              return <div key={option.letter} className={`answer-option-row ${showEliminationControl ? "answer-option-row-with-tool" : ""} ${eliminated ? "answer-option-row-eliminated" : ""}`}>
                <label className={`answer-option ${response === option.letter ? "answer-option-selected" : ""}`}>
                  <input type="radio" name="answer" value={option.letter} checked={response === option.letter} disabled={eliminated} onChange={() => { setResponse(option.letter); clearMiss(); }} />
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
        : <div>
          <label className="form-label" htmlFor={`answer-${question.id}`}>Your answer</label>
          <div className="math-answer-row mt-2">
            <input id={`answer-${question.id}`} className="input math-answer-input" value={response} maxLength={MAX_MATH_RESPONSE_LENGTH} disabled={solved} onChange={(event) => { setResponse(event.target.value); clearMiss(); }} placeholder="e.g. 5/3 or 0.75" inputMode="text" autoCapitalize="none" autoComplete="off" spellCheck={false} />
            <span className={`math-answer-preview ${response.trim() ? "" : "math-answer-preview-empty"}`} aria-label="Rendered answer">{response.trim() ? <MathExpression value={response} /> : "Preview"}</span>
          </div>
        </div>}

        {feedback && !feedback.correct && <div className="feedback-band feedback-band-bad" role="status">
          <span className="feedback-icon"><RotateCcw className="size-5" aria-hidden="true" /></span>
          <div><h2>Not yet.</h2><p>Attempt {misses} recorded. Pick again and check.</p></div>
        </div>}
        {solved && feedback && <div className="feedback-band feedback-band-good" role="status">
          <span className="feedback-icon"><CheckCircle2 className="size-5" aria-hidden="true" /></span>
          <div>
            <h2>{feedback.firstAttempt ? "Correct, first try." : `Correct on attempt ${misses + 1}.`}</h2>
            <p>{feedback.firstAttempt ? "Mastered. It leaves your pool." : "Comes back until solved first try."}</p>
          </div>
        </div>}
        {alsoAccepted.length > 0 && <p className="also-accepted"><span>Also accepted:</span><span className="also-accepted-values">{alsoAccepted.map((answer, index) => <span key={`${answer}:${index}`}>{index > 0 && <span className="also-accepted-separator">or</span>}<MathExpression value={answer} /></span>)}</span></p>}
        {solved && feedback?.rationaleHtml && <div className="rationale"><p className="eyebrow">Explanation</p><QuestionHtml html={feedback.rationaleHtml} /></div>}
        {error && <p className="form-error" role="alert">{error}</p>}

        {solved
          ? <button className="btn btn-primary btn-lg w-full" onClick={next} disabled={loading}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : feedback?.completed ? "Finish" : <>Next <ArrowRight className="size-4" aria-hidden="true" /></>}</button>
          : <button className="btn btn-primary btn-lg w-full" onClick={check} disabled={loading || !response}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : "Check"}</button>}

        <p className="meta-line">
          <span>{question.domainName}</span>
          <span>{question.skillName}</span>
          <span className={question.difficulty === "hard" ? "accent" : ""}>{question.difficulty === "hard" ? "Hard" : "Medium"}</span>
          {question.retryCount > 0 && <span>Retry {question.retryCount}</span>}
          <span className="id">ID {question.displayId}</span>
        </p>
      </section>
    </div>
  </div>;
}
