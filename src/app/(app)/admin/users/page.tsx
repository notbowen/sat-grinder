import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { user } from "@/db/schema";
import { UserAdmin } from "@/components/user-admin";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "User administration" };

export default async function UsersPage() {
  const current = await requireSession({ admin: true });
  const users = await db.select({ id: user.id, name: user.name, username: user.username, role: user.role, banned: user.banned, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt }).from(user).orderBy(asc(user.name));
  return <main className="page-container"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Administration</p><h1 className="page-title">Manage access.</h1><p className="page-subtitle">Create accounts, issue temporary passwords, and disable access without public registration.</p></div><Link href="/admin/question-bank" className="secondary-button">Question bank →</Link></div><UserAdmin users={users} currentUserId={current.user.id} /></main>;
}
