import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

const authSecret = process.env.BETTER_AUTH_SECRET ?? "local-development-secret-change-before-deploying";

export const auth = betterAuth({
  appName: "SAT Grinder",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: authSecret,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 30 },
  user: {
    additionalFields: {
      mustChangePassword: { type: "boolean", required: false, defaultValue: true, input: true },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
