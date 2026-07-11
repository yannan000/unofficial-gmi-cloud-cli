/**
 * File-format conversion for uploads. GMI only accepts jpeg/jpg/png/mp4/mp3/wav,
 * so anything else (webp, heic, gif, tiff, mov, m4a, flac, ...) gets converted
 * to the nearest accepted format first. No bundled codecs — uses the system's
 * `sips` (built into macOS) for images and `ffmpeg` for video/audio/fallback.
 */
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import { GmiError } from "./client.js";

const run = promisify(execFile);

export const UPLOAD_EXTS = new Set(["jpeg", "jpg", "png", "mp4", "mp3", "wav"]);

const IMAGE_EXTS = new Set(["webp", "heic", "heif", "gif", "tiff", "tif", "bmp", "avif", "jp2", "ico", "psd"]);
const VIDEO_EXTS = new Set(["mov", "avi", "mkv", "webm", "m4v", "mpg", "mpeg", "wmv", "3gp"]);
const AUDIO_EXTS = new Set(["m4a", "aac", "flac", "ogg", "oga", "opus", "wma", "aiff", "aif", "caf"]);

function ext(path: string): string {
  return extname(path).slice(1).toLowerCase();
}

async function available(cmd: string): Promise<boolean> {
  try {
    await run("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

export interface PreparedFile {
  path: string;
  converted: boolean;
}

/**
 * Return a path whose format GMI accepts, converting into a temp dir if
 * needed. Images → png, video → mp4, audio → mp3.
 */
export async function prepareForUpload(filePath: string): Promise<PreparedFile> {
  const e = ext(filePath);
  if (UPLOAD_EXTS.has(e)) return { path: filePath, converted: false };

  const kind = IMAGE_EXTS.has(e) ? "image" : VIDEO_EXTS.has(e) ? "video" : AUDIO_EXTS.has(e) ? "audio" : undefined;
  if (!kind) {
    throw new GmiError(
      `Unsupported file type ".${e}". GMI accepts ${[...UPLOAD_EXTS].join(", ")}; ` +
        `convertible: images (${[...IMAGE_EXTS].join(", ")}), video (${[...VIDEO_EXTS].join(", ")}), audio (${[...AUDIO_EXTS].join(", ")}).`,
    );
  }

  const dir = await mkdtemp(join(tmpdir(), "gmi-convert-"));
  const stem = basename(filePath, extname(filePath));
  const hasFfmpeg = await available("ffmpeg");

  if (kind === "image") {
    const out = join(dir, `${stem}.png`);
    if (process.platform === "darwin" && (await available("sips"))) {
      try {
        await run("sips", ["-s", "format", "png", filePath, "--out", out]);
        return { path: out, converted: true };
      } catch {
        // fall through to ffmpeg
      }
    }
    if (hasFfmpeg) {
      await ffmpeg(filePath, out, ["-frames:v", "1"]);
      return { path: out, converted: true };
    }
    throw new GmiError(
      `Cannot convert ".${e}" — need sips (macOS) or ffmpeg on PATH. Install ffmpeg: brew install ffmpeg`,
    );
  }

  if (!hasFfmpeg) {
    throw new GmiError(`Cannot convert ".${e}" — ffmpeg is required for ${kind} files: brew install ffmpeg`);
  }
  if (kind === "video") {
    const out = join(dir, `${stem}.mp4`);
    await ffmpeg(filePath, out, ["-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac"]);
    return { path: out, converted: true };
  }
  const out = join(dir, `${stem}.mp3`);
  await ffmpeg(filePath, out, ["-c:a", "libmp3lame", "-q:a", "2"]);
  return { path: out, converted: true };
}

async function ffmpeg(input: string, output: string, args: string[]): Promise<void> {
  try {
    await run("ffmpeg", ["-y", "-i", input, ...args, output]);
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr ?? String(e);
    throw new GmiError(`ffmpeg failed converting ${basename(input)}`, undefined, stderr.slice(-800));
  }
}
