/**
 * Env loading: fills process.env from .env files without overriding
 * variables already set in the shell. Search order (first hit per var wins):
 *   1. ./.env (current directory)
 *   2. <package root>/.env
 *   3. ~/.config/gmi/.env
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Parse .env text into key/value pairs (supports `export`, quotes, comments). */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (value) out[m[1]] = value;
  }
  return out;
}

export function envFileCandidates(): string[] {
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  return [
    join(process.cwd(), ".env"),
    join(pkgRoot, ".env"),
    join(homedir(), ".config", "gmi", ".env"),
  ];
}

export function loadEnv(): void {
  for (const path of envFileCandidates()) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries(parseEnv(text))) {
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
