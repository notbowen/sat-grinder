import { createSyncRun, runQuestionBankSync } from "@/lib/question-bank/sync";
import { getCurrentSession } from "@/lib/session";

export async function POST() {
  const current = await getCurrentSession();
  if (!current) return Response.json({ error: "Forbidden" }, { status: 403 });
  const role = (current.user as typeof current.user & { role?: string }).role;
  if (role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const runId = await createSyncRun(current.user.id);
    void runQuestionBankSync(runId).catch((error) => console.error("Question-bank sync failed:", error));
    return Response.json({ runId }, { status: 202 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "The sync could not start." }, { status: 409 }); }
}
