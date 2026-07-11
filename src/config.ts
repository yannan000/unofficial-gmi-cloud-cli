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

export function loadEnv(): void {
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [
    join(process.cwd(), ".env"),
    join(pkgRoot, ".env"),
    join(homedir(), ".config", "gmi", ".env"),
  ];
  for (const path of candidates) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
      if (!process.env[m[1]] && value) process.env[m[1]] = value;
    }
  }
}
