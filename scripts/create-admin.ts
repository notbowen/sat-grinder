import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";
import { user } from "../src/db/schema";
import { db } from "../src/lib/db";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const username = (argument("username") ?? process.env.ADMIN_USERNAME)?.trim().toLowerCase();
  const password = argument("password") ?? process.env.ADMIN_PASSWORD;
  const name = (argument("name") ?? process.env.ADMIN_DISPLAY_NAME)?.trim() || "Administrator";
  if (!username || !/^[a-z0-9._-]{3,30}$/.test(username) || !password || password.length < 12) {
    console.error("Usage: pnpm admin:create -- --username <name> --password <12+ characters> [--name \"Display Name\"]");
    process.exit(1);
  }
  const email = `${username}@users.sat-grinder.invalid`;
  const result = await auth.api.signUpEmail({ body: { email, password, name, username, displayUsername: username, mustChangePassword: false } });
  if (!result.user?.id) throw new Error("The authentication service did not return a user.");
  await db.update(user).set({ role: "admin", username, displayUsername: username, mustChangePassword: false, emailVerified: true, updatedAt: new Date() }).where(eq(user.id, result.user.id));
  console.log(`Created admin account @${username}.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
