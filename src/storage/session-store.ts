import { promises as fs } from 'fs';
import { chmodSync, constants as fsConstants } from 'fs';
import { Session } from '@supabase/supabase-js';
import { getSessionFilePath, getSessionsDirectory } from './paths';

const FILE_MODE = 0o600;

export type StoredSession = {
  session: Session;
  savedAt: string;
};

export async function loadStoredSession(): Promise<Session | null> {
  const filePath = getSessionFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as StoredSession;
    if (!data || typeof data !== 'object' || !data.session) {
      return null;
    }
    return data.session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const directory = getSessionsDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filePath = getSessionFilePath();
  const payload: StoredSession = {
    session,
    savedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), { mode: FILE_MODE });
  try {
    chmodSync(filePath, FILE_MODE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function deleteSession(): Promise<void> {
  const filePath = getSessionFilePath();
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function touchSessionFile(): Promise<void> {
  const directory = getSessionsDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filePath = getSessionFilePath();
  try {
    await fs.access(filePath, fsConstants.F_OK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify({}), { mode: FILE_MODE });
      chmodSync(filePath, FILE_MODE);
    } else {
      throw error;
    }
  }
}
