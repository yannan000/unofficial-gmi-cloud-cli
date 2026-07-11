import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareForUpload, UPLOAD_EXTS } from "../src/convert.js";

test("accepted formats pass through untouched", async () => {
  for (const ext of UPLOAD_EXTS) {
    const out = await prepareForUpload(`/some/file.${ext}`);
    assert.deepEqual(out, { path: `/some/file.${ext}`, converted: false });
  }
});

test("unknown extensions throw a helpful error", async () => {
  await assert.rejects(() => prepareForUpload("/some/file.xyz"), /Unsupported file type ".xyz"/);
});

test("video/audio formats demand ffmpeg when missing (or route to it)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gmi-conv-test-"));
  const mov = join(dir, "empty.mov");
  await writeFile(mov, "");
  // Either ffmpeg is installed (conversion attempted, fails on empty file)
  // or it isn't (clear install hint). Both are correct routing.
  await assert.rejects(() => prepareForUpload(mov), /ffmpeg/);
});

const hasSips = (() => {
  try {
    execFileSync("which", ["sips"]);
    return process.platform === "darwin";
  } catch {
    return false;
  }
})();

test("image conversion via sips produces a png", { skip: !hasSips }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "gmi-conv-test-"));
  const png = join(dir, "src.png");
  // 1x1 png
  await writeFile(
    png,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const bmp = join(dir, "src.bmp");
  execFileSync("sips", ["-s", "format", "bmp", png, "--out", bmp]);
  const out = await prepareForUpload(bmp);
  assert.equal(out.converted, true);
  assert.ok(out.path.endsWith(".png"));
});
