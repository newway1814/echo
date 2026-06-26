import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthGateway, getAuthRedirectUrl, getSupabaseAuthConfig } from "./auth";

function createClient() {
  const signInWithOtp = vi.fn(async () => ({ error: null }));
  const signOut = vi.fn(async () => ({ error: null }));
  const getSession = vi.fn(async () => ({
    data: { session: { user: { id: "user-1", email: "maya@example.com" } } },
    error: null,
  }));
  const upsert = vi.fn(async () => ({ error: null }));

  return {
    client: {
      auth: { getSession, signInWithOtp, signOut },
      from: vi.fn(() => ({ upsert })),
    },
    signInWithOtp,
    getSession,
    upsert,
  };
}

describe("auth module", () => {
  it("detects whether Supabase auth configuration is present", () => {
    expect(getSupabaseAuthConfig({})).toBeNull();
    expect(
      getSupabaseAuthConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon-key" });
  });

  it("requests a magic link/OTP through the Supabase auth interface", async () => {
    const { client, signInWithOtp } = createClient();
    const gateway = createSupabaseAuthGateway(client);

    await gateway.requestEmailOtp("maya@example.com", "https://echo.test");

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "maya@example.com",
      options: { emailRedirectTo: "https://echo.test" },
    });
  });

  it("returns the current Supabase session and captures timezone in the profile", async () => {
    const { client, upsert } = createClient();
    const gateway = createSupabaseAuthGateway(client);

    const session = await gateway.getSession();
    await gateway.captureTimezone("user-1", "Asia/Singapore");

    expect(session).toEqual({ userId: "user-1", email: "maya@example.com" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", timezone: "Asia/Singapore" }),
    );
  });

  it("uses the current origin as the auth redirect URL", () => {
    expect(getAuthRedirectUrl({ origin: "https://echo.test" })).toBe("https://echo.test");
  });
});
