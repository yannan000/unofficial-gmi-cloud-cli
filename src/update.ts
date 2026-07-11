/**
 * Self-update and update notifications.
 *
 * Two install modes, detected automatically:
 *  - git checkout (cloned repo, possibly npm-linked): update = git pull + build
 *  - npm global install: update = npm install -g <pkg>@latest
 *
 * The daily notifier checks the npm registry (silent on any failure — e.g.
 * before the package is published) at most once per 24h, cached in
 * ~/.config/gmi/update-check.json.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

export const PKG_NAME = "unofficial-gmi-cloud-cli";

export function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

/** Compare dotted versions: negative if a<b, 0 if equal, positive if a>b. */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function fetchLatestVersion(timeoutMs = 1500): Promise<string | undefined> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PKG_NAME}/latest`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { version?: string };
    return data.version;
  } catch {
    return undefined;
  }
}

const CHECK_CACHE = join(homedir(), ".config", "gmi", "update-check.json");

/**
 * At most once per 24h, check the registry and print an update notice to
 * stderr. Never throws, never blocks longer than ~1.5s.
 */
export async function maybeNotifyUpdate(currentVersion: string): Promise<void> {
  try {
    let last = 0;
    try {
      last = (JSON.parse(readFileSync(CHECK_CACHE, "utf8")) as { checkedAt?: number }).checkedAt ?? 0;
    } catch {}
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    await mkdir(dirname(CHECK_CACHE), { recursive: true });
    await writeFile(CHECK_CACHE, JSON.stringify({ checkedAt: Date.now() }));
    const latest = await fetchLatestVersion();
    if (latest && compareSemver(latest, currentVersion) > 0) {
      console.error(`\nUpdate available: ${currentVersion} → ${latest}. Run: gmi update\n`);
    }
  } catch {
    // update checks must never break the CLI
  }
}

export interface UpdateResult {
  mode: "git" | "npm";
  before: string;
  after: string;
}

function localVersion(root: string): string {
  return (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
}

/** Update in place. Detects git-checkout vs npm-global installs. */
export async function selfUpdate(log: (line: string) => void): Promise<UpdateResult> {
  const root = packageRoot();
  const before = localVersion(root);

  if (existsSync(join(root, ".git"))) {
    log(`git checkout detected at ${root}`);
    log("pulling latest...");
    const { stdout } = await run("git", ["pull", "--ff-only"], { cwd: root });
    log(stdout.trim());
    log("installing dependencies...");
    await run("npm", ["install"], { cwd: root });
    log("building...");
    await run("npm", ["run", "build"], { cwd: root });
    return { mode: "git", before, after: localVersion(root) };
  }

  log(`npm install detected — updating ${PKG_NAME}@latest globally...`);
  await run("npm", ["install", "-g", `${PKG_NAME}@latest`]);
  const latest = (await fetchLatestVersion(5000)) ?? "latest";
  return { mode: "npm", before, after: latest };
}
