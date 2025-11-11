import { Session } from '@supabase/supabase-js';
import { getSupabaseClient, getCurrentSession, updateSession } from './supabase-client';

export async function sendOtp(email: string): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    throw new Error(`Failed to send verification code: ${error.message}`);
  }
}

export async function verifyOtp(email: string, token: string): Promise<Session> {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });

  if (error) {
    throw new Error(`Verification failed: ${error.message}`);
  }

  if (!data.session) {
    throw new Error('Verification succeeded but no session was returned.');
  }

  await updateSession(data.session);
  return data.session;
}

export async function refreshSession(): Promise<Session | null> {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(`Failed to refresh session: ${error.message}`);
  }
  if (data.session) {
    await updateSession(data.session);
  }
  return data.session ?? null;
}

export async function signOut(): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(`Failed to sign out: ${error.message}`);
  }
  await updateSession(null);
}

export function getActiveSession(): Session | null {
  return getCurrentSession();
}

export function getAccessToken(): string | null {
  const session = getCurrentSession();
  return session?.access_token ?? null;
}
