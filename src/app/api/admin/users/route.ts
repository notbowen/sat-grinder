import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/);
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), username: usernameSchema, name: z.string().trim().min(1).max(80), password: z.string().min(12).max(128) }),
  z.object({ action: z.literal("reset-password"), userId: z.string().min(1), password: z.string().min(12).max(128) }),
  z.object({ action: z.literal("set-disabled"), userId: z.string().min(1), disabled: z.boolean() }),
]);

export async function POST(request: Request) {
  const current = await getCurrentSession();
  if (!current || (current.user as typeof current.user & { role?: string }).role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const input = inputSchema.parse(await request.json());
    if (input.action === "create") {
      const created = await auth.api.createUser({ headers: await headers(), body: { email: `${input.username}@users.sat-grinder.invalid`, password: input.password, name: input.name, role: "user" } });
      const createdUser = (created as { user?: { id?: string } }).user ?? (created as { id?: string });
      if (!createdUser.id) throw new Error("User creation returned no identifier.");
      await db.update(user).set({ username: input.username, displayUsername: input.username, mustChangePassword: true, emailVerified: true, updatedAt: new Date() }).where(eq(user.id, createdUser.id));
      return Response.json({ ok: true });
    }
    if (input.userId === current.user.id && input.action === "set-disabled" && input.disabled) return Response.json({ error: "You cannot disable your own account." }, { status: 400 });
    if (input.action === "reset-password") {
      await auth.api.setUserPassword({ headers: await headers(), body: { userId: input.userId, newPassword: input.password } });
      await db.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, input.userId));
      await db.delete(session).where(eq(session.userId, input.userId));
      return Response.json({ ok: true });
    }
    await db.update(user).set({ banned: input.disabled, banReason: input.disabled ? "Disabled by administrator" : null, updatedAt: new Date() }).where(eq(user.id, input.userId));
    if (input.disabled) await db.delete(session).where(eq(session.userId, input.userId));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Check the account details and use a password of at least 12 characters." }, { status: 400 });
    const message = error instanceof Error ? error.message : "The account could not be updated.";
    if (/unique|already|taken/i.test(message)) return Response.json({ error: "That username is already in use." }, { status: 409 });
    console.error(error); return Response.json({ error: message }, { status: 500 });
  }
}
