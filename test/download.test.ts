import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { downloadAssets } from "../src/download.js";

test("downloadAssets names files from the URL path, falling back to content type", async () => {
  const srv = createServer((req, res) => {
    if (req.url?.startsWith("/named")) {
      res.setHeader("content-type", "image/png");
      res.end(Buffer.from("89504e470d0a1a0a", "hex"));
    } else {
      res.setHeader("content-type", "video/mp4");
      res.end(Buffer.from("0000", "hex"));
    }
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  const dir = await mkdtemp(join(tmpdir(), "gmi-dl-test-"));
  try {
    const saved = await downloadAssets(
      [
        `http://127.0.0.1:${port}/named/output.png?sig=abc`, // name from URL, query stripped
        `http://127.0.0.1:${port}/opaque/xyz123`, // no extension → prefix + ext from content type
      ],
      dir,
      "req12345",
    );
    assert.deepEqual(saved.map((p) => basename(p)), ["output.png", "req12345-2.mp4"]);
    assert.equal((await readFile(saved[0])).length, 8);
  } finally {
    srv.close();
  }
});

test("hostile URL path segments cannot escape the output directory", async () => {
  const srv = createServer((_req, res) => {
    res.setHeader("content-type", "image/png");
    res.end(Buffer.from("89504e470d0a1a0a", "hex"));
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  const dir = await mkdtemp(join(tmpdir(), "gmi-dl-test-"));
  try {
    const saved = await downloadAssets(
      [`http://127.0.0.1:${port}/x/..`, `http://127.0.0.1:${port}/.hidden%20..name.png`],
      dir,
      "safe",
    );
    for (const p of saved) {
      assert.ok(p.startsWith(dir), `escaped output dir: ${p}`);
      assert.ok(!basename(p).startsWith("."), `hidden/dot file: ${p}`);
    }
  } finally {
    srv.close();
  }
});

test("hostile request_id prefix cannot escape via the fallback filename", async () => {
  // URL with no filename+extension forces the prefix-based fallback path.
  const srv = createServer((_req, res) => {
    res.setHeader("content-type", "image/png");
    res.end(Buffer.from("89504e470d0a1a0a", "hex"));
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  const dir = await mkdtemp(join(tmpdir(), "gmi-dl-test-"));
  try {
    const saved = await downloadAssets([`http://127.0.0.1:${port}/asset`], dir, "../../pwned");
    assert.equal(saved.length, 1);
    // The file must land directly inside dir (no path separators survived the prefix).
    assert.equal(dirname(saved[0]), dir, `escaped output dir via prefix: ${saved[0]}`);
  } finally {
    srv.close();
  }
});

test("downloadAssets surfaces HTTP failures", async () => {
  const srv = createServer((_req, res) => {
    res.statusCode = 403;
    res.end("denied");
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  const dir = await mkdtemp(join(tmpdir(), "gmi-dl-test-"));
  try {
    await assert.rejects(
      () => downloadAssets([`http://127.0.0.1:${port}/x.png`], dir, "p"),
      /Download failed \(403/,
    );
  } finally {
    srv.close();
  }
});
