/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthCallbackPage from "@/app/auth/callback/page";

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { exchangeCodeForSession: mocks.exchangeCodeForSession } }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("OAuth callback", () => {
  it("exchanges the PKCE code and opens the dashboard", async () => {
    window.history.replaceState({}, "", "/auth/callback/?code=authorization-code");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("authorization-code"));
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/");
  });
});
