#!/usr/bin/env node
/**
 * gmi — CLI for GMI Cloud Studio (image/video/audio) + Inference Engine (LLMs).
 *
 * Auth: export GMI_API_KEY=...   (console.gmicloud.ai → API Keys)
 */
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { GmiClient, GmiError, extractMediaUrls, TERMINAL_STATUSES } from "./client.js";

const program = new Command();

program
  .name("gmi")
  .description("GMI Cloud Studio + Inference Engine CLI")
  .version("0.1.0");

function client(): GmiClient {
  try {
    return new GmiClient();
  } catch (e) {
    fail(e);
  }
}

function fail(e: unknown): never {
  if (e instanceof GmiError) {
    console.error(`Error: ${e.message}`);
    if (e.body) console.error(e.body);
  } else {
    console.error(`Error: ${String(e)}`);
  }
  process.exit(1);
}

function print(data: unknown): void {
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

program
  .command("models")
  .description("List Studio generative-media models (use --llm for LLM models)")
  .option("--llm", "List LLM models instead of Studio media models")
  .action(async (opts) => {
    try {
      print(opts.llm ? await client().listLlmModels() : await client().listStudioModels());
    } catch (e) {
      fail(e);
    }
  });

program
  .command("model <model-id>")
  .description("Show a Studio model's parameter schema and pricing")
  .action(async (modelId: string) => {
    try {
      print(await client().getStudioModel(modelId));
    } catch (e) {
      fail(e);
    }
  });

program
  .command("generate")
  .description("Submit a generation job (image/video/audio)")
  .requiredOption("-m, --model <id>", "Studio model ID, e.g. seedream-5.0-lite")
  .option("-p, --prompt <text>", "Prompt (shortcut for --payload '{\"prompt\": ...}')")
  .option("--payload <json>", "Full JSON payload of model parameters")
  .option("--no-wait", "Return the request_id immediately instead of waiting")
  .option("--timeout <seconds>", "Max seconds to wait for completion", "600")
  .action(async (opts) => {
    try {
      let payload: Record<string, unknown> = {};
      if (opts.payload) payload = JSON.parse(opts.payload);
      if (opts.prompt) payload.prompt = opts.prompt;
      if (Object.keys(payload).length === 0) {
        fail(new GmiError("Provide -p/--prompt or --payload. See `gmi model <id>` for parameters."));
      }
      const c = client();
      const created = await c.createGeneration(opts.model, payload);
      console.error(`Request ${created.request_id} submitted (status: ${created.status})`);
      if (!opts.wait) {
        print(created);
        return;
      }
      let lastStatus = "";
      const done = await c.waitForGeneration(created.request_id, {
        timeoutMs: Number(opts.timeout) * 1000,
        onPoll: (r) => {
          if (r.status !== lastStatus) {
            lastStatus = r.status;
            if (!TERMINAL_STATUSES.includes(r.status)) console.error(`  ...${r.status}`);
          }
        },
      });
      if (done.status !== "success") {
        fail(new GmiError(`Generation ${done.status}${done.reason ? `: ${done.reason}` : ""}`));
      }
      const urls = extractMediaUrls(done.outcome);
      console.error(`Done. ${urls.length} media URL(s):`);
      print({ request_id: done.request_id, status: done.status, media_urls: urls, outcome: done.outcome });
    } catch (e) {
      fail(e);
    }
  });

program
  .command("status <request-id>")
  .description("Check a generation job's status (add --wait to poll until done)")
  .option("--wait", "Poll until the job reaches a terminal status")
  .option("--timeout <seconds>", "Max seconds to wait", "600")
  .action(async (requestId: string, opts) => {
    try {
      const c = client();
      const r = opts.wait
        ? await c.waitForGeneration(requestId, { timeoutMs: Number(opts.timeout) * 1000 })
        : await c.getGeneration(requestId);
      print({ ...r, media_urls: extractMediaUrls(r.outcome) });
    } catch (e) {
      fail(e);
    }
  });

program
  .command("upload <file>")
  .description("Upload a local file, print the public URL to use in payloads")
  .action(async (file: string) => {
    try {
      const bytes = await readFile(file);
      const ext = extname(file).toLowerCase();
      const contentType =
        { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav" }[ext] ?? "application/octet-stream";
      const { public_url } = await client().uploadFile(basename(file), bytes, contentType);
      console.log(public_url);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("chat <prompt>")
  .description("Chat with a GMI-hosted LLM")
  .requiredOption("-m, --model <id>", "LLM model ID (see `gmi models --llm`)")
  .option("-s, --system <text>", "System prompt")
  .option("-t, --temperature <n>", "Sampling temperature")
  .action(async (prompt: string, opts) => {
    try {
      const messages = [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: prompt },
      ];
      const params: Record<string, unknown> = {};
      if (opts.temperature !== undefined) params.temperature = Number(opts.temperature);
      const { text } = await client().chat(opts.model, messages, params);
      console.log(text);
    } catch (e) {
      fail(e);
    }
  });

program.parseAsync().catch(fail);
