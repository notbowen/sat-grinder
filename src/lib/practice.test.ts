import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { answerAttempts, questions, user, userQuestionProgress } from "@/db/schema";
import { db, sqlite } from "@/lib/db";
import { createPracticeSession, submitPracticeAnswer } from "@/lib/practice";

const userId = "practice-test-user";
const questionId = "practice-test-question";

beforeAll(() => {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const now = new Date();
  db.insert(user).values({ id: userId, name: "Practice Test", email: "practice@test.invalid", emailVerified: true, createdAt: now, updatedAt: now, username: "practice-test", displayUsername: "practice-test", mustChangePassword: false }).run();
  db.insert(questions).values({
    id: questionId, displayId: "TEST-1", section: "math", domainCode: "H", domainName: "Algebra",
    skillCode: "H.A", skillName: "Linear equations", difficulty: "hard", type: "mcq",
    stimulusHtml: null, stemHtml: "<p>Choose A.</p>", rationaleHtml: "<p>A is correct.</p>",
    answerOptions: ["A", "B", "C", "D"].map((letter) => ({ letter, content: `<p>${letter}</p>` })),
    correctAnswers: ["A"], contentHash: "test", createdAt: now, updatedAt: now,
  }).run();
});

afterAll(() => {
  sqlite.close();
  const testDataDir = process.env.TEST_DATA_DIR;
  if (testDataDir?.startsWith(path.join(process.env.TMPDIR ?? "/tmp", "sat-grinder-test-"))) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

describe("practice mastery lifecycle", () => {
  it("keeps a missed question in review until a future first-try solve", async () => {
    const firstSession = await createPracticeSession(userId, "random", 1, []);
    await expect(createPracticeSession(userId, "random", 1, [])).rejects.toMatchObject({ status: 409 });
    const miss = await submitPracticeAnswer(userId, firstSession, questionId, "B");
    expect(miss.correct).toBe(false);
    expect(db.select().from(userQuestionProgress).where(eq(userQuestionProgress.questionId, questionId)).get()?.status).toBe("review");

    const retry = await submitPracticeAnswer(userId, firstSession, questionId, "A");
    expect(retry).toMatchObject({ correct: true, firstAttempt: false, completed: true });
    expect(db.select().from(userQuestionProgress).where(eq(userQuestionProgress.questionId, questionId)).get()?.status).toBe("review");

    const secondSession = await createPracticeSession(userId, "random", 1, []);
    const cleanSolve = await submitPracticeAnswer(userId, secondSession, questionId, "A");
    expect(cleanSolve).toMatchObject({ correct: true, firstAttempt: true, completed: true });
    expect(db.select().from(userQuestionProgress).where(eq(userQuestionProgress.questionId, questionId)).get()?.status).toBe("mastered");
    expect(db.select().from(answerAttempts).all()).toHaveLength(3);
  });
});
