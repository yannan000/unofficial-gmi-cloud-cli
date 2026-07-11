import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENTS, findClient, mergeMcpConfig, serverEntry, SERVER_NAME } from "../src/integrations.js";

test("every client has an id, name, and a snippet mentioning the server path", () => {
  for (const c of CLIENTS) {
    assert.ok(c.id && c.name);
    const snip = c.snippet("/abs/dist/mcp-server.js");
    assert.ok(snip.includes("/abs/dist/mcp-server.js"), `${c.id} snippet missing server path`);
  }
});

test("expected clients are covered", () => {
  for (const id of ["claude-code", "claude-desktop", "cursor", "windsurf", "cline", "kilo", "codex", "grok", "generic"]) {
    assert.ok(findClient(id), `missing client: ${id}`);
  }
});

test("json snippets are valid JSON with the standard mcpServers shape", () => {
  for (const c of CLIENTS.filter((c) => c.installable)) {
    const parsed = JSON.parse(c.snippet("/p/mcp-server.js")) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    assert.deepEqual(parsed.mcpServers[SERVER_NAME], serverEntry("/p/mcp-server.js"));
  }
});

test("mergeMcpConfig preserves existing servers and other keys", () => {
  const existing = JSON.stringify({
    theme: "dark",
    mcpServers: { other: { command: "python", args: ["x.py"] } },
  });
  const merged = JSON.parse(mergeMcpConfig(existing, "/p/mcp-server.js")) as Record<string, unknown>;
  const servers = merged.mcpServers as Record<string, unknown>;
  assert.equal(merged.theme, "dark");
  assert.deepEqual(servers.other, { command: "python", args: ["x.py"] });
  assert.deepEqual(servers[SERVER_NAME], serverEntry("/p/mcp-server.js"));
});

test("mergeMcpConfig handles empty/missing configs and replaces stale entries", () => {
  const fresh = JSON.parse(mergeMcpConfig(undefined, "/new/mcp-server.js")) as {
    mcpServers: Record<string, { args: string[] }>;
  };
  assert.equal(fresh.mcpServers[SERVER_NAME].args[0], "/new/mcp-server.js");

  const updated = JSON.parse(
    mergeMcpConfig(mergeMcpConfig(undefined, "/old/mcp-server.js"), "/new/mcp-server.js"),
  ) as { mcpServers: Record<string, { args: string[] }> };
  assert.equal(updated.mcpServers[SERVER_NAME].args[0], "/new/mcp-server.js");
});
