import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

const inputSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128) });

export async function POST(request: Request) {
  const current = await getCurrentSession();
  if (!current) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json());
    await auth.api.changePassword({ headers: await headers(), body: { ...input, revokeOtherSessions: true } });
    await db.update(user).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, current.user.id));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Use a new password of at least 12 characters." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "The password could not be changed." }, { status: 400 });
  }
}
