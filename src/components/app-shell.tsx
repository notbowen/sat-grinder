"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpen, LogOut, Settings, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/practice/random", label: "Random", icon: BookOpen },
  { href: "/practice/topics", label: "Topics", icon: Settings },
];

export function AppShell({ user, children }: { user: { name: string; username?: string | null; role?: string | null }; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  async function signOut() { await authClient.signOut(); router.replace("/login"); router.refresh(); }
  return <div className="min-h-screen bg-[var(--paper)]">
    <header className="app-header"><div className="mx-auto flex max-w-[1420px] items-center justify-between">
      <Link href="/dashboard" className="brand-lockup text-[var(--ink)]"><span className="brand-mark">SG</span><span>SAT Grinder</span></Link>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname.startsWith(href) ? "nav-link-active" : ""}`}><Icon className="size-4" />{label}</Link>)}
        {user.role === "admin" && <Link href="/admin/users" className={`nav-link ${pathname.startsWith("/admin") ? "nav-link-active" : ""}`}><Users className="size-4" />Admin</Link>}
      </nav>
      <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{user.name}</p><p className="text-xs text-[var(--muted)]">@{user.username}</p></div><span className="grid size-10 place-items-center rounded-full bg-[var(--coral-soft)] font-bold text-[var(--coral-dark)]">{user.name.slice(0, 1).toUpperCase()}</span><button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut className="size-4" /></button></div>
    </div></header>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}><Icon className="size-5" /><span>{label}</span></Link>)}
      {user.role === "admin" && <Link href="/admin/users" className={pathname.startsWith("/admin") ? "active" : ""}><Users className="size-5" /><span>Admin</span></Link>}
    </nav>
    {children}
  </div>;
}
