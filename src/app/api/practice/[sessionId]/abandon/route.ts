import { abandonPracticeSession, PracticeError } from "@/lib/practice";
import { getCurrentSession } from "@/lib/session";

export async function POST(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const current = await getCurrentSession(); if (!current) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { const { sessionId } = await params; await abandonPracticeSession(current.user.id, sessionId); return Response.json({ ok: true }); }
  catch (error) { if (error instanceof PracticeError) return Response.json({ error: error.message }, { status: error.status }); console.error(error); return Response.json({ error: "The quiz could not be abandoned." }, { status: 500 }); }
}
