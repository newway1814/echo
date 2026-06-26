import { createClient } from "@supabase/supabase-js";
import {
  createMissingAuthGateway,
  createSupabaseAuthGateway,
  getSupabaseAuthConfig,
  type AuthGateway,
} from "./auth";

export function createConfiguredSupabaseClient() {
  const config = getSupabaseAuthConfig(import.meta.env);
  if (!config) return null;

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function createConfiguredAuthGateway(): AuthGateway {
  const client = createConfiguredSupabaseClient();
  if (!client) return createMissingAuthGateway();

  return createSupabaseAuthGateway(client as unknown as import("./auth").SupabaseAuthClient);
}
