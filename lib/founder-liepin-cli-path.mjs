import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Prefer the dedicated spike venv so the Founder never activates it manually. */
export function resolveLiepinCli({ home = homedir(), environment = process.env, exists = existsSync } = {}) {
  const preferred = join(home, 'dev', 'liepin-cli-spike', '.venv', 'bin', 'liepin-cli');
  const candidates = [preferred, text(environment.LIEPIN_CLI_PATH)];
  for (const candidate of candidates) if (candidate && exists(candidate)) return candidate;
  for (const directory of text(environment.PATH).split(':').filter(Boolean)) {
    const candidate = join(directory, 'liepin-cli');
    if (exists(candidate)) return candidate;
  }
  return null;
}
