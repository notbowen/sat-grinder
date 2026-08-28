"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Calculator, CheckCircle2, RotateCcw, Shuffle, Trophy } from "lucide-react";
import { Wordmark } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ColumnChart, LineChart, SegmentBar, Sparkline } from "@/components/charts";

/* ------------------------------------------------------------------ */
/* Demo 01 — a self-contained, interactive Bluebook-style question.     */
/* Original sample text; not drawn from any College Board material.     */
/* ------------------------------------------------------------------ */

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

  return <div className="quiz-layout">
    <section>
      <div className="quiz-topbar">
        <div><p className="eyebrow">Question 4 of 10</p><div className="chips"><span className="chip question-id-chip">ID demo-01</span><span className="chip">Reading & Writing</span><span className="chip">Craft and Structure</span><span className="chip">Words in Context</span><span className="chip chip-accent">hard</span></div></div>
      </div>
      <div className="progress-track" aria-hidden="true"><div style={{ width: "30%" }} /></div>
      <article className="question-card">
        <div className="question-html">
          <p>Although the committee&rsquo;s report was widely praised for its thoroughness, several members privately conceded that its recommendations were <span className="question-annotation question-annotation-yellow">sound in principle but nearly impossible to carry out</span> on the city&rsquo;s budget&mdash;in a word, ______.</p>
          <p>Which choice completes the text with the most logical and precise word or phrase?</p>
        </div>
        <div className="mt-8">
          <fieldset disabled={result === "correct"}>
            <legend className="sr-only">Answer choices</legend>
            <div className="answer-choice-toolbar">
              <span>Cross out choices you think are wrong.</span>
              <button type="button" className={`choice-eliminator-toggle ${eliminator ? "choice-eliminator-toggle-active" : ""}`} aria-pressed={eliminator} onClick={() => setEliminator((value) => !value)}><span className="choice-eliminator-icon" aria-hidden="true">ABC</span>{eliminator ? "Eliminator on" : "Eliminate choices"}</button>
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
        </div>
      </article>
    </section>
    <aside className="feedback-panel" aria-live="polite">
      {result === "idle" && <><p className="eyebrow">Check your work</p><h3 className="section-title">Ready?</h3><p className="feedback-copy">Feedback is instant. A miss keeps the question open; a retry never counts as clean.</p><button type="button" className="btn btn-primary mt-6 w-full" onClick={check} disabled={!selected}>Check answer</button></>}
      {result === "incorrect" && <><span className="feedback-icon incorrect"><RotateCcw className="size-5" aria-hidden="true" /></span><p className="eyebrow mt-5" style={{ color: "var(--accent)" }}>Keep going</p><h3 className="section-title">Not quite.</h3><p className="feedback-copy">Attempt {attempts} recorded. This question stays in review until you solve it clean.</p><button type="button" className="btn btn-secondary mt-6 w-full" onClick={() => setResult("idle")}>Try again</button></>}
      {result === "correct" && <><span className="feedback-icon correct"><CheckCircle2 className="size-5" aria-hidden="true" /></span><p className="eyebrow mt-5" style={{ color: "var(--good)" }}>Correct</p><h3 className="section-title">{attempts === 1 ? "Mastered." : "Got there."}</h3><p className="feedback-copy">{attempts === 1 ? "Clean first attempt. The question leaves your pool." : `Solved on attempt ${attempts}. Counts as done, not clean, and stays eligible for review.`}</p><div className="rationale mt-5 border-t pt-4" style={{ borderColor: "var(--line)" }}><p className="eyebrow">Explanation</p><div className="question-html mt-2"><p>The sentence contrasts &ldquo;sound in principle&rdquo; with &ldquo;nearly impossible to carry out,&rdquo; which is the definition of <b>impractical</b>. The other choices describe flaws the text never mentions.</p></div></div><button type="button" className="btn btn-primary mt-6 w-full" onClick={reset}>Run it again <ArrowRight className="size-4" aria-hidden="true" /></button></>}
    </aside>
  </div>;
}

/* ------------------------------------------------------------------ */
/* Demo 02 — random practice setup, simulated.                          */
/* Sample pool: 1,368 unmastered questions (matches Demo 03's numbers). */
/* ------------------------------------------------------------------ */

type DemoSubject = "mixed" | "math" | "english";
const demoSubjects: { value: DemoSubject; label: string; description: string; pool: number; icon: typeof BookOpen }[] = [
  { value: "mixed", label: "Mix", description: "Math and English", pool: 1368, icon: Shuffle },
  { value: "math", label: "Math only", description: "Math", pool: 660, icon: Calculator },
  { value: "english", label: "English only", description: "Reading & Writing", pool: 708, icon: BookOpen },
];
const demoSizes = [5, 10, 20, 30, 50];

function DemoSetup({ href }: { href: string }) {
  const [subject, setSubject] = useState<DemoSubject>("mixed");
  const [count, setCount] = useState(10);
  const selected = demoSubjects.find((option) => option.value === subject) ?? demoSubjects[0];
  return <div>
    <fieldset>
      <legend className="eyebrow">Question mix</legend>
      <div className="mt-4 grid gap-3">
        {demoSubjects.map(({ value, label, description, pool, icon: Icon }) => <label key={value} className="subject-option">
          <input type="radio" name="demo-subject" value={value} checked={subject === value} onChange={() => setSubject(value)} />
          <span className="subject-option-icon"><Icon className="size-4" aria-hidden="true" /></span>
          <span><strong>{label}</strong><small>{description}</small></span>
          <span className="subject-option-count">{pool.toLocaleString()}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="pool-callout">
      <p className="stat-label">Quiz size</p>
      <div className="count-presets" role="group" aria-label="Quiz size" style={{ marginTop: ".25rem" }}>
        {demoSizes.map((size) => <button key={size} type="button" className={count === size ? "active" : ""} aria-pressed={count === size} onClick={() => setCount(size)}>{size}</button>)}
      </div>
      <div className="hero-number-row mt-4" aria-live="polite"><p className="hero-number">{count}</p><span>{selected.label === "Mix" ? "mixed" : selected.label.replace(" only", "")} questions from {selected.pool.toLocaleString()} unmastered</span></div>
      <p className="panel-copy" style={{ maxWidth: "34rem" }}>Every unmastered question in the mix has the same odds, review or unseen. Mastered questions never come back.</p>
      <div className="mt-2"><Link href={href} className="btn btn-primary btn-sm">Start a real one <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ */
/* Demo 03 — the review-queue mechanic, simulated.                      */
/* ------------------------------------------------------------------ */

function DemoQueue() {
  const [state, setState] = useState({ mastered: 132, review: 9, unseen: 1359, log: [] as string[] });
  const total = state.mastered + state.review + state.unseen;
  function answer(clean: boolean, fromReview: boolean) {
    setState((current) => {
      const next = { ...current, log: [...current.log] };
      if (fromReview) {
        if (current.review === 0) return current;
        next.review -= 1; next.mastered += 1;
        next.log.unshift("Review question solved: mastered.");
      } else if (clean) {
        next.unseen -= 1; next.mastered += 1;
        next.log.unshift("Clean first attempt: mastered.");
      } else {
        next.unseen -= 1; next.review += 1;
        next.log.unshift("Missed: added to review.");
      }
      next.log = next.log.slice(0, 4);
      return next;
    });
  }
  return <div>
    <p className="stat-label">Sample bank · {total.toLocaleString()} questions</p>
    <div className="hero-number-row mt-2"><p className="hero-number">{Math.round(state.mastered * 100 / total)}%</p><span>mastered</span></div>
    <div className="mt-5"><SegmentBar total={total} legend segments={[
      { key: "mastered", label: "Mastered", value: state.mastered, fill: "mastered" },
      { key: "review", label: "In review", value: state.review, fill: "review" },
      { key: "unseen", label: "Unseen", value: state.unseen, fill: "unseen" },
    ]} /></div>
    <div className="mt-6 flex flex-wrap gap-2">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => answer(true, false)}>Clean solve</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => answer(false, false)}>Miss one</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => answer(true, true)} disabled={state.review === 0}>Clear a review item</button>
    </div>
    <ol className="list-rows mt-5" aria-live="polite" aria-label="Simulation log">
      {state.log.length ? state.log.map((entry, index) => <li key={`${entry}-${index}`} style={{ gridTemplateColumns: "minmax(0,1fr)" }}><span className="small">{entry}</span></li>) : <li style={{ gridTemplateColumns: "minmax(0,1fr)" }}><span className="small muted">Press a button to move one question through the pool.</span></li>}
    </ol>
  </div>;
}

/* ------------------------------------------------------------------ */
/* Demo 04 — sample analytics.                                          */
/* ------------------------------------------------------------------ */

const sampleTrend = [
  ["Aug 15", 12, 58], ["Aug 16", 20, 65], ["Aug 17", 0, null], ["Aug 18", 24, 62], ["Aug 19", 18, 72], ["Aug 20", 30, 70], ["Aug 21", 10, 80],
  ["Aug 22", 26, 69], ["Aug 23", 0, null], ["Aug 24", 32, 75], ["Aug 25", 22, 77], ["Aug 26", 28, 82], ["Aug 27", 16, 81], ["Aug 28", 24, 83],
] as const;

function DemoAnalytics() {
  const completed = sampleTrend.map(([label, value]) => ({ label, value }));
  const rate = sampleTrend.map(([label, , value]) => ({ label, value }));
  return <div>
    <div className="stat-grid stat-grid-4">
      <article className="stat"><p className="stat-label">Questions completed</p><p className="stat-value">262</p><p className="stat-detail">Including retries</p><Sparkline values={completed.map((point) => point.value)} /></article>
      <article className="stat"><p className="stat-label">Clean-solve rate</p><p className="stat-value">74%</p><p className="stat-detail">194 of 262 on the first try</p><span className="stat-delta up">+9 pts vs prior period</span></article>
      <article className="stat"><p className="stat-label">Active study time</p><p className="stat-value">6h 40m</p><p className="stat-detail">248 timed attempts</p></article>
      <article className="stat"><p className="stat-label">Newly mastered</p><p className="stat-value">194</p><p className="stat-detail">Clean first attempts</p></article>
    </div>
    <div className="grid-12 mt-8">
      <div className="span-6"><ColumnChart title="Questions completed" subtitle="Per day" points={completed} format={(value) => String(value)} unit="Completed" height={170} /></div>
      <div className="span-6"><LineChart title="Clean-solve rate" subtitle="Right on the first try" points={rate} format={(value) => `${Math.round(value)}%`} unit="Clean solve" height={170} /></div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ */

export function Landing() {
  const { user, loading } = useAuth();
  const primaryHref = user ? "/dashboard/" : "/login/";
  const practiceHref = user ? "/practice/random/" : "/login/";
  const primaryLabel = user ? "Open dashboard" : "Start practising";

  return <div className="landing">
    <header className="landing-header"><div className="container landing-header-inner">
      <Wordmark />
      <nav aria-label="Landing navigation">
        <a href="#demos" className="nav-link">How it works</a>
        <a href="#practice" className="nav-link">Practice</a>
        <a href="#analytics" className="nav-link">Analytics</a>
        {loading ? null : <Link href={primaryHref} className="btn btn-primary btn-sm">{user ? "Dashboard" : "Sign in"}</Link>}
      </nav>
    </div></header>

    <section className="container hero">
      <div>
        <p className="eyebrow">Digital SAT · medium and hard only</p>
        <h1 className="hero-title">Turn hard questions into <em>familiar</em> ones.</h1>
        <p className="hero-copy">Bluebook-style Reading &amp; Writing and Math questions, graded instantly. Miss one and it comes back until you get it right. Stats show what you can do, not just what you have seen.</p>
        <div className="hero-actions">
          <Link href={primaryHref} className="btn btn-primary">{primaryLabel} <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <a href="#demos" className="btn btn-secondary">Try a question</a>
        </div>
      </div>
      <div className="hero-facts" aria-label="Key facts">
        <div><span>01</span><p><strong>Looks like Bluebook</strong>Highlighting, cross-outs, and math answers with live preview.</p></div>
        <div><span>02</span><p><strong>Misses come back</strong>Every wrong answer returns until you solve it clean. Retries are counted.</p></div>
        <div><span>03</span><p><strong>Rates show their n</strong>Every percentage comes with its sample size. Two for two is not mastery.</p></div>
      </div>
    </section>

    <div className="marquee" aria-hidden="true"><div className="container marquee-inner"><span>Reading &amp; Writing</span><span>Math</span><span>Highlight &amp; annotate</span><span>Cross out choices</span><span>Random practice</span><span>Review queue</span><span>Analytics</span><span>Friends leaderboard</span></div></div>

    <section id="demos" className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">01</p>
        <div><h2 className="demo-title">Questions look like Bluebook.</h2><p className="demo-copy">Same serif, choice circles, cross-out tool, and highlighter as test day. Pick an answer and check it. This sample runs in your browser.</p><p className="demo-note"><i aria-hidden="true" />Live demo · original sample question</p></div>
      </div>
      <div className="demo-stage"><DemoQuestion /></div>
    </div></section>

    <section id="practice" className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">02</p>
        <div><h2 className="demo-title">Pick a mix. Pick a size. Go.</h2><p className="demo-copy">Both sections, Math only, or English only, 1 to 50 questions per quiz. The bank picks at random from everything you have not mastered.</p><p className="demo-note"><i aria-hidden="true" />Interactive · sample pool</p></div>
      </div>
      <div className="demo-grid demo-grid-reverse">
        <div className="demo-stage demo-stage-plain"><DemoSetup href={practiceHref} /></div>
        <ol className="flow" aria-label="How random practice works">
          <li className="flow-step"><span>01</span><div><strong>Choose a mix</strong><p>Mix, Math only, or English only. Each shows how many questions you have left.</p></div></li>
          <li className="flow-step"><span>02</span><div><strong>Choose a size</strong><p>1 to 50 questions. Stop early and your answers are kept.</p></div></li>
          <li className="flow-step flow-step-accent"><span>03</span><div><strong>Equal odds</strong><p>Unseen and review questions are drawn alike. Mastered ones are out.</p></div></li>
          <li className="flow-step"><span>04</span><div><strong>Timed on screen</strong><p>The clock runs only while a question is in front of you.</p></div></li>
        </ol>
      </div>
    </div></section>

    <section className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">03</p>
        <div><h2 className="demo-title">Misses come back until you get them right.</h2><p className="demo-copy">A question leaves your pool only when you answer it right on the first try. Miss it and it joins the review queue, mixed into random practice with unseen questions.</p><p className="demo-note"><i aria-hidden="true" />Interactive simulation · sample numbers</p></div>
      </div>
      <div className="demo-grid">
        <ol className="flow" aria-label="How a question moves through the pool">
          <li className="flow-step"><span>01</span><div><strong>Unseen</strong><p>Every medium and hard question starts here.</p></div></li>
          <li className="flow-step"><span>02</span><div><strong>Attempt</strong><p>Answer with the timer running. Only on-screen time counts.</p></div></li>
          <li className="flow-step flow-step-accent"><span>03</span><div><strong>Review</strong><p>A miss records a retry and queues the question. Age counts from the last miss.</p></div></li>
          <li className="flow-step"><span>04</span><div><strong>Mastered</strong><p>A correct answer retires it. Only a clean first attempt counts toward your clean-solve rate.</p></div></li>
        </ol>
        <div className="demo-stage demo-stage-plain"><DemoQueue /></div>
      </div>
    </div></section>

    <section id="analytics" className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">04</p>
        <div><h2 className="demo-title">Progress at a glance. Detail on demand.</h2><p className="demo-copy">The dashboard has five numbers and two charts. Statistics has every skill, domain, session, and trend, with filters that recompute each rate.</p><p className="demo-note"><i aria-hidden="true" />Sample data</p></div>
      </div>
      <div className="demo-stage"><DemoAnalytics /></div>
    </div></section>

    <section className="demo"><div className="container">
      <div className="demo-head">
        <p className="demo-index" aria-hidden="true">05</p>
        <div><h2 className="demo-title">Compare with friends. No global leaderboard.</h2><p className="demo-copy">Invite by email, approve each connection, and compare completed questions, clean-solve rate, and active time over any window.</p><p className="demo-note"><i aria-hidden="true" />Sample standings</p></div>
      </div>
      <div className="demo-stage demo-stage-plain demo-table" style={{ padding: 0 }}>
        <table className="data-table" aria-label="Sample friends leaderboard">
          <thead><tr><th>Rank</th><th style={{ textAlign: "left" }}>Friend</th><th>Completed</th><th>Clean solve</th><th>Active time</th><th>Days</th></tr></thead>
          <tbody>
            <tr><td><Trophy className="size-4" style={{ color: "var(--accent)" }} aria-label="Rank 1" /></td><td style={{ textAlign: "left" }}><strong>Mei</strong><small>You</small></td><td>262</td><td><strong>74%</strong><small>n=262</small></td><td>6h 40m</td><td>12</td></tr>
            <tr><td>#2</td><td style={{ textAlign: "left" }}><strong>Arjun</strong></td><td>240</td><td><strong>71%</strong><small>n=240</small></td><td>5h 55m</td><td>11</td></tr>
            <tr><td>#3</td><td style={{ textAlign: "left" }}><strong>Sofia</strong></td><td>198</td><td><strong>79%</strong><small>n=198</small></td><td>4h 10m</td><td>9</td></tr>
          </tbody>
        </table>
      </div>
    </div></section>

    <section className="cta-block"><div className="container grid-12">
      <div className="span-8"><h2 className="display-1">Ten questions a day is <em className="serif-italic" style={{ color: "var(--accent)" }}>three hundred</em> a month.</h2></div>
      <div className="span-4 flex flex-col justify-end gap-4"><p className="lede">Sign in with Google. Progress, review queue, and stats are saved to your account.</p><Link href={primaryHref} className="btn btn-primary">{primaryLabel} <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
    </div></section>

    <footer className="landing-footer"><div className="container landing-footer-grid">
      <div><Wordmark /><p className="colophon mt-4">Digital SAT practice, built on Bluebook conventions.</p></div>
      <div className="colophon"><strong>Sections</strong><br />Reading &amp; Writing<br />Math<br />Mixed sets</div>
      <div className="colophon"><strong>Type</strong><br />Space Grotesk<br />Newsreader<br />Noto Serif for questions</div>
      <div className="colophon"><strong>Independent</strong><br />SAT is a trademark of the College Board, which is not affiliated with and does not endorse this site.</div>
    </div></footer>
  </div>;
}
