import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR_NAME = 'tmates-cli';

export function getConfigDirectory(): string {
  const explicit = process.env.TMATES_CLI_HOME;
  if (explicit && explicit.trim()) {
    return ensureDirectory(expandTilde(explicit.trim()));
  }

  const xdgHome = process.env.XDG_CONFIG_HOME;
  if (xdgHome && xdgHome.trim()) {
    return ensureDirectory(join(expandTilde(xdgHome.trim()), CONFIG_DIR_NAME));
  }

  const home = homedir();
  if (!home) {
    throw new Error('Unable to determine home directory for storing Tmates CLI data.');
  }
  return ensureDirectory(join(home, '.config', CONFIG_DIR_NAME));
}

export function getSessionsDirectory(): string {
  return ensureDirectory(join(getConfigDirectory(), 'sessions'));
}

export function getSessionFilePath(): string {
  return join(getSessionsDirectory(), 'default.json');
}

export function getAppSettingsPath(): string {
  return join(getConfigDirectory(), 'settings.json');
}

function ensureDirectory(path: string): string {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
  return path;
}

function expandTilde(input: string): string {
  if (!input.startsWith('~')) {
    return input;
  }
  const home = homedir();
  if (!home) {
    return input;
  }
  if (input === '~') {
    return home;
  }
  return join(home, input.slice(2));
}
