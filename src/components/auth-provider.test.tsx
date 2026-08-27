/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth-provider";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigurationError: () => null,
  getSupabase: () => ({ auth: mocks }),
}));

function Controls() {
  const auth = useAuth();
  if (auth.loading) return <p>Loading</p>;
  return <><button onClick={() => void auth.signInWithGoogle()}>Google</button><button onClick={() => void auth.signOut()}>Sign out</button></>;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/login/?from=dashboard#sign-in");
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("uses Google PKCE callback scopes and signs out", async () => {
    render(<AuthProvider><Controls /></AuthProvider>);
    await screen.findByRole("button", { name: "Google" });

    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback/?returnTo=http%3A%2F%2Flocalhost%3A3000%2Flogin%2F%3Ffrom%3Ddashboard%23sign-in",
        scopes: "openid email profile",
      },
    }));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
});
