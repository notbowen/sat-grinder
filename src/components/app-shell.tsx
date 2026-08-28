"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpen, LogOut, Sigma, UsersRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { UserAvatar } from "@/components/user-avatar";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/statistics", label: "Statistics", icon: Sigma },
  { href: "/practice/random", label: "Practice", icon: BookOpen },
  { href: "/friends", label: "Friends", icon: UsersRound },
];

// Stacked lockup: SAT over GRINDER, joined by a red rule that runs out to the
// flush right edge the two lines share. No pictogram — the rule is the mark.
export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return <Link href={href} className={`wordmark ${className}`.trim()} aria-label="SAT Grinder home"><span className="wordmark-top"><span>SAT</span><i aria-hidden="true" /></span><em>Grinder</em></Link>;
}

export function AppShell({ user, children }: { user: { name: string; email: string; avatarUrl: string | null }; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const { signOut } = useAuth();
  async function leave() { await signOut(); router.replace("/login/"); }
  const isActive = (href: string) => pathname.startsWith(href) || (href === "/practice/random" && pathname.startsWith("/practice"));
  return <div className="min-h-screen">
    <header className="app-header"><div className="container app-header-inner">
      <Wordmark href="/dashboard" />
      <nav className="primary-nav" aria-label="Primary navigation">
        {links.map(({ href, label }) => <Link key={href} href={href} className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`} aria-current={isActive(href) ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className="user-block">
        <div className="user-block-name"><p>{user.name}</p><p>{user.email}</p></div>
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="size-9" />
        <button className="icon-btn" onClick={leave} aria-label="Sign out"><LogOut className="size-4" /></button>
      </div>
    </div></header>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? "active" : ""}><Icon className="size-4" /><span>{label}</span></Link>)}
    </nav>
    {children}
  </div>;
}
