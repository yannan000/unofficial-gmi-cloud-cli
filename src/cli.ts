#!/usr/bin/env node
/**
 * gmi — Unofficial GMI Cloud CLI for GMI Studio (image/video/audio) + LLMs.
 *
 * Auth: GMI_API_KEY from the shell, ./.env, <package>/.env, or ~/.config/gmi/.env
 * (create a key at console.gmicloud.ai → API Keys).
 */
import { Command } from "commander";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import {
  GmiClient,
  GmiError,
  GenerationRequest,
  extractMediaUrls,
  TERMINAL_STATUSES,
} from "./client.js";
import { loadEnv } from "./config.js";
import { downloadAssets } from "./download.js";
import { renderModelsTable, renderModelDetail, renderTable, startSpinner, Spinner } from "./ui.js";

/** Resolve --image values: URLs pass through, local paths get uploaded. */
async function resolveImages(c: GmiClient, values: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const v of values) {
    if (/^https?:\/\//.test(v)) {
      urls.push(v);
      continue;
    }
    const bytes = await readFile(v);
    const spin = startSpinner(`uploading ${basename(v)}`);
    try {
      const { public_url } = await c.uploadFile(basename(v), bytes);
      spin.stop(`Uploaded ${basename(v)}`);
      urls.push(public_url);
    } catch (e) {
      spin.stop();
      throw e;
    }
  }
  return urls;
}

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
  .option(
    "-i, --image <path-or-url...>",
    "Input image(s): local files are auto-uploaded, URLs pass through",
  )
  .option("--image-key <key>", "Payload key for --image (see `gmi model <id>`)", "image")
  .option("-o, --output <dir>", "Download generated assets into this directory")
  .option("--no-wait", "Return the request_id immediately instead of waiting")
  .option("--timeout <seconds>", "Max seconds to wait for completion", "600")
  .action(async (opts) => {
    try {
      let payload: Record<string, unknown> = {};
      if (opts.payload) payload = JSON.parse(opts.payload);
      if (opts.prompt) payload.prompt = opts.prompt;
      const c = client();
      if (opts.image?.length) {
        const urls = await resolveImages(c, opts.image);
        const plural = opts.imageKey.endsWith("s") || urls.length > 1;
        payload[opts.imageKey] = plural ? urls : urls[0];
      }
      if (Object.keys(payload).length === 0) {
        fail(new GmiError("Provide -p/--prompt, --payload, or --image. See `gmi model <id>` for parameters."));
      }
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
  .command("requests [model]")
  .description("List your recent generation jobs, optionally filtered by model")
  .option("--json", "Print raw JSON")
  .action(async (model: string | undefined, opts) => {
    try {
      const resp = await client().listGenerations(model);
      if (opts.json) return printJson(resp);
      const rows = (resp.requests ?? []).map((r) => {
        const ts = r.created_at ? new Date(r.created_at > 1e12 ? r.created_at : r.created_at * 1000) : undefined;
        return [
          r.request_id,
          r.model,
          r.status,
          ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString() : "",
        ];
      });
      if (rows.length === 0) return console.log("No requests found.");
      console.log(renderTable(["REQUEST ID", "MODEL", "STATUS", "CREATED"], rows));
    } catch (e) {
      fail(e);
    }
  });

const config = program.command("config").description("Manage CLI configuration");
config
  .command("set-key <api-key>")
  .description("Store the API key in ~/.config/gmi/.env (chmod 600)")
  .action(async (apiKey: string) => {
    try {
      const dir = join(homedir(), ".config", "gmi");
      const path = join(dir, ".env");
      await mkdir(dir, { recursive: true });
      let existing = "";
      try {
        existing = await readFile(path, "utf8");
      } catch {}
      const others = existing
        .split("\n")
        .filter((l) => l.trim() && !l.match(/^\s*(export\s+)?GMI_API_KEY\s*=/));
      await writeFile(path, [`GMI_API_KEY=${apiKey}`, ...others, ""].join("\n"));
      await chmod(path, 0o600);
      console.log(`Saved to ${path}`);
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
      const { public_url } = await client().uploadFile(basename(file), bytes);
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
  .option("--no-stream", "Wait for the full response instead of streaming")
  .action(async (prompt: string, opts) => {
    try {
      const messages = [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: prompt },
      ];
      const params: Record<string, unknown> = {};
      if (opts.temperature !== undefined) params.temperature = Number(opts.temperature);
      if (opts.stream) {
        await client().chatStream(opts.model, messages, params, (d) => process.stdout.write(d));
        process.stdout.write("\n");
      } else {
        const { text } = await client().chat(opts.model, messages, params);
        console.log(text);
      }
    } catch (e) {
      fail(e);
    }
  });

program.parseAsync().catch(fail);
