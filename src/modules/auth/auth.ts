export type AuthSession = {
  userId: string;
  email?: string;
};

export type AuthConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type SupabaseAuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user: { id: string; email?: string } } | null }; error?: { message: string } | null }>;
    signInWithOtp: (input: { email: string; options: { emailRedirectTo: string } }) => Promise<{ error?: { message: string } | null }>;
    signOut: () => Promise<{ error?: { message: string } | null }>;
  };
  from: (table: "profiles") => {
    upsert: (value: { user_id: string; timezone: string; updated_at: string }) => Promise<{ error?: { message: string } | null }>;
  };
};

export type AuthGateway = {
  configured: boolean;
  getSession: () => Promise<AuthSession | null>;
  requestEmailOtp: (email: string, redirectTo: string) => Promise<void>;
  captureTimezone: (userId: string, timezone: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export function getSupabaseAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey };
}

export function getAuthRedirectUrl(locationLike: Pick<Location, "origin"> = window.location) {
  return locationLike.origin;
}

export function createSupabaseAuthGateway(client: SupabaseAuthClient): AuthGateway {
  return {
    configured: true,
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(error.message);
      if (!data.session) return null;
      return {
        userId: data.session.user.id,
        email: data.session.user.email,
      };
    },
    async requestEmailOtp(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw new Error(error.message);
    },
    async captureTimezone(userId, timezone) {
      const { error } = await client.from("profiles").upsert({
        user_id: userId,
        timezone,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },
  };
}

export function createMissingAuthGateway(): AuthGateway {
  return {
    configured: false,
    async getSession() {
      return null;
    },
    async requestEmailOtp() {
      throw new Error("Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    },
    async captureTimezone() {
      throw new Error("Supabase auth is not configured.");
    },
    async signOut() {
      return undefined;
    },
  };
}
