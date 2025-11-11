import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { resolveAppConfig } from '../config/app-config';
import { deleteSession, loadStoredSession, saveSession } from '../storage/session-store';

let supabaseClient: SupabaseClient | null = null;
let currentSession: Session | null = null;
let initialised = false;

function shouldPersistSession(): boolean {
  return process.env.TMATES_CLI_DISABLE_SESSION_CACHE !== '1';
}

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = await resolveAppConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      'Supabase credentials are not configured. Set TMATES_SUPABASE_URL and TMATES_SUPABASE_ANON_KEY or use the CLI settings to configure them.',
    );
  }

  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-tmates-client': 'tmates-cli',
      },
    },
  });

  if (!initialised) {
    await tryRestoreSession(supabaseClient);
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentSession = session ?? null;
      if (!shouldPersistSession()) {
        return;
      }
      if (session) {
        await saveSession(session);
      } else {
        await deleteSession();
      }
    });
    initialised = true;
  }

  return supabaseClient;
}

async function tryRestoreSession(client: SupabaseClient): Promise<void> {
  if (!shouldPersistSession()) {
    return;
  }

  try {
    const stored = await loadStoredSession();
    if (!stored || !stored.refresh_token || !stored.access_token) {
      return;
    }

    const { error, data } = await client.auth.setSession({
      refresh_token: stored.refresh_token,
      access_token: stored.access_token,
    });

    if (error) {
      await deleteSession();
      console.warn('Stored session is invalid. Please sign in again.');
      return;
    }

    currentSession = data.session ?? null;
  } catch (error) {
    console.warn('Failed to restore stored session:', error);
  }
}

export function getCurrentSession(): Session | null {
  return currentSession;
}

export async function updateSession(session: Session | null): Promise<void> {
  currentSession = session;
  if (!shouldPersistSession()) {
    return;
  }
  if (session) {
    await saveSession(session);
  } else {
    await deleteSession();
  }
}
