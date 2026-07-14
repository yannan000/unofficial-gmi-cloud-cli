import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { runHttp } from "../src/http-server.js";

const TOKEN = "test-token-1234567890abcdef";
let server: Server;
let base: string;

before(async () => {
  process.env.GMI_API_KEY = "dummy"; // lazy client; never called by initialize
  server = await runHttp({ port: 0, host: "127.0.0.1", token: TOKEN });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
});

test("/healthz is open (no auth)", async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, "ok");
});

test("/mcp without a token is 401", async () => {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } } }),
  });
  assert.equal(res.status, 401);
});

test("/mcp with a wrong token is 401", async () => {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: "Bearer wrong-token-000000000000" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } } }),
  });
  assert.equal(res.status, 401);
});

test("/mcp with the token completes an MCP initialize handshake", async () => {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } } }),
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /"serverInfo"/);
  assert.match(text, /gmi-studio/);
});
