import { promises as fs } from 'fs';
import { chmodSync } from 'fs';
import { getAppSettingsPath, getConfigDirectory } from './paths';

const FILE_MODE = 0o600;

export type PersistedSettings = {
  customApiBaseUrl?: string;
  customSupabaseUrl?: string;
  customSupabaseAnonKey?: string;
};

export async function loadSettings(): Promise<PersistedSettings> {
  const path = getAppSettingsPath();
  try {
    const raw = await fs.readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as PersistedSettings;
    }
    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function saveSettings(settings: PersistedSettings): Promise<void> {
  const directory = getConfigDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const path = getAppSettingsPath();
  await fs.writeFile(path, JSON.stringify(settings, null, 2), { mode: FILE_MODE });
  try {
    chmodSync(path, FILE_MODE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
