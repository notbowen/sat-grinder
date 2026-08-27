/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthCallbackPage from "@/app/auth/callback/page";

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), rpc: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { exchangeCodeForSession: mocks.exchangeCodeForSession }, rpc: mocks.rpc }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("OAuth callback", () => {
  it("exchanges the PKCE code and opens the dashboard", async () => {
    window.history.replaceState({}, "", "/auth/callback/?code=authorization-code");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: { avatarUrl: "https://lh3.googleusercontent.com/avatar" }, error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("authorization-code"));
    expect(mocks.rpc).toHaveBeenCalledWith("sync_oauth_profile");
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/");
  });
});
