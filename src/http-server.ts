/**
 * Remote HTTP/SSE transport for the GMI MCP server — enables ChatGPT and
 * claude.ai browser connectors, which cannot spawn local stdio servers.
 *
 * SECURITY: this exposes a network endpoint wired to your GMI API key (it
 * spends money). A bearer token is REQUIRED — the server refuses to start
 * without GMI_MCP_TOKEN. Every request must send `Authorization: Bearer <token>`.
 * Bind to localhost and put it behind a tunnel (cloudflared/ngrok) or a host
 * you control; never expose it unauthenticated.
 *
 * Endpoints:
 *   POST /mcp   — Streamable HTTP (Claude Code `--transport http`, modern clients)
 *   GET  /sse   — SSE stream + POST /messages (ChatGPT connectors)
 *   GET  /healthz — unauthenticated liveness check
 */
import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer as createMcpServer } from "./mcp-server.js";

export interface HttpOptions {
  port: number;
  host: string;
  token: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  return timingSafeEqual(header.slice(7).trim(), token);
}

export async function runHttp(opts: HttpOptions): Promise<Server> {
  // SSE sessions: sessionId -> transport (ChatGPT keeps a long-lived stream).
  const sseSessions = new Map<string, SSEServerTransport>();

  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "gmi-studio" }));
      return;
    }

    if (!authorized(req, opts.token)) {
      res.writeHead(401, { "content-type": "application/json", "www-authenticate": "Bearer" });
      res.end(JSON.stringify({ error: "Unauthorized — send Authorization: Bearer <GMI_MCP_TOKEN>" }));
      return;
    }

    // --- Streamable HTTP (stateless: one server+transport per request) ---
    if (url.pathname === "/mcp") {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcp = createMcpServer();
      res.on("close", () => {
        transport.close();
        mcp.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    // --- SSE (ChatGPT): GET opens the stream, POST /messages feeds it ---
    if (url.pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/messages", res);
      sseSessions.set(transport.sessionId, transport);
      res.on("close", () => sseSessions.delete(transport.sessionId));
      const mcp = createMcpServer();
      await mcp.connect(transport);
      return;
    }
    if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId") ?? "";
      const transport = sseSessions.get(sessionId);
      if (!transport) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Unknown or expired SSE session" }));
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. Endpoints: POST /mcp, GET /sse, GET /healthz" }));
  });

  await new Promise<void>((resolve) => server.listen(opts.port, opts.host, resolve));
  const base = `http://${opts.host}:${opts.port}`;
  console.error(`GMI MCP server (HTTP) listening on ${base}`);
  console.error(`  Streamable HTTP (Claude Code, modern clients): ${base}/mcp`);
  console.error(`  SSE (ChatGPT / claude.ai connectors):          ${base}/sse`);
  console.error(`  Auth: Authorization: Bearer <GMI_MCP_TOKEN>  (required on every request)`);
  console.error(`  Expose via a tunnel you control; never leave this endpoint unauthenticated.`);
  return server;
}
