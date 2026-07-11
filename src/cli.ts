#!/usr/bin/env node
/**
 * gmi — Unofficial GMI Cloud CLI for GMI Studio (image/video/audio) + LLMs.
 *
 * Auth: GMI_API_KEY from the shell, ./.env, <package>/.env, or ~/.config/gmi/.env
 * (create a key at console.gmicloud.ai → API Keys).
 */
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import {
  GmiClient,
  GmiError,
  GenerationRequest,
  extractMediaUrls,
  TERMINAL_STATUSES,
} from "./client.js";
import { loadEnv } from "./config.js";
import { downloadAssets } from "./download.js";
import { renderModelsTable, renderModelDetail, startSpinner, Spinner } from "./ui.js";

loadEnv();

const program = new Command();

program
  .name("gmi")
  .description("Unofficial GMI Cloud CLI — Studio media generation + LLM inference")
  .version("0.2.0");

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

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Poll a job with a spinner; Ctrl+C prints how to resume instead of losing the job. */
async function waitWithSpinner(
  c: GmiClient,
  requestId: string,
  timeoutSeconds: number,
): Promise<GenerationRequest> {
  const spin: Spinner = startSpinner(`${requestId} — waiting`);
  const onInt = () => {
    spin.stop();
    console.error(`\nInterrupted — the job is still running on GMI Cloud.`);
    console.error(`Resume with: gmi status ${requestId} --wait`);
    process.exit(130);
  };
  process.on("SIGINT", onInt);
  try {
    return await c.waitForGeneration(requestId, {
      timeoutMs: timeoutSeconds * 1000,
      onPoll: (r) => {
        if (!TERMINAL_STATUSES.includes(r.status)) spin.update(`${requestId} — ${r.status}`);
      },
    });
  } finally {
    process.removeListener("SIGINT", onInt);
    spin.stop();
  }
}

/** Shared tail for generate/status/download: print results, optionally save assets. */
async function finishJob(r: GenerationRequest, outputDir?: string): Promise<void> {
  if (r.status !== "success") {
    fail(new GmiError(`Generation ${r.status}${r.reason ? `: ${r.reason}` : ""}`));
  }
  const urls = extractMediaUrls(r.outcome);
  if (outputDir) {
    const spin = startSpinner(`downloading ${urls.length} asset(s)`);
    try {
      const saved = await downloadAssets(urls, outputDir, r.request_id.slice(0, 8));
      spin.stop(`Saved ${saved.length} file(s)`);
      saved.forEach((p) => console.log(p));
      return;
    } catch (e) {
      spin.stop();
      fail(e);
    }
  }
  printJson({ request_id: r.request_id, status: r.status, media_urls: urls, outcome: r.outcome });
}

program
  .command("models")
  .description("List Studio generative-media models (use --llm for LLM models)")
  .option("--llm", "List LLM models instead of Studio media models")
  .option("--type <filter>", "Filter by type or name substring, e.g. image, video, audio")
  .option("--json", "Print raw JSON")
  .action(async (opts) => {
    try {
      const resp = opts.llm ? await client().listLlmModels() : await client().listStudioModels();
      if (opts.json) return printJson(resp);
      const table = renderModelsTable(resp, opts.type);
      if (table) console.log(table);
      else printJson(resp); // unrecognized shape — show everything
    } catch (e) {
      fail(e);
    }
  });

program
  .command("model <model-id>")
  .description("Show a Studio model's parameter schema and pricing")
  .option("--json", "Print raw JSON")
  .action(async (modelId: string, opts) => {
    try {
      const resp = await client().getStudioModel(modelId);
      if (opts.json) return printJson(resp);
      const detail = renderModelDetail(resp);
      if (detail) console.log(detail);
      else printJson(resp);
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
  .option("-o, --output <dir>", "Download generated assets into this directory")
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
      if (!opts.wait) return printJson(created);
      const done = await waitWithSpinner(c, created.request_id, Number(opts.timeout));
      await finishJob(done, opts.output);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("status <request-id>")
  .description("Check a generation job's status (add --wait to poll until done)")
  .option("--wait", "Poll until the job reaches a terminal status")
  .option("-o, --output <dir>", "Download generated assets into this directory when done")
  .option("--timeout <seconds>", "Max seconds to wait", "600")
  .action(async (requestId: string, opts) => {
    try {
      const c = client();
      if (opts.wait) {
        const done = await waitWithSpinner(c, requestId, Number(opts.timeout));
        return finishJob(done, opts.output);
      }
      const r = await c.getGeneration(requestId);
      if (opts.output && r.status === "success") return finishJob(r, opts.output);
      printJson({ ...r, media_urls: extractMediaUrls(r.outcome) });
    } catch (e) {
      fail(e);
    }
  });

program
  .command("download <request-id>")
  .description("Download a completed job's assets")
  .option("-o, --output <dir>", "Directory to save into", ".")
  .action(async (requestId: string, opts) => {
    try {
      const r = await client().getGeneration(requestId);
      await finishJob(r, opts.output);
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
