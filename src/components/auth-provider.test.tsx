/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth-provider";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  localSupabaseAuth: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigurationError: () => null,
  localSupabaseAuth: () => mocks.localSupabaseAuth(),
  getSupabase: () => ({ auth: mocks }),
}));

function Controls() {
  const auth = useAuth();
  if (auth.loading) return <p>Loading</p>;
  return <>
    <button onClick={() => void auth.signInWithGoogle()}>Google</button>
    <button onClick={() => void auth.signInWithLocalPassword("dev@local.test", "localdev123").catch(() => {})}>Local</button>
    <button onClick={() => void auth.signOut()}>Sign out</button>
  </>;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/login/?from=dashboard#sign-in");
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { session: { access_token: "local" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.localSupabaseAuth.mockReturnValue(false);
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

  it("creates the local development account only when it does not exist yet", async () => {
    mocks.localSupabaseAuth.mockReturnValue(true);
    mocks.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    render(<AuthProvider><Controls /></AuthProvider>);
    const credentials = { email: "dev@local.test", password: "localdev123" };

    fireEvent.click(await screen.findByRole("button", { name: "Local" }));
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(credentials));
    expect(mocks.signInWithPassword).toHaveBeenCalledWith(credentials);

    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledTimes(2));
    expect(mocks.signUp).toHaveBeenCalledOnce();
  });

  it("refuses password sign-in against a hosted project", async () => {
    render(<AuthProvider><Controls /></AuthProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "Local" }));
    await waitFor(() => expect(mocks.localSupabaseAuth).toHaveBeenCalled());
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});
