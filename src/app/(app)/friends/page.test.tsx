/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendsPage from "@/app/(app)/friends/page";
import type { FriendshipsData, FriendsLeaderboardData } from "@/lib/supabase-api";

const mocks = vi.hoisted(() => ({
  getFriendships: vi.fn(),
  getFriendsLeaderboard: vi.fn(),
  removeFriend: vi.fn(),
  sendFriendRequest: vi.fn(),
  respondToFriendRequest: vi.fn(),
}));

vi.mock("@/lib/supabase-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase-api")>();
  return { ...original, ...mocks };
});

const social: FriendshipsData = {
  friends: [{ id: "friend", name: "Ada Friend", email: "ada@example.com", avatarUrl: null, friendsSince: "2026-08-20T00:00:00Z" }],
  incoming: [{ id: "request", userId: "requester", name: "Grace Requester", email: "grace@example.com", avatarUrl: null, createdAt: "2026-08-26T00:00:00Z" }],
  outgoing: [{ id: "sent", userId: "addressee", name: "Lin Pending", email: "lin@example.com", avatarUrl: null, createdAt: "2026-08-25T00:00:00Z" }],
};

const leaderboard: FriendsLeaderboardData = {
  window: "30d",
  timezone: "Asia/Singapore",
  generatedAt: "2026-08-26T12:00:00Z",
  members: [
    { rank: 1, id: "self", name: "Current Learner", email: "me@example.com", avatarUrl: null, isCurrentUser: true, completed: 40, cleanSolved: 32, cleanSolveRate: 80, activeTimeMs: 600_000, practiceDays: 5, newlyMastered: 8 },
    { rank: 2, id: "friend", name: "Ada Friend", email: "ada@example.com", avatarUrl: null, isCurrentUser: false, completed: 30, cleanSolved: 21, cleanSolveRate: 70, activeTimeMs: 480_000, practiceDays: 4, newlyMastered: 5 },
  ],
};

beforeEach(() => {
  mocks.getFriendships.mockResolvedValue(social);
  mocks.getFriendsLeaderboard.mockResolvedValue(leaderboard);
  mocks.sendFriendRequest.mockResolvedValue("new-request");
  mocks.respondToFriendRequest.mockResolvedValue(undefined);
  mocks.removeFriend.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("FriendsPage", () => {
  it("shows the friends-only leaderboard first and changes its horizon", async () => {
    render(<FriendsPage />);

    expect(await screen.findByRole("heading", { name: "Leaderboard" })).not.toBeNull();
    expect(screen.getByText("Friends only. No global board.")).not.toBeNull();
    const board = screen.getByRole("table", { name: "Leaderboard" });
    expect(board.textContent).toContain("Current Learner");
    expect(board.textContent).toContain("You");
    expect(board.textContent).toContain("Ada Friend");
    expect(board.textContent).not.toContain("me@example.com");
    expect(screen.getByRole("button", { name: "1 day" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "All time" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    await waitFor(() => expect(mocks.getFriendsLeaderboard).toHaveBeenLastCalledWith("14d"));
  });

  it("lists requests, invites and friends as one list", async () => {
    render(<FriendsPage />);
    await screen.findByRole("heading", { name: "People" });

    const rows = [...document.querySelectorAll(".people-row")].map((row) => row.textContent);
    expect(rows[0]).toContain("Grace Requester");
    expect(rows[0]).toContain("Wants to add you");
    expect(rows[1]).toContain("Lin Pending");
    expect(rows[1]).toContain("Invited");
    expect(rows[2]).toContain("Ada Friend");
    expect(rows[2]).toContain("Friend");
  });

  it("invites by email and accepts a request", async () => {
    render(<FriendsPage />);
    await screen.findByRole("heading", { name: "People" });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(mocks.sendFriendRequest).toHaveBeenCalledWith("new@example.com"));
    expect(await screen.findByText("Invited new@example.com.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mocks.respondToFriendRequest).toHaveBeenCalledWith("request", true));
    expect(await screen.findByText("Added Grace Requester.")).not.toBeNull();
    expect(mocks.getFriendsLeaderboard.mock.calls.length).toBeGreaterThan(1);
  });

  it("confirms and removes a friend", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    render(<FriendsPage />);
    await screen.findByRole("heading", { name: "People" });

    fireEvent.click(screen.getByRole("button", { name: "Remove Ada Friend" }));

    expect(globalThis.confirm).toHaveBeenCalledWith("Remove Ada Friend?");
    await waitFor(() => expect(mocks.removeFriend).toHaveBeenCalledWith("friend"));
    expect(await screen.findByText("Removed Ada Friend.")).not.toBeNull();
  });

  it("says so when there are no friends yet", async () => {
    mocks.getFriendships.mockResolvedValue({ friends: [], incoming: [], outgoing: [] });
    mocks.getFriendsLeaderboard.mockResolvedValue({ ...leaderboard, members: leaderboard.members.slice(0, 1) });
    render(<FriendsPage />);

    expect(await screen.findByText("No friends yet. Invite one below.")).not.toBeNull();
    expect(screen.getByText("No one yet.")).not.toBeNull();
  });
});
