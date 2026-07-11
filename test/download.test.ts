import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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
