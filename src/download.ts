/**
 * Download generated assets to local files.
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, extname, join, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GmiError } from "./client.js";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
};

/**
 * Filenames are derived from server-controlled URLs — sanitize so a hostile
 * path segment ("..", separators, control chars) can never escape `dir`.
 */
function safeName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").replace(/^[.\s]+/, "").slice(0, 200);
}

/** Download each URL into `dir`; returns the saved file paths. */
export async function downloadAssets(urls: string[], dir: string, prefix: string): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new GmiError(`Download failed (${res.status} ${res.statusText}): ${url}`, res.status);
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    let name = safeName(basename(new URL(url).pathname));
    if (!name || !extname(name)) {
      const ext = EXT_BY_TYPE[contentType] ?? "";
      // prefix is derived from an API-controlled request_id — sanitize it too.
      name = safeName(`${prefix}${urls.length > 1 ? `-${i + 1}` : ""}${ext}`);
    }
    const path = join(dir, name);
    // Defense in depth: never write outside the intended directory.
    if (path !== dir && !path.startsWith(dir + sep)) {
      throw new GmiError(`Refusing to write outside ${dir}: ${name}`);
    }
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(path));
    saved.push(path);
  }
  return saved;
}
