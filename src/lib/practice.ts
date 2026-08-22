import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { answerAttempts, practiceSessionItems, practiceSessions, questions, userQuestionProgress } from "@/db/schema";
import { db } from "@/lib/db";
import { gradeAnswer } from "@/lib/grading";

export class PracticeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function topicPredicate(filters: string[]) {
  const predicates = filters.map((filter) => {
    const [kind, ...parts] = filter.split(":"); const value = parts.join(":");
    if (kind === "section" && (value === "math" || value === "reading-writing")) return eq(questions.section, value);
    if (kind === "domain") return eq(questions.domainCode, value);
    if (kind === "skill") return eq(questions.skillCode, value);
    return undefined;
  }).filter(Boolean);
  return predicates.length ? or(...predicates) : undefined;
}

function eligibleWhere(userId: string, filters: string[] = []) {
  return and(
    eq(questions.isRetired, false),
    eq(questions.isActiveTest, false),
    or(isNull(userQuestionProgress.status), ne(userQuestionProgress.status, "mastered")),
    topicPredicate(filters),
  );
}

export async function getEligibleQuestions(userId: string, filters: string[] = []) {
  return db.select({
    id: questions.id, section: questions.section, domainCode: questions.domainCode, domainName: questions.domainName,
    skillCode: questions.skillCode, skillName: questions.skillName, status: userQuestionProgress.status,
  }).from(questions).leftJoin(userQuestionProgress, and(eq(userQuestionProgress.questionId, questions.id), eq(userQuestionProgress.userId, userId))).where(eligibleWhere(userId, filters));
}

export async function getTopicCatalog(userId: string) {
  const eligible = await getEligibleQuestions(userId);
  const domains = new Map<string, { code: string; name: string; section: "math" | "reading-writing"; count: number; skills: Map<string, { code: string; name: string; count: number }> }>();
  for (const question of eligible) {
    const key = `${question.section}:${question.domainCode}`;
    const domain = domains.get(key) ?? { code: question.domainCode, name: question.domainName, section: question.section, count: 0, skills: new Map() };
    domain.count++;
    const skill = domain.skills.get(question.skillCode) ?? { code: question.skillCode, name: question.skillName, count: 0 };
    skill.count++; domain.skills.set(question.skillCode, skill); domains.set(key, domain);
  }
  return [...domains.values()].map((domain) => ({ ...domain, skills: [...domain.skills.values()].sort((a, b) => a.name.localeCompare(b.name)) })).sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

export async function createPracticeSession(userId: string, mode: "random" | "topics", count: number, filters: string[]) {
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new PracticeError("Choose between 1 and 50 questions.");
  if (mode === "topics" && !filters.length) throw new PracticeError("Choose at least one topic.");
  try {
    return db.transaction((tx) => {
      const active = tx.select({ id: practiceSessions.id }).from(practiceSessions).where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.status, "active"))).limit(1).get();
      if (active) throw new PracticeError("Finish or abandon your active quiz before starting another one.", 409);
      const sampled = tx.select({ id: questions.id }).from(questions)
        .leftJoin(userQuestionProgress, and(eq(userQuestionProgress.questionId, questions.id), eq(userQuestionProgress.userId, userId)))
        .where(eligibleWhere(userId, filters)).orderBy(sql`random()`).limit(count).all();
      if (sampled.length < count) throw new PracticeError(`Only ${sampled.length} eligible question${sampled.length === 1 ? " is" : "s are"} available for that selection.`);
      const id = randomUUID(); const now = new Date();
      tx.insert(practiceSessions).values({ id, userId, mode, requestedCount: count, status: "active", topicFilters: filters, createdAt: now }).run();
      tx.insert(practiceSessionItems).values(sampled.map((question, position) => ({ sessionId: id, questionId: question.id, position }))).run();
      return id;
    });
  } catch (error) {
    if (error instanceof PracticeError) throw error;
    if (error instanceof Error && /UNIQUE constraint failed: practice_sessions\.user_id/.test(error.message)) {
      throw new PracticeError("Finish or abandon your active quiz before starting another one.", 409);
    }
    throw error;
  }
}

export async function getPracticeSession(userId: string, sessionId: string) {
  const practice = await db.select().from(practiceSessions).where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId))).limit(1);
  if (!practice[0]) throw new PracticeError("Quiz not found.", 404);
  const items = await db.select({
    position: practiceSessionItems.position, resolvedAt: practiceSessionItems.resolvedAt, firstAttemptCorrect: practiceSessionItems.firstAttemptCorrect,
    retryCount: practiceSessionItems.retryCount, id: questions.id, displayId: questions.displayId, section: questions.section, domainName: questions.domainName,
    skillName: questions.skillName, difficulty: questions.difficulty, type: questions.type, stimulusHtml: questions.stimulusHtml,
    stemHtml: questions.stemHtml, answerOptions: questions.answerOptions,
  }).from(practiceSessionItems).innerJoin(questions, eq(practiceSessionItems.questionId, questions.id)).where(eq(practiceSessionItems.sessionId, sessionId)).orderBy(asc(practiceSessionItems.position));
  const current = items.find((item) => !item.resolvedAt) ?? null;
  return {
    session: practice[0], total: items.length, resolved: items.filter((item) => item.resolvedAt).length,
    firstAttemptCorrect: items.filter((item) => item.firstAttemptCorrect === true).length,
    current: current ? { ...current, answerOptions: current.answerOptions ?? [] } : null,
  };
}

export async function submitPracticeAnswer(userId: string, sessionId: string, questionId: string, response: string) {
  return db.transaction((tx) => {
    const practice = tx.select().from(practiceSessions).where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId))).limit(1).get();
    if (!practice || practice.status !== "active") throw new PracticeError("This quiz is no longer active.", 409);
    const current = tx.select({ item: practiceSessionItems, question: questions }).from(practiceSessionItems).innerJoin(questions, eq(practiceSessionItems.questionId, questions.id))
      .where(and(eq(practiceSessionItems.sessionId, sessionId), isNull(practiceSessionItems.resolvedAt))).orderBy(asc(practiceSessionItems.position)).limit(1).get();
    if (!current || current.question.id !== questionId) throw new PracticeError("That is not the current question.", 409);
    const result = gradeAnswer(current.question, response);
    if (!result.valid) throw new PracticeError(result.message || "Enter a valid answer.");
    const attemptsBefore = tx.select({ count: sql<number>`count(*)` }).from(answerAttempts).where(and(eq(answerAttempts.sessionId, sessionId), eq(answerAttempts.questionId, questionId))).get()?.count ?? 0;
    const now = new Date();
    tx.insert(answerAttempts).values({ id: randomUUID(), sessionId, questionId, userId, attemptNumber: attemptsBefore + 1, response: response.trim(), isCorrect: result.correct, createdAt: now }).run();
    const existing = tx.select().from(userQuestionProgress).where(and(eq(userQuestionProgress.userId, userId), eq(userQuestionProgress.questionId, questionId))).limit(1).get();
    if (!result.correct) {
      tx.update(practiceSessionItems).set({ retryCount: current.item.retryCount + 1 }).where(and(eq(practiceSessionItems.sessionId, sessionId), eq(practiceSessionItems.questionId, questionId))).run();
      if (attemptsBefore === 0 && existing?.status !== "mastered") {
        tx.insert(userQuestionProgress).values({ userId, questionId, status: "review", firstAttemptMisses: (existing?.firstAttemptMisses ?? 0) + 1, lastAnsweredAt: now })
          .onConflictDoUpdate({ target: [userQuestionProgress.userId, userQuestionProgress.questionId], set: { status: "review", firstAttemptMisses: (existing?.firstAttemptMisses ?? 0) + 1, lastAnsweredAt: now, masteredAt: null } }).run();
      }
      return { correct: false, message: "Not quite. Try it again—you can change your answer before checking.", retries: current.item.retryCount + 1 };
    }
    const firstAttempt = attemptsBefore === 0;
    tx.update(practiceSessionItems).set({ resolvedAt: now, firstAttemptCorrect: firstAttempt }).where(and(eq(practiceSessionItems.sessionId, sessionId), eq(practiceSessionItems.questionId, questionId))).run();
    if (firstAttempt) {
      tx.insert(userQuestionProgress).values({ userId, questionId, status: "mastered", firstAttemptMisses: existing?.firstAttemptMisses ?? 0, lastAnsweredAt: now, masteredAt: now })
        .onConflictDoUpdate({ target: [userQuestionProgress.userId, userQuestionProgress.questionId], set: { status: "mastered", lastAnsweredAt: now, masteredAt: now } }).run();
    } else if (!existing) {
      tx.insert(userQuestionProgress).values({ userId, questionId, status: "review", firstAttemptMisses: 1, lastAnsweredAt: now }).run();
    } else {
      tx.update(userQuestionProgress).set({ lastAnsweredAt: now }).where(and(eq(userQuestionProgress.userId, userId), eq(userQuestionProgress.questionId, questionId))).run();
    }
    const unresolved = tx.select({ count: sql<number>`count(*)` }).from(practiceSessionItems).where(and(eq(practiceSessionItems.sessionId, sessionId), isNull(practiceSessionItems.resolvedAt))).get()?.count ?? 0;
    if (unresolved === 0) tx.update(practiceSessions).set({ status: "completed", completedAt: now }).where(eq(practiceSessions.id, sessionId)).run();
    return { correct: true, firstAttempt, completed: unresolved === 0, message: firstAttempt ? "Correct—mastered on the first try." : "Correct. This one stays in your rotation for a future clean solve.", rationaleHtml: current.question.rationaleHtml, correctAnswers: current.question.correctAnswers };
  });
}

export async function abandonPracticeSession(userId: string, sessionId: string) {
  const changed = await db.update(practiceSessions).set({ status: "abandoned", abandonedAt: new Date() }).where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId), eq(practiceSessions.status, "active"))).returning({ id: practiceSessions.id });
  if (!changed.length) throw new PracticeError("No active quiz was found.", 404);
}
