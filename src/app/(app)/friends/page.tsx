"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, LoaderCircle, MailPlus, Trophy, UserMinus, UserRoundCheck, X } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { formatDuration, formatPercent, formatShortDate, windowOptions } from "@/lib/format";
import {
  getFriendships,
  getFriendsLeaderboard,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  type FriendProfile,
  type FriendRequest,
  type FriendshipsData,
  type FriendsLeaderboardData,
  type LeaderboardWindow,
} from "@/lib/supabase-api";

type Person =
  | { key: string; kind: "incoming" | "outgoing"; request: FriendRequest }
  | { key: string; kind: "friend"; friend: FriendProfile };

/** Requests first, then invites, then friends: one list, three states. */
function people(social: FriendshipsData | null): Person[] {
  if (!social) return [];
  return [
    ...social.incoming.map((request) => ({ key: `in:${request.id}`, kind: "incoming" as const, request })),
    ...social.outgoing.map((request) => ({ key: `out:${request.id}`, kind: "outgoing" as const, request })),
    ...social.friends.map((friend) => ({ key: `friend:${friend.id}`, kind: "friend" as const, friend })),
  ];
}

export default function FriendsPage() {
  const [window, setWindow] = useState<LeaderboardWindow>("30d");
  const [social, setSocial] = useState<FriendshipsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<FriendsLeaderboardData | null>(null);
  const [email, setEmail] = useState("");
  const [loadingSocial, setLoadingSocial] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [removingFriend, setRemovingFriend] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getFriendships()
      .then((result) => { if (!cancelled) setSocial(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Friends unavailable."); })
      .finally(() => { if (!cancelled) setLoadingSocial(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getFriendsLeaderboard(window)
      .then((result) => { if (!cancelled) setLeaderboard(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Leaderboard unavailable."); })
      .finally(() => { if (!cancelled) setLoadingLeaderboard(false); });
    return () => { cancelled = true; };
  }, [window]);

  async function refreshSocial(includeLeaderboard = false) {
    const [nextSocial, nextLeaderboard] = await Promise.all([
      getFriendships(),
      includeLeaderboard ? getFriendsLeaderboard(window) : Promise.resolve(null),
    ]);
    setSocial(nextSocial);
    if (nextLeaderboard) setLeaderboard(nextLeaderboard);
  }

  function selectWindow(nextWindow: LeaderboardWindow) {
    if (nextWindow === window) return;
    setLoadingLeaderboard(true);
    setError("");
    setWindow(nextWindow);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedEmail = email.trim();
    if (!requestedEmail) return;
    setSubmitting(true); setError(""); setNotice("");
    try {
      await sendFriendRequest(requestedEmail);
      await refreshSocial();
      setEmail("");
      setNotice(`Invited ${requestedEmail}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not invite.");
    } finally { setSubmitting(false); }
  }

  async function respond(request: FriendRequest, accept: boolean) {
    setRespondingTo(request.id); setError(""); setNotice("");
    try {
      await respondToFriendRequest(request.id, accept);
      await refreshSocial(accept);
      setNotice(accept ? `Added ${request.name}.` : `Declined ${request.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update.");
    } finally { setRespondingTo(null); }
  }

  async function remove(friend: FriendProfile) {
    if (!globalThis.confirm(`Remove ${friend.name}?`)) return;
    setRemovingFriend(friend.id); setError(""); setNotice("");
    try {
      await removeFriend(friend.id);
      await refreshSocial(true);
      setNotice(`Removed ${friend.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove.");
    } finally { setRemovingFriend(null); }
  }

  const initialLoading = !social && !leaderboard && (loadingSocial || loadingLeaderboard);
  if (initialLoading) return <main className="loading-screen"><LoaderCircle className="size-6 animate-spin" aria-label="Loading friends" /></main>;

  const members = leaderboard?.members ?? [];
  const list = people(social);

  return <main className="page">
    <div className="page-head">
      <div>
        <p className="eyebrow">Friends</p>
        <h1 className="page-title">Your circle.</h1>
        <p className="page-subtitle">Friends only. No global board.</p>
      </div>
      <div className="page-head-actions">
        <div className="seg" role="group" aria-label="Time range">
          {windowOptions.map((option) => <button key={option.value} type="button" className={window === option.value ? "active" : ""} aria-pressed={window === option.value} onClick={() => selectWindow(option.value)}>{option.label}</button>)}
        </div>
      </div>
    </div>

    {error && <p className="form-error mt-6" role="alert">{error}</p>}
    {notice && <p className="form-success mt-6" role="status"><Check className="size-4" aria-hidden="true" />{notice}</p>}

    <section className="section" aria-labelledby="leaderboard-title" aria-busy={loadingLeaderboard}>
      <div className="section-head"><div><span className="section-index">01</span><h2 id="leaderboard-title" className="section-title">Leaderboard</h2></div>{loadingLeaderboard && <p className="loading-inline"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Updating</p>}</div>
      {leaderboard && members.length <= 1 && <div className="chart-empty compact">No friends yet. Invite one below.</div>}
      {members.length > 1 && <div className="table-wrap panel-flat"><table className="data-table" aria-label="Leaderboard">
        <thead><tr><th>Rank</th><th className="text-left">Friend</th><th>Completed</th><th>Clean solve</th><th>Active time</th><th>Days</th></tr></thead>
        <tbody>{members.map((member) => <tr key={member.id} className={member.isCurrentUser ? "current-user" : undefined}>
          <td>{member.rank === 1 ? <Trophy className="size-4" style={{ color: "var(--accent)" }} aria-label="Rank 1" /> : <span className="muted">#{member.rank}</span>}</td>
          <td className="text-left"><span className="friend-identity"><UserAvatar name={member.name} avatarUrl={member.avatarUrl} className="size-10" /><span className="row-title">{member.name}{member.isCurrentUser && <span className="you-badge">You</span>}</span></span></td>
          <td>{member.completed}</td>
          <td><strong>{formatPercent(member.cleanSolveRate)}</strong><small>n={member.completed}</small></td>
          <td>{formatDuration(member.activeTimeMs)}</td>
          <td>{member.practiceDays}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <div className="section grid-12">
      <section className="span-5" aria-labelledby="invite-title">
        <div className="section-head"><div><span className="section-index">02</span><h2 id="invite-title" className="section-title">Invite</h2></div></div>
        <form className="panel" onSubmit={submitRequest} style={{ display: "grid", gap: ".75rem" }}>
          <label className="form-label" htmlFor="friend-email">Email</label>
          <div className="invite-row">
            <input id="friend-email" className="input" type="email" autoComplete="email" placeholder="friend@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required />
            <button type="submit" className="btn btn-primary" disabled={submitting || !email.trim()}>
              {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <MailPlus className="size-4" aria-hidden="true" />} Invite
            </button>
          </div>
          <p className="small muted">They appear once they accept.</p>
        </form>
      </section>

      <section className="span-7" aria-labelledby="people-title">
        <div className="section-head"><div><span className="section-index">03</span><h2 id="people-title" className="section-title">People</h2></div><p>{list.length}</p></div>
        {loadingSocial && !social ? <div className="chart-empty compact"><LoaderCircle className="size-5 animate-spin" aria-label="Loading people" /></div>
          : list.length ? <div className="list-rows">{list.map((person) => {
            if (person.kind === "friend") return <div key={person.key} className="people-row">
              <div className="friend-identity"><UserAvatar name={person.friend.name} avatarUrl={person.friend.avatarUrl} className="size-10" /><div><strong>{person.friend.name}</strong><small>{person.friend.email}</small></div></div>
              <span className="status-pill status-good">Friend</span>
              <div className="people-actions">
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--accent)" }} aria-label={`Remove ${person.friend.name}`} disabled={removingFriend === person.friend.id} onClick={() => void remove(person.friend)}>
                  {removingFriend === person.friend.id ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <UserMinus className="size-3.5" aria-hidden="true" />} Remove
                </button>
              </div>
            </div>;
            const { request } = person;
            const busy = respondingTo === request.id;
            return <div key={person.key} className="people-row">
              <div className="friend-identity"><UserAvatar name={request.name} avatarUrl={request.avatarUrl} className="size-10" /><div><strong>{request.name}</strong><small>{request.email} · {formatShortDate(request.createdAt)}</small></div></div>
              {person.kind === "incoming" ? <span className="status-pill status-warn">Wants to add you</span> : <span className="status-pill status-muted">Invited</span>}
              <div className="people-actions">
                {person.kind === "incoming" && <>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void respond(request, true)}>{busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <UserRoundCheck className="size-3.5" aria-hidden="true" />} Accept</button>
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void respond(request, false)}><X className="size-3.5" aria-hidden="true" /> Decline</button>
                </>}
              </div>
            </div>;
          })}</div>
          : <div className="chart-empty compact">No one yet.</div>}
      </section>
    </div>
  </main>;
}
