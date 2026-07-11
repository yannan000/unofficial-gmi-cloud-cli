import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GmiClient, GmiError, extractMediaUrls, STUDIO_BASE } from "../src/client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

test("client requires an API key", () => {
  const saved = process.env.GMI_API_KEY;
  delete process.env.GMI_API_KEY;
  assert.throws(() => new GmiClient(), GmiError);
  if (saved) process.env.GMI_API_KEY = saved;
});

test("GET retries on 429 then succeeds, honoring Retry-After", async () => {
  const c = new GmiClient({ apiKey: "k" });
  let calls = 0;
  mockFetch(() => {
    calls++;
    return calls === 1
      ? json({ error: "slow down" }, 429, { "retry-after": "0" })
      : json({ model_ids: ["m"] });
  });
  const models = (await c.listStudioModels()) as { model_ids: string[] };
  assert.equal(calls, 2);
  assert.deepEqual(models.model_ids, ["m"]);
});

test("POST does NOT retry on 500 (no double-submitting paid jobs)", async () => {
  const c = new GmiClient({ apiKey: "k" });
  let calls = 0;
  mockFetch(() => {
    calls++;
    return json({ error: "boom" }, 500);
  });
  await assert.rejects(() => c.createGeneration("m", { prompt: "x" }), (e: GmiError) => e.status === 500);
  assert.equal(calls, 1);
});

test("GET retries on 500 up to the cap, then surfaces the error body", async () => {
  const c = new GmiClient({ apiKey: "k" });
  let calls = 0;
  mockFetch(() => {
    calls++;
    return json({ error: "down" }, 500, { "retry-after": "0" });
  });
  // exponential backoff makes full-cap tests slow; assert it fails with body intact
  const t0 = Date.now();
  await assert.rejects(
    () => c.getGeneration("id"),
    (e: GmiError) => e.status === 500 && (e.body ?? "").includes("down"),
  );
  assert.ok(calls > 1, `expected retries, got ${calls} call(s)`);
  assert.ok(Date.now() - t0 < 60_000);
});

test("auth and org headers are sent", async () => {
  const c = new GmiClient({ apiKey: "secret", orgId: "org1" });
  let seen: Record<string, string> = {};
  mockFetch((_url, init) => {
    seen = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    return json({ model_ids: [] });
  });
  await c.listStudioModels();
  assert.equal(seen.Authorization, "Bearer secret");
  assert.equal(seen["X-Organization-ID"], "org1");
});

test("uploadFile follows the real contract: {file_type: ext} then signed-content-type PUT", async () => {
  const c = new GmiClient({ apiKey: "k" });
  const calls: Array<{ url: string; body?: string; contentType?: string }> = [];
  mockFetch((url, init) => {
    calls.push({
      url,
      body: typeof init?.body === "string" ? init.body : undefined,
      contentType: (init?.headers as Record<string, string> | undefined)?.["Content-Type"],
    });
    if (url.endsWith("/upload-url")) {
      return json({ upload_url: "https://storage.example/put", public_url: "https://cdn.example/f.jpg" });
    }
    return new Response("", { status: 200 });
  });
  const out = await c.uploadFile("photo.jpg", new Uint8Array([1]));
  assert.equal(out.public_url, "https://cdn.example/f.jpg");
  assert.equal(calls[0].url, `${STUDIO_BASE}/upload-url`);
  assert.deepEqual(JSON.parse(calls[0].body ?? "{}"), { file_type: "jpg" });
  assert.equal(calls[1].contentType, "image/jpg"); // GMI signs the literal image/jpg
});

test("uploadFile rejects unsupported extensions before any network call", async () => {
  const c = new GmiClient({ apiKey: "k" });
  mockFetch(() => {
    throw new Error("should not be called");
  });
  await assert.rejects(() => c.uploadFile("f.xyz", new Uint8Array()), /Unsupported file type/);
});

test("extractMediaUrls finds URLs anywhere in the outcome", () => {
  const urls = extractMediaUrls({
    video_url: "https://a/1.mp4",
    nested: { media_urls: ["https://a/2.jpg", "https://a/1.mp4"] },
    note: "not-a-url",
  });
  assert.deepEqual(urls.sort(), ["https://a/1.mp4", "https://a/2.jpg"]);
});
