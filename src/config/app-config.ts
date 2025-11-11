import { loadSettings, PersistedSettings } from '../storage/settings-store';
import { loadEnvironment } from './environment';

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
};

let cachedConfig: AppConfig | null = null;
let cachedSettings: PersistedSettings | null = null;

function normalizeUrl(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function coalesce(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export async function resolveAppConfig(forceReload = false): Promise<AppConfig> {
  if (!forceReload && cachedConfig) {
    return cachedConfig;
  }

  loadEnvironment();
  cachedSettings = await loadSettings();

  const env = process.env;
  const supabaseUrl = normalizeUrl(
    coalesce(
      cachedSettings.customSupabaseUrl,
      env.TMATES_SUPABASE_URL,
      env.EXPO_PUBLIC_SUPABASE_URL,
      env.SUPABASE_URL,
      env.SUPABASE_URL_DEFAULT,
    ),
  );

  const supabaseAnonKey = coalesce(
    cachedSettings.customSupabaseAnonKey,
    env.TMATES_SUPABASE_ANON_KEY,
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    env.SUPABASE_ANON_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const apiBaseUrl = normalizeUrl(
    coalesce(
      cachedSettings.customApiBaseUrl,
      env.TMATES_API_BASE_URL,
      env.EXPO_PUBLIC_API_URL,
      env.API_BASE_URL,
    ),
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase credentials are not fully configured. Provide TMATES_SUPABASE_URL and TMATES_SUPABASE_ANON_KEY environment variables or set custom values via the CLI settings.',
    );
  }

  if (!apiBaseUrl) {
    console.warn(
      'API base URL is not configured. Provide TMATES_API_BASE_URL or configure a custom API endpoint via the CLI settings.',
    );
  }

  cachedConfig = {
    supabaseUrl,
    supabaseAnonKey,
    apiBaseUrl,
  };

  return cachedConfig;
}

export function getCachedSettings(): PersistedSettings | null {
  return cachedSettings;
}
