#!/usr/bin/env node
/**
 * MCP server for GMI Cloud Studio + Inference Engine.
 *
 * Register with Claude Code:
 *   claude mcp add gmi-studio -e GMI_API_KEY=your-key -- node dist/mcp-server.js
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { GmiClient, GmiError, extractMediaUrls } from "./client.js";
import { loadEnv } from "./config.js";

loadEnv();

const server = new McpServer({ name: "gmi-studio", version: "0.2.0" });

let _client: GmiClient | undefined;
function client(): GmiClient {
  if (!_client) _client = new GmiClient();
  return _client;
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function err(e: unknown): ToolResult {
  const msg = e instanceof GmiError ? `${e.message}${e.body ? `\n${e.body}` : ""}` : String(e);
  return { content: [{ type: "text", text: msg }], isError: true };
}

server.tool(
  "list_studio_models",
  "List GMI Cloud Studio generative-media models (image, video, audio generation). Use get_studio_model to see a model's parameters before generating.",
  {},
  async () => {
    try {
      return ok(await client().listStudioModels());
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "get_studio_model",
  "Get a Studio model's parameter schema, defaults, and pricing. Call this before generate_media to build a valid payload.",
  { model_id: z.string().describe("Model ID, e.g. 'seedream-5.0-lite' or 'Veo3'") },
  async ({ model_id }) => {
    try {
      return ok(await client().getStudioModel(model_id));
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "generate_media",
  "Submit an image/video/audio generation job to GMI Cloud Studio. By default waits for completion and returns media URLs. Set wait=false to get a request_id back immediately (use get_generation to poll).",
  {
    model: z.string().describe("Studio model ID, e.g. 'seedream-5.0-lite', 'Veo3', 'Kling-V2.1-I2V'"),
    payload: z
      .record(z.unknown())
      .describe(
        "Model-specific generation parameters, e.g. {\"prompt\": \"...\", \"size\": \"1024x1024\"}. Use get_studio_model to see the schema.",
      ),
    wait: z.boolean().optional().default(true).describe("Wait for completion (default true)"),
    timeout_seconds: z.number().optional().default(600).describe("Max seconds to wait (default 600)"),
  },
  async ({ model, payload, wait, timeout_seconds }) => {
    try {
      const created = await client().createGeneration(model, payload as Record<string, unknown>);
      if (!wait) return ok(created);
      const done = await client().waitForGeneration(created.request_id, {
        timeoutMs: timeout_seconds * 1000,
      });
      return ok({
        request_id: done.request_id,
        status: done.status,
        media_urls: extractMediaUrls(done.outcome),
        outcome: done.outcome,
        reason: done.reason,
      });
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "get_generation",
  "Check the status of a generation job. When status is 'success', media URLs are included.",
  { request_id: z.string().describe("The request_id returned by generate_media") },
  async ({ request_id }) => {
    try {
      const r = await client().getGeneration(request_id);
      return ok({ ...r, media_urls: extractMediaUrls(r.outcome) });
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "upload_file",
  "Upload a local file (e.g. a reference image for image-to-video) to GMI Cloud and get back a public URL usable in generate_media payloads.",
  { file_path: z.string().describe("Absolute path to the local file (jpg, jpeg, png, mp4, mp3, or wav)") },
  async ({ file_path }) => {
    try {
      const bytes = await readFile(file_path);
      return ok(await client().uploadFile(basename(file_path), bytes));
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "list_llm_models",
  "List GMI Cloud Inference Engine LLM models (OpenAI-compatible chat API).",
  {},
  async () => {
    try {
      return ok(await client().listLlmModels());
    } catch (e) {
      return err(e);
    }
  },
);

server.tool(
  "chat",
  "Run a chat completion against a GMI Cloud LLM (e.g. DeepSeek, Qwen, Llama). Returns the assistant's reply text.",
  {
    model: z.string().describe("LLM model ID from list_llm_models"),
    prompt: z.string().describe("User message"),
    system: z.string().optional().describe("Optional system prompt"),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
  },
  async ({ model, prompt, system, temperature, max_tokens }) => {
    try {
      const messages = [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ];
      const params: Record<string, unknown> = {};
      if (temperature !== undefined) params.temperature = temperature;
      if (max_tokens !== undefined) params.max_tokens = max_tokens;
      const { text } = await client().chat(model, messages, params);
      return ok(text);
    } catch (e) {
      return err(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
