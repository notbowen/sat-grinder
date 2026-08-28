import type { DashboardData, DashboardSkill } from "@/lib/supabase-api";

/** Skills ranked for attention: lowest clean-solve rate with evidence, else largest review piles. */
export function attentionSkills(data: DashboardData, limit = 4) {
  const enoughEvidence = data.skills.filter((skill) => skill.completed >= 5);
  const source = enoughEvidence.length ? enoughEvidence : data.skills.filter((skill) => skill.review > 0);
  return [...source].sort((a, b) => {
    if (enoughEvidence.length) return (a.cleanSolveRate ?? 101) - (b.cleanSolveRate ?? 101) || b.review - a.review;
    return b.review - a.review || b.retried - a.retried;
  }).slice(0, limit);
}

export type DomainRollup = {
  key: string;
  section: DashboardSkill["section"];
  domain: string;
  skills: number;
  total: number;
  mastered: number;
  review: number;
  unseen: number;
  completed: number;
  cleanSolved: number;
  cleanSolveRate: number | null;
  retried: number;
  retryRate: number | null;
};

/** Aggregates skill rows into their parent domains. Rates are recomputed from counts, never averaged. */
export function domainRollups(skills: DashboardSkill[]): DomainRollup[] {
  const groups = new Map<string, DomainRollup>();
  for (const skill of skills) {
    const key = `${skill.section}:${skill.domain}`;
    const group = groups.get(key) ?? { key, section: skill.section, domain: skill.domain, skills: 0, total: 0, mastered: 0, review: 0, unseen: 0, completed: 0, cleanSolved: 0, cleanSolveRate: null, retried: 0, retryRate: null };
    group.skills += 1;
    group.total += skill.total;
    group.mastered += skill.mastered;
    group.review += skill.review;
    group.unseen += skill.unseen;
    group.completed += skill.completed;
    group.cleanSolved += skill.cleanSolved;
    group.retried += skill.retried;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    cleanSolveRate: group.completed ? Math.round(group.cleanSolved * 1000 / group.completed) / 10 : null,
    retryRate: group.completed ? Math.round(group.retried * 1000 / group.completed) / 10 : null,
  })).sort((a, b) => a.section.localeCompare(b.section) || a.domain.localeCompare(b.domain));
}

/** Totals for an arbitrary slice of skills, so filtered views keep honest denominators. */
export function sliceTotals(skills: DashboardSkill[]) {
  const totals = skills.reduce((sum, skill) => ({
    total: sum.total + skill.total,
    mastered: sum.mastered + skill.mastered,
    review: sum.review + skill.review,
    unseen: sum.unseen + skill.unseen,
    completed: sum.completed + skill.completed,
    cleanSolved: sum.cleanSolved + skill.cleanSolved,
    retried: sum.retried + skill.retried,
  }), { total: 0, mastered: 0, review: 0, unseen: 0, completed: 0, cleanSolved: 0, retried: 0 });
  return {
    ...totals,
    cleanSolveRate: totals.completed ? Math.round(totals.cleanSolved * 1000 / totals.completed) / 10 : null,
    retryRate: totals.completed ? Math.round(totals.retried * 1000 / totals.completed) / 10 : null,
  };
}

export type SkillSort = "skill" | "completed" | "accuracy" | "retry" | "time" | "coverage" | "review" | "trend";

export function skillSortValue(skill: DashboardSkill, sort: SkillSort): string | number | null {
  if (sort === "skill") return skill.skill.toLowerCase();
  if (sort === "completed") return skill.completed;
  if (sort === "accuracy") return skill.cleanSolveRate;
  if (sort === "retry") return skill.retryRate;
  if (sort === "time") return skill.medianFirstAttemptMs;
  if (sort === "coverage") return skill.total ? skill.mastered / skill.total : 0;
  if (sort === "review") return skill.review;
  return skill.cleanSolveDelta;
}

export function sortSkills(skills: DashboardSkill[], sort: SkillSort, direction: "asc" | "desc") {
  return [...skills].sort((a, b) => {
    const aValue = skillSortValue(a, sort);
    const bValue = skillSortValue(b, sort);
    if (aValue === null && bValue === null) return a.skill.localeCompare(b.skill);
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    const compared = typeof aValue === "string" && typeof bValue === "string" ? aValue.localeCompare(bValue) : Number(aValue) - Number(bValue);
    return (direction === "asc" ? compared : -compared) || a.skill.localeCompare(b.skill);
  });
}
