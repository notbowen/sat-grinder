/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthCallbackPage from "@/app/auth/callback/page";

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), rpc: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { exchangeCodeForSession: mocks.exchangeCodeForSession }, rpc: mocks.rpc }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("OAuth callback", () => {
  it("exchanges the PKCE code and returns to the page that started sign-in", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/callback/?returnTo=http%3A%2F%2Flocalhost%3A3000%2Fpractice%2Fsetup%2F%3Fdifficulty%3Dhard%23math&code=authorization-code",
    );
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: { avatarUrl: "https://lh3.googleusercontent.com/avatar" }, error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("authorization-code"));
    expect(mocks.rpc).toHaveBeenCalledWith("sync_oauth_profile");
    expect(mocks.replace).toHaveBeenCalledWith("/practice/setup/?difficulty=hard#math");
  });

  it("does not redirect to a different origin", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/callback/?returnTo=https%3A%2F%2Fexample.com%2Fsteal-session&code=authorization-code",
    );
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard/"));
  });
});
