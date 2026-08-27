/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FriendsPage from "@/app/(app)/friends/page";
import type { FriendshipsData, FriendsLeaderboardData } from "@/lib/supabase-api";

const mocks = vi.hoisted(() => ({
  getFriendships: vi.fn(),
  getFriendsLeaderboard: vi.fn(),
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
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FriendsPage", () => {
  it("shows only the accepted-friends leaderboard and changes its horizon", async () => {
    render(<FriendsPage />);

    expect(await screen.findByRole("heading", { name: "Your circle, the last 30 days" })).not.toBeNull();
    expect(screen.getByText("There is no global leaderboard.", { exact: false })).not.toBeNull();
    expect(screen.getByText("Current Learner")).not.toBeNull();
    expect(screen.getAllByText("Ada Friend").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(mocks.getFriendsLeaderboard).toHaveBeenLastCalledWith("7d"));
  });

  it("sends and accepts email friend requests", async () => {
    render(<FriendsPage />);
    await screen.findByRole("heading", { name: "Needs your response" });

    fireEvent.change(screen.getByLabelText("Add a friend by email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(mocks.sendFriendRequest).toHaveBeenCalledWith("new@example.com"));

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mocks.respondToFriendRequest).toHaveBeenCalledWith("request", true));
    expect(mocks.getFriendsLeaderboard.mock.calls.length).toBeGreaterThan(1);
  });
});
