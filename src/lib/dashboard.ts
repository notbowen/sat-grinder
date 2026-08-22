import "server-only";
import { and, eq } from "drizzle-orm";
import { practiceSessions, questions, userQuestionProgress } from "@/db/schema";
import { db } from "@/lib/db";

export async function getDashboard(userId: string) {
  const [bank, progress, active] = await Promise.all([
    db.select({ id: questions.id, section: questions.section, domainCode: questions.domainCode, domainName: questions.domainName, skillCode: questions.skillCode, skillName: questions.skillName }).from(questions).where(and(eq(questions.isRetired, false), eq(questions.isActiveTest, false))),
    db.select().from(userQuestionProgress).where(eq(userQuestionProgress.userId, userId)),
    db.select({ id: practiceSessions.id, mode: practiceSessions.mode, requestedCount: practiceSessions.requestedCount }).from(practiceSessions).where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.status, "active"))).limit(1),
  ]);
  const progressByQuestion = new Map(progress.map((item) => [item.questionId, item.status]));
  const mastered = bank.filter((item) => progressByQuestion.get(item.id) === "mastered").length;
  const review = bank.filter((item) => progressByQuestion.get(item.id) === "review").length;
  const sections = (["reading-writing", "math"] as const).map((section) => {
    const sectionQuestions = bank.filter((question) => question.section === section);
    return { section, label: section === "math" ? "Math" : "Reading & Writing", total: sectionQuestions.length, mastered: sectionQuestions.filter((question) => progressByQuestion.get(question.id) === "mastered").length };
  });
  const topicMap = new Map<string, { section: string; domain: string; skill: string; total: number; mastered: number; review: number }>();
  for (const question of bank) {
    const key = `${question.section}:${question.domainCode}:${question.skillCode}`;
    const item = topicMap.get(key) ?? { section: question.section, domain: question.domainName, skill: question.skillName, total: 0, mastered: 0, review: 0 };
    item.total++; const status = progressByQuestion.get(question.id); if (status === "mastered") item.mastered++; if (status === "review") item.review++; topicMap.set(key, item);
  }
  return { total: bank.length, mastered, remaining: Math.max(0, bank.length - mastered), review, sections, topics: [...topicMap.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.skill.localeCompare(b.skill)), activeSession: active[0] ?? null };
}
