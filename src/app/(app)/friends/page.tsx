"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Clock3,
  LoaderCircle,
  MailPlus,
  Send,
  Trophy,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  getFriendships,
  getFriendsLeaderboard,
  respondToFriendRequest,
  sendFriendRequest,
  type FriendRequest,
  type FriendshipsData,
  type FriendsLeaderboardData,
  type LeaderboardWindow,
} from "@/lib/supabase-api";

const windows: { value: LeaderboardWindow; label: string; shortLabel: string }[] = [
  { value: "7d", label: "the last 7 days", shortLabel: "7 days" },
  { value: "30d", label: "the last 30 days", shortLabel: "30 days" },
  { value: "90d", label: "the last 90 days", shortLabel: "90 days" },
  { value: "all", label: "all time", shortLabel: "All time" },
];

function formatDuration(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) return milliseconds ? "<1m" : "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function requestDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function RequestIdentity({ request }: { request: FriendRequest }) {
  return <div className="friend-identity">
    <UserAvatar name={request.name} avatarUrl={request.avatarUrl} className="size-11" />
    <div><strong>{request.name}</strong><span>{request.email}</span></div>
  </div>;
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getFriendships()
      .then((result) => { if (!cancelled) setSocial(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Friends are unavailable."); })
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
      setNotice(`Request sent to ${requestedEmail}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Friend request could not be sent.");
    } finally { setSubmitting(false); }
  }

  async function respond(request: FriendRequest, accept: boolean) {
    setRespondingTo(request.id); setError(""); setNotice("");
    try {
      await respondToFriendRequest(request.id, accept);
      await refreshSocial(accept);
      setNotice(accept ? `${request.name} is now your friend.` : `Declined ${request.name}'s request.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Friend request could not be updated.");
    } finally { setRespondingTo(null); }
  }

  const selectedWindow = windows.find((option) => option.value === window) ?? windows[1];
  const initialLoading = !social && !leaderboard && (loadingSocial || loadingLeaderboard);
  if (initialLoading) return <main className="grid min-h-[65vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-[var(--blue)]" aria-label="Loading friends" /></main>;

  return <main className="page-container friends-page">
    <div className="dashboard-heading">
      <div>
        <p className="eyebrow">Friends only</p>
        <h1 className="page-title">Progress feels better together.</h1>
        <p className="page-subtitle">Invite people you know, approve every connection, and compare practice progress. There is no global leaderboard.</p>
      </div>
      <form className="friend-invite" onSubmit={submitRequest}>
        <label className="form-label" htmlFor="friend-email">Add a friend by email</label>
        <div className="friend-invite-row">
          <input id="friend-email" className="form-input" type="email" autoComplete="email" placeholder="friend@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required />
          <button type="submit" className="primary-button" disabled={submitting || !email.trim()}>
            {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
            Send request
          </button>
        </div>
        <p>They must accept before either of you appears on the other&apos;s leaderboard.</p>
      </form>
    </div>

    {error && <p className="form-error mb-4" role="alert">{error}</p>}
    {notice && <p className="form-success mb-4" role="status"><Check className="size-4" />{notice}</p>}

    <section className="analytics-panel friends-leaderboard" aria-busy={loadingLeaderboard}>
      <div className="section-heading friends-section-heading">
        <div><p className="eyebrow">Leaderboard</p><h2 className="section-title">Your circle, {selectedWindow.label}</h2></div>
        <div className="window-picker" aria-label="Leaderboard time range">
          {windows.map((option) => <button key={option.value} type="button" className={window === option.value ? "active" : ""} aria-pressed={window === option.value} onClick={() => selectWindow(option.value)}>{option.shortLabel}</button>)}
        </div>
      </div>

      {loadingLeaderboard && <div className="leaderboard-updating"><LoaderCircle className="size-4 animate-spin" /> Updating standings</div>}
      {leaderboard && leaderboard.members.length === 1 && <div className="friends-empty-callout"><UsersRound className="size-5" /><p><strong>Your first rival is one accepted request away.</strong><span>Send an invite above; pending requests never appear here.</span></p></div>}

      {leaderboard && <div className="leaderboard-table" role="table" aria-label={`Friends leaderboard for ${selectedWindow.label}`}>
        <div className="leaderboard-header" role="row">
          <span role="columnheader">Rank</span><span role="columnheader">Friend</span><span role="columnheader">Completed</span><span role="columnheader">Clean solve</span><span role="columnheader">Mastered</span><span role="columnheader">Active time</span><span role="columnheader">Days</span>
        </div>
        <ol>
          {leaderboard.members.map((member) => <li key={member.id} className={member.isCurrentUser ? "leaderboard-row current-user" : "leaderboard-row"} role="row">
            <span className="leaderboard-rank" role="cell">{member.rank === 1 ? <Trophy className="size-5" aria-hidden="true" /> : `#${member.rank}`}<span className="sr-only">Rank {member.rank}</span></span>
            <span className="friend-identity" role="cell"><UserAvatar name={member.name} avatarUrl={member.avatarUrl} className="size-11" /><span><strong>{member.name}{member.isCurrentUser && <i>You</i>}</strong><small>{member.email}</small></span></span>
            <span className="leaderboard-stat" role="cell"><strong>{member.completed}</strong><small>Completed</small></span>
            <span className="leaderboard-stat" role="cell"><strong>{member.cleanSolveRate === null ? "—" : `${member.cleanSolveRate}%`}</strong><small>{member.cleanSolved} clean</small></span>
            <span className="leaderboard-stat" role="cell"><strong>{member.newlyMastered}</strong><small>Mastered</small></span>
            <span className="leaderboard-stat" role="cell"><strong>{formatDuration(member.activeTimeMs)}</strong><small>Active time</small></span>
            <span className="leaderboard-stat" role="cell"><strong>{member.practiceDays}</strong><small>Practice days</small></span>
          </li>)}
        </ol>
      </div>}
    </section>

    <div className="friends-management-grid">
      <section className="analytics-panel">
        <div className="section-heading"><div><p className="eyebrow">Requests</p><h2 className="section-title">Needs your response</h2></div><span className="request-count">{social?.incoming.length ?? 0}</span></div>
        {loadingSocial && !social ? <div className="analytics-empty compact"><LoaderCircle className="size-5 animate-spin" /></div>
          : social?.incoming.length ? <div className="friend-request-list">{social.incoming.map((request) => <article key={request.id}>
              <RequestIdentity request={request} />
              <span className="request-date"><Clock3 className="size-3.5" /> {requestDate(request.createdAt)}</span>
              <div className="request-actions">
                <button type="button" className="primary-button" disabled={respondingTo === request.id} onClick={() => void respond(request, true)}>{respondingTo === request.id ? <LoaderCircle className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />} Accept</button>
                <button type="button" className="secondary-button" disabled={respondingTo === request.id} onClick={() => void respond(request, false)}><X className="size-4" /> Decline</button>
              </div>
            </article>)}</div>
          : <div className="analytics-empty compact"><Check className="size-5" /><p>You are all caught up.</p></div>}
      </section>

      <section className="analytics-panel">
        <div className="section-heading"><div><p className="eyebrow">Sent</p><h2 className="section-title">Waiting for acceptance</h2></div><span className="request-count muted">{social?.outgoing.length ?? 0}</span></div>
        {social?.outgoing.length ? <div className="friend-request-list outgoing">{social.outgoing.map((request) => <article key={request.id}>
          <RequestIdentity request={request} /><span className="pending-chip"><Send className="size-3.5" /> Pending</span>
        </article>)}</div> : <div className="analytics-empty compact"><Send className="size-5" /><p>No requests waiting.</p></div>}
      </section>
    </div>

    <section className="analytics-panel friends-list-panel">
      <div className="section-heading"><div><p className="eyebrow">Your circle</p><h2 className="section-title">Accepted friends</h2></div><span className="request-count accepted">{social?.friends.length ?? 0}</span></div>
      {social?.friends.length ? <div className="accepted-friends-grid">{social.friends.map((friend) => <article key={friend.id}>
        <div className="friend-identity"><UserAvatar name={friend.name} avatarUrl={friend.avatarUrl} className="size-12" /><div><strong>{friend.name}</strong><span>{friend.email}</span></div></div>
        <span className="accepted-chip"><UserRoundCheck className="size-3.5" /> Friends</span>
      </article>)}</div> : <div className="analytics-empty"><UsersRound className="size-6" /><p>Accepted friends will appear here and on your private leaderboard.</p></div>}
    </section>
  </main>;
}
