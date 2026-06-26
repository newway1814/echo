import { createClient } from "@supabase/supabase-js";
import {
  createMissingAuthGateway,
  createSupabaseAuthGateway,
  getSupabaseAuthConfig,
  type AuthGateway,
} from "./auth";

export function createConfiguredAuthGateway(): AuthGateway {
  const config = getSupabaseAuthConfig(import.meta.env);
  if (!config) return createMissingAuthGateway();

  return createSupabaseAuthGateway(
    createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }) as unknown as import("./auth").SupabaseAuthClient,
  );
}

