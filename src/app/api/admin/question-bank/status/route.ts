import { questionBankStats } from "@/lib/question-bank/sync";
import { getCurrentSession } from "@/lib/session";

export async function GET() {
  const current = await getCurrentSession();
  if (!current) return Response.json({ error: "Forbidden" }, { status: 403 });
  const role = (current.user as typeof current.user & { role?: string }).role;
  if (role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(await questionBankStats());
}
