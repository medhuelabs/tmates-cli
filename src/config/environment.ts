import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

let loaded = false;

export type EnvironmentOptions = {
  additionalFiles?: string[];
};

export function loadEnvironment(options: EnvironmentOptions = {}): void {
  if (loaded) {
    return;
  }

  const cwd = process.cwd();
  const defaultCandidates = [
    '.env.local',
    '.env',
  ].map((file) => join(cwd, file));

  const extra = options.additionalFiles ?? [];
  const candidates = [...extra, ...defaultCandidates];

  for (const filePath of candidates) {
    try {
      if (existsSync(filePath)) {
        config({ path: filePath, override: false });
      }
    } catch (error) {
      console.warn(`Failed to load environment file at ${filePath}:`, error);
    }
  }

  loaded = true;
}
