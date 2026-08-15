import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/** Authenticated identity derived from a bearer / handshake token. */
export interface AuthIdentity {
  userId: string;
  email: string;
}

/** Resolves a token to an identity, or null if invalid. */
export type TokenVerifier = (token: string) => Promise<AuthIdentity | null>;

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Verify a Supabase access token by asking the Auth server who it belongs to.
 * This is signing-algorithm agnostic (works with the local HS256 secret and
 * with production asymmetric keys), unlike verifying a static secret locally.
 */
export const verifySupabaseToken: TokenVerifier = async (token) => {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? data.user.id };
};
