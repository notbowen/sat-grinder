"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Highlighter, RotateCcw } from "lucide-react";
import { Wordmark } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ColumnChart, LineChart, SegmentBar } from "@/components/charts";
import { HighlightableQuestionHtml } from "@/components/highlightable-question-html";

/* ------------------------------------------------------------------ */
/* Demo 01 — a self-contained question in the split layout of a set.   */
/* Original sample text; not drawn from any College Board material.     */
/* ------------------------------------------------------------------ */

const demoPassage = "<p>Although the committee&rsquo;s report was widely praised for its thoroughness, several members privately conceded that its recommendations were sound in principle but nearly impossible to carry out on the city&rsquo;s budget&mdash;in a word, ______.</p>";
const demoChoices = [
  { letter: "A", text: "impractical" },
  { letter: "B", text: "inconsistent" },
  { letter: "C", text: "redundant" },
  { letter: "D", text: "tentative" },
];
const demoAnswer = "A";

function DemoQuestion() {
  const [selected, setSelected] = useState("");
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [eliminator, setEliminator] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<"idle" | "correct" | "incorrect">("idle");

  function toggleEliminate(letter: string) {
    setEliminated((current) => current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter]);
    if (selected === letter) setSelected("");
    if (result === "incorrect") setResult("idle");
  }
  function check() {
    setAttempts((count) => count + 1);
    setResult(selected === demoAnswer ? "correct" : "incorrect");
  }
  function reset() { setSelected(""); setEliminated([]); setAttempts(0); setResult("idle"); }

  return <div className="demo-stage demo-stage-split">
    <div>
      <p className="annotation-hint"><Highlighter className="size-3.5" aria-hidden="true" /><span>Select text to highlight</span></p>
      <HighlightableQuestionHtml html={demoPassage} storageKey="landing-demo:stimulus" />
    </div>
    <div>
      <div className="question-html"><p>Which choice completes the text with the most logical and precise word or phrase?</p></div>
      <fieldset disabled={result === "correct"}>
        <legend className="sr-only">Answer choices</legend>
        <div className="answer-choice-toolbar">
          <button type="button" className={`choice-eliminator-toggle ${eliminator ? "choice-eliminator-toggle-active" : ""}`} aria-pressed={eliminator} onClick={() => setEliminator((value) => !value)}><span className="choice-eliminator-icon" aria-hidden="true">ABC</span>Cross out</button>
        </div>
        <div className="answer-list">
          {demoChoices.map((choice) => {
            const isEliminated = eliminated.includes(choice.letter);
            const showTool = eliminator || isEliminated;
            return <div key={choice.letter} className={`answer-option-row ${showTool ? "answer-option-row-with-tool" : ""} ${isEliminated ? "answer-option-row-eliminated" : ""}`}>
              <label className={`answer-option ${selected === choice.letter ? "answer-option-selected" : ""}`}>
                <input type="radio" name="demo-answer" value={choice.letter} checked={selected === choice.letter} disabled={isEliminated} onChange={() => { setSelected(choice.letter); if (result === "incorrect") setResult("idle"); }} />
                <span className="answer-letter">{choice.letter}</span>
                <span className="answer-option-content"><div className="question-html">{choice.text}</div></span>
              </label>
              {showTool && <button type="button" className={`answer-eliminate-button ${isEliminated ? "answer-eliminate-button-undo" : ""}`} aria-label={isEliminated ? `Undo elimination of choice ${choice.letter}` : `Cross out choice ${choice.letter}`} onClick={() => toggleEliminate(choice.letter)}>
                {isEliminated ? <><RotateCcw className="size-4" aria-hidden="true" /><span>Undo</span></> : <span className="answer-eliminate-icon" aria-hidden="true">{choice.letter}</span>}
              </button>}
            </div>;
          })}
        </div>
      </fieldset>
      {result === "incorrect" && <div className="feedback-band feedback-band-bad" role="status">
        <span className="feedback-icon"><RotateCcw className="size-5" aria-hidden="true" /></span>
        <div><h3>Not yet.</h3><p>Attempt {attempts} recorded. Pick again and check.</p></div>
      </div>}
      {result === "correct" && <>
        <div className="feedback-band feedback-band-good" role="status">
          <span className="feedback-icon"><CheckCircle2 className="size-5" aria-hidden="true" /></span>
          <div><h3>{attempts === 1 ? "Correct, first try." : `Correct on attempt ${attempts}.`}</h3><p>{attempts === 1 ? "Mastered. It leaves your pool." : "Comes back until solved first try."}</p></div>
        </div>
        <div className="rationale"><p className="eyebrow">Explanation</p><div className="question-html"><p>The sentence contrasts &ldquo;sound in principle&rdquo; with &ldquo;nearly impossible to carry out,&rdquo; which is the definition of <b>impractical</b>. The other choices describe flaws the text never mentions.</p></div></div>
      </>}
      {result === "correct"
        ? <button type="button" className="btn btn-primary btn-lg w-full" onClick={reset}>Again <ArrowRight className="size-4" aria-hidden="true" /></button>
        : <button type="button" className="btn btn-primary btn-lg w-full" onClick={check} disabled={!selected}>Check</button>}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ */
/* Demo 02 — the review mechanic, simulated.                            */
/* ------------------------------------------------------------------ */

function DemoQueue() {
  const [state, setState] = useState({ mastered: 236, review: 9, unseen: 1255, log: [] as string[] });
  const total = state.mastered + state.review + state.unseen;
  function answer(clean: boolean, fromReview: boolean) {
    setState((current) => {
      const next = { ...current, log: [...current.log] };
      if (fromReview) {
        if (current.review === 0) return current;
        next.review -= 1; next.mastered += 1;
        next.log.unshift("Solved from review: mastered.");
      } else if (clean) {
        next.unseen -= 1; next.mastered += 1;
        next.log.unshift("Solved first try: mastered.");
      } else {
        next.unseen -= 1; next.review += 1;
        next.log.unshift("Missed: to review.");
      }
      next.log = next.log.slice(0, 4);
      return next;
    });
  }
  return <div className="demo-stage demo-stage-plain" style={{ display: "grid", gap: "1.25rem" }}>
    <p className="stat-label">Sample bank · {total.toLocaleString()} questions</p>
    <div className="hero-number-row"><p className="hero-number num">{Math.round(state.mastered * 100 / total)}%</p><span>mastered</span></div>
    <div><SegmentBar total={total} legend segments={[
      { key: "mastered", label: "Mastered", value: state.mastered, fill: "mastered" },
      { key: "review", label: "In review", value: state.review, fill: "review" },
      { key: "unseen", label: "Unseen", value: state.unseen, fill: "unseen" },
    ]} /></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => answer(true, false)}>Solve first try</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => answer(false, false)}>Miss</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => answer(true, true)} disabled={state.review === 0}>Solve from review</button>
    </div>
    <ol className="list-rows" aria-live="polite" aria-label="Simulation log">
      {state.log.length ? state.log.map((entry, index) => <li key={`${entry}-${index}`} style={{ gridTemplateColumns: "minmax(0,1fr)" }}><span className="small">{entry}</span></li>) : <li style={{ gridTemplateColumns: "minmax(0,1fr)" }}><span className="small muted">Press a button.</span></li>}
    </ol>
  </div>;
}

/* ------------------------------------------------------------------ */
/* Demo 03 — sample analytics.                                          */
/* ------------------------------------------------------------------ */

const sampleTrend = [
  ["Aug 15", 12, 58], ["Aug 16", 20, 65], ["Aug 17", 0, null], ["Aug 18", 24, 62], ["Aug 19", 18, 72], ["Aug 20", 30, 70], ["Aug 21", 10, 80],
  ["Aug 22", 26, 69], ["Aug 23", 0, null], ["Aug 24", 32, 75], ["Aug 25", 22, 77], ["Aug 26", 28, 82], ["Aug 27", 16, 81], ["Aug 28", 24, 83],
] as const;

function DemoAnalytics() {
  const completed = sampleTrend.map(([label, value]) => ({ label, value }));
  const rate = sampleTrend.map(([label, , value]) => ({ label, value }));
  return <div className="demo-stage" style={{ display: "grid", gap: "2rem" }}>
    <div className="stat-grid">
      <article className="stat"><p className="stat-label">Completed</p><p className="stat-value num">262</p><p className="stat-detail">incl. retries</p></article>
      <article className="stat"><p className="stat-label">Clean solve</p><p className="stat-value num">74%</p><p className="stat-detail">194 of 262 first try</p><span className="stat-delta up">+9 pts vs prior month</span></article>
      <article className="stat"><p className="stat-label">Active time</p><p className="stat-value num">6h 40m</p><p className="stat-detail">248 timed</p></article>
      <article className="stat"><p className="stat-label">Retried</p><p className="stat-value num">18%</p><p className="stat-detail">47 of 262 needed a second try</p></article>
    </div>
    <div className="grid-12">
      <div className="span-6"><ColumnChart title="Completed" subtitle="Per day" points={completed} format={(value) => String(value)} unit="Completed" height={170} /></div>
      <div className="span-6"><LineChart title="Clean solve" points={rate} format={(value) => `${Math.round(value)}%`} unit="Clean solve" height={170} /></div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ */

export function Landing() {
  const { user, loading } = useAuth();
  const primaryHref = user ? "/practice/" : "/login/";
  const primaryLabel = user ? "Practice" : "Start practising";

  return <div className="landing">
    <header className="landing-header"><div className="container landing-header-inner">
      <Wordmark />
      <nav aria-label="Landing navigation">
        <a href="#demos" className="nav-link">How it works</a>
        {loading ? null : <Link href={primaryHref} className="btn btn-primary btn-sm">{user ? "Practice" : "Sign in"}</Link>}
      </nav>
    </div></header>

    <section className="container hero">
      <div>
        <p className="eyebrow">Digital SAT · medium and hard</p>
        <h1 className="hero-title">Turn hard questions into <em>familiar</em> ones.</h1>
        <p className="hero-copy">Reading &amp; Writing and Math, graded instantly. Miss one and it comes back until you solve it first try.</p>
        <div className="hero-actions">
          <Link href={primaryHref} className="btn btn-primary">{primaryLabel} <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <a href="#demos" className="btn btn-secondary">Try a question <ArrowRight className="size-4" aria-hidden="true" /></a>
        </div>
      </div>
      <div className="hero-facts" aria-label="Key facts">
        <div><span>01</span><p><strong>Looks like test day</strong>Highlighter, cross-outs, math input.</p></div>
        <div><span>02</span><p><strong>Misses come back</strong>Until solved first try. Retries counted.</p></div>
        <div><span>03</span><p><strong>Rates show their n</strong>Two for two is not mastery.</p></div>
      </div>
    </section>

    <section id="demos" className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">01</p>
        <div><h2 className="demo-title">Looks like test day.</h2><p className="demo-copy">Same serif, choice circles, cross-outs, highlighter. Try it.</p><p className="demo-note"><i aria-hidden="true" />Live demo · original sample question</p></div>
      </div>
      <DemoQuestion />
    </div></section>

    <section className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">02</p>
        <div><h2 className="demo-title">Misses come back.</h2><p className="demo-copy">A miss goes to review. It comes back in later sets until you solve it first try.</p><p className="demo-note"><i aria-hidden="true" />Interactive</p></div>
      </div>
      <div className="demo-grid">
        <ol className="flow" aria-label="How a question moves through the pool">
          <li className="flow-step"><span>01</span><div><strong>Unseen</strong><p>Every medium and hard question starts here.</p></div></li>
          <li className="flow-step"><span>02</span><div><strong>Attempt</strong><p>Timed only while the question is on screen.</p></div></li>
          <li className="flow-step flow-step-accent"><span>03</span><div><strong>Review</strong><p>A miss queues it. It comes back in later sets.</p></div></li>
          <li className="flow-step"><span>04</span><div><strong>Mastered</strong><p>A first-try solve retires it.</p></div></li>
        </ol>
        <DemoQueue />
      </div>
    </div></section>

    <section className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">03</p>
        <div><h2 className="demo-title">Every rate shows its n.</h2><p className="demo-copy">Four numbers, two charts, every skill. Filters recompute each rate.</p><p className="demo-note"><i aria-hidden="true" />Sample data</p></div>
      </div>
      <DemoAnalytics />
    </div></section>

    <section className="cta-block"><div className="container grid-12">
      <div className="span-8"><h2 className="display-1">Ten questions a day is <em className="serif-italic" style={{ color: "var(--accent)" }}>three hundred</em> a month.</h2></div>
      <div className="span-4 flex flex-col justify-end gap-4"><p className="lede">Sign in with Google. Everything is saved.</p><Link href={primaryHref} className="btn btn-primary" style={{ width: "fit-content" }}>{primaryLabel} <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
    </div></section>

    <footer className="landing-footer"><div className="container landing-footer-grid">
      <div><Wordmark /><p className="colophon mt-4">Digital SAT practice.</p></div>
      <div className="colophon"><strong>Sections</strong><br />Reading &amp; Writing<br />Math<br />Mix</div>
      <div className="colophon"><strong>Independent</strong><br />SAT is a trademark of the College Board, which is not affiliated with and does not endorse this site.</div>
    </div></footer>
  </div>;
}
