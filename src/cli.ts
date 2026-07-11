#!/usr/bin/env node
/**
 * gmi — Unofficial GMI Cloud CLI for GMI Studio (image/video/audio) + LLMs.
 *
 * Auth: GMI_API_KEY from the shell, ./.env, <package>/.env, or ~/.config/gmi/.env
 * (create a key at console.gmicloud.ai → API Keys).
 */
import { Command } from "commander";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLIENTS, findClient, mergeMcpConfig, SERVER_NAME } from "./integrations.js";
import { maybeNotifyUpdate, selfUpdate } from "./update.js";
import {
  GmiClient,
  GmiError,
  GenerationRequest,
  extractMediaUrls,
  TERMINAL_STATUSES,
} from "./client.js";
import { loadEnv, parseEnv, envFileCandidates } from "./config.js";
import { downloadAssets } from "./download.js";
import {
  renderModelsTable,
  renderModelDetail,
  renderTable,
  startSpinner,
  Spinner,
  validatePayload,
  estimateCost,
  itemsOf,
} from "./ui.js";
import { prepareForUpload } from "./convert.js";

/**
 * Resolve --image values: URLs pass through; local paths are converted to a
 * GMI-accepted format if needed, then uploaded.
 */
async function resolveImages(c: GmiClient, values: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const v of values) {
    if (/^https?:\/\//.test(v)) {
      urls.push(v);
      continue;
    }
    const prepared = await prepareForUpload(v);
    if (prepared.converted) console.error(`Converted ${basename(v)} → ${basename(prepared.path)}`);
    const bytes = await readFile(prepared.path);
    const spin = startSpinner(`uploading ${basename(prepared.path)}`);
    try {
      const { public_url } = await c.uploadFile(basename(prepared.path), bytes);
      spin.stop(`Uploaded ${basename(prepared.path)}`);
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
  .version("0.8.0");

// Once-a-day update notice on stderr — never for the MCP server (clean stdio)
// and never for `update` itself.
program.hook("preAction", async (_thisCommand, actionCommand) => {
  if (!["mcp", "update"].includes(actionCommand.name())) {
    await maybeNotifyUpdate(program.version() ?? "0.0.0");
  }
});

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
async function finishJob(r: GenerationRequest, outputDir?: string, quiet = false): Promise<void> {
  if (r.status !== "success") {
    fail(new GmiError(`Generation ${r.status}${r.reason ? `: ${r.reason}` : ""}`));
  }
  const urls = extractMediaUrls(r.outcome);
  if (outputDir) {
    const spin = startSpinner(`downloading ${urls.length} asset(s)`);
    try {
      const saved = await downloadAssets(urls, outputDir, r.request_id.slice(0, 8));
      spin.stop(quiet ? undefined : `Saved ${saved.length} file(s)`);
      saved.forEach((p) => console.log(p));
      return;
    } catch (e) {
      spin.stop();
      fail(e);
    }
  }
  if (quiet) return urls.forEach((u) => console.log(u));
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
  .option("--dry-run", "Validate the payload and show the cost estimate without submitting")
  .option("-q, --quiet", "Print only the request_id (--no-wait) or media URLs / saved paths")
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

      // Pre-flight: validate against the model schema and estimate cost.
      // Warnings only — the API stays the source of truth.
      let detail: unknown;
      try {
        detail = await c.getStudioModel(opts.model);
      } catch {
        // model detail unavailable — skip pre-flight
      }
      if (detail) {
        const check = validatePayload(detail, payload);
        if (check?.missing.length) {
          fail(new GmiError(`Missing required parameter(s) for ${opts.model}: ${check.missing.join(", ")}`));
        }
        if (check?.unknown.length && !opts.quiet) {
          console.error(`Warning: parameter(s) not in ${opts.model}'s schema: ${check.unknown.join(", ")}`);
        }
        const cost = estimateCost(detail, payload);
        if (cost && !opts.quiet) console.error(`Estimated cost: ${cost}`);
      }
      if (opts.dryRun) {
        if (!opts.quiet) console.error("Dry run — not submitting. Payload:");
        printJson({ model: opts.model, payload });
        return;
      }

      const created = await c.createGeneration(opts.model, payload);
      if (opts.quiet && !opts.wait) return console.log(created.request_id);
      console.error(`Request ${created.request_id} submitted (status: ${created.status})`);
      if (!opts.wait) return printJson(created);
      const done = await waitWithSpinner(c, created.request_id, Number(opts.timeout));
      await finishJob(done, opts.output, opts.quiet);
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
  .option("-q, --quiet", "Print only media URLs / saved paths")
  .action(async (requestId: string, opts) => {
    try {
      const c = client();
      if (opts.wait) {
        const done = await waitWithSpinner(c, requestId, Number(opts.timeout));
        return finishJob(done, opts.output, opts.quiet);
      }
      const r = await c.getGeneration(requestId);
      if (opts.output && r.status === "success") return finishJob(r, opts.output, opts.quiet);
      if (opts.quiet) return console.log(r.status);
      printJson({ ...r, media_urls: extractMediaUrls(r.outcome) });
    } catch (e) {
      fail(e);
    }
  });

program
  .command("download <request-id>")
  .description("Download a completed job's assets")
  .option("-o, --output <dir>", "Directory to save into", ".")
  .option("-q, --quiet", "Print only saved file paths")
  .action(async (requestId: string, opts) => {
    try {
      const r = await client().getGeneration(requestId);
      await finishJob(r, opts.output, opts.quiet);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("requests [model]")
  .description("List your recent generation jobs, optionally filtered by model")
  .option("--status <status>", "Filter by status: success, failed, processing, queued, cancelled")
  .option("--limit <n>", "Show at most n rows")
  .option("--json", "Print raw JSON")
  .action(async (model: string | undefined, opts) => {
    try {
      const resp = await client().listGenerations(model);
      let requests = resp.requests ?? [];
      if (opts.status) requests = requests.filter((r) => r.status === opts.status);
      if (opts.limit) requests = requests.slice(0, Number(opts.limit));
      if (opts.json) return printJson(requests);
      const rows = requests.map((r) => {
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

program
  .command("mcp")
  .description("Start the MCP server (stdio) — use this as the command in any MCP client config")
  .action(async () => {
    await import("./mcp-server.js"); // module starts the stdio server on import
  });

program
  .command("mcp-config [client]")
  .description(`Print (or --install) the MCP config for an AI IDE: ${CLIENTS.map((c) => c.id).join(", ")}`)
  .option("--install", "Write the config into the client's config file (JSON clients only)")
  .action(async (clientId: string | undefined, opts) => {
    const serverPath = join(dirname(fileURLToPath(import.meta.url)), "mcp-server.js");
    if (!clientId) {
      console.log(renderTable(
        ["CLIENT", "ID", "CONFIG FILE"],
        CLIENTS.map((c) => [c.name, c.id, c.configPath ?? "—"]),
        70,
      ));
      console.log("\nUsage: gmi mcp-config <id>          # print the snippet");
      console.log("       gmi mcp-config <id> --install  # write it into the config file");
      return;
    }
    const spec = findClient(clientId);
    if (!spec) fail(new GmiError(`Unknown client "${clientId}". Options: ${CLIENTS.map((c) => c.id).join(", ")}`));
    if (opts.install) {
      if (!spec.installable || !spec.configPath) {
        fail(new GmiError(`${spec.name} can't be auto-installed. Apply this manually:\n\n${spec.snippet(serverPath)}`));
      }
      let existing: string | undefined;
      try {
        existing = readFileSync(spec.configPath, "utf8");
      } catch {}
      const merged = mergeMcpConfig(existing, serverPath);
      if (existing !== undefined) await writeFile(`${spec.configPath}.bak`, existing);
      await mkdir(dirname(spec.configPath), { recursive: true });
      await writeFile(spec.configPath, merged + "\n");
      console.log(`✓ Added "${SERVER_NAME}" to ${spec.configPath}${existing !== undefined ? ` (backup: .bak)` : ""}`);
      console.log(`Restart ${spec.name} to load it.`);
      return;
    }
    console.log(`# ${spec.name}${spec.configPath ? ` — ${spec.configPath}` : ""}`);
    if (spec.notes) console.log(`# ${spec.notes}`);
    console.log(spec.snippet(serverPath));
  });

program
  .command("update")
  .description("Update the CLI in place (git checkout → pull+build; npm install → @latest)")
  .action(async () => {
    try {
      const result = await selfUpdate((line) => console.error(line));
      if (result.before === result.after) {
        console.log(`Already up to date (v${result.after}).`);
      } else {
        console.log(`Updated v${result.before} → v${result.after} (${result.mode}).`);
      }
    } catch (e) {
      fail(e);
    }
  });

program
  .command("doctor")
  .description("Check API key, connectivity, and local converters")
  .action(async () => {
    const results: string[][] = [];
    let healthy = true;
    const keySource = process.env.GMI_API_KEY
      ? envFileCandidates().find((p) => {
          try {
            return parseEnv(readFileSync(p, "utf8")).GMI_API_KEY === process.env.GMI_API_KEY;
          } catch {
            return false;
          }
        }) ?? "shell environment"
      : undefined;
    results.push(["API key", keySource ? `✓ found (${keySource})` : "✗ missing — run: gmi config set-key <key>"]);
    if (!keySource) healthy = false;

    if (keySource) {
      try {
        const models = itemsOf(await client().listStudioModels());
        results.push(["Studio API", `✓ reachable (${models.length} models)`]);
      } catch (e) {
        results.push(["Studio API", `✗ ${e instanceof GmiError ? e.message : String(e)}`]);
        healthy = false;
      }
      try {
        const models = itemsOf(await client().listLlmModels());
        results.push(["LLM API", `✓ reachable (${models.length} models)`]);
      } catch (e) {
        results.push(["LLM API", `✗ ${e instanceof GmiError ? e.message : String(e)}`]);
        healthy = false;
      }
    }

    const has = (cmd: string) => {
      try {
        execFileSync("which", [cmd], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    };
    const sips = process.platform === "darwin" && has("sips");
    const ffmpeg = has("ffmpeg");
    results.push(["Image conversion", sips || ffmpeg ? `✓ ${sips ? "sips" : "ffmpeg"}` : "✗ install ffmpeg"]);
    results.push(["Video/audio conversion", ffmpeg ? "✓ ffmpeg" : "– optional: brew install ffmpeg"]);

    console.log(renderTable(["CHECK", "RESULT"], results, 100));
    process.exit(healthy ? 0 : 1);
  });

const config = program.command("config").description("Manage CLI configuration");
/** Read a secret from stdin without echoing (and without shell history). */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // piped input: `echo KEY | gmi config set-key`
      let data = "";
      process.stdin.on("data", (c) => (data += c));
      process.stdin.on("end", () => resolve(data.trim()));
      return;
    }
    process.stderr.write(question);
    process.stdin.resume();
    process.stdin.setRawMode(true);
    let value = "";
    const onData = (buf: Buffer) => {
      for (const ch of buf.toString()) {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stderr.write("\n");
          return resolve(value.trim());
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        else if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

config
  .command("set-key [api-key]")
  .description("Store the API key in ~/.config/gmi/.env (chmod 600). Omit the argument to be prompted — keeps the key out of shell history.")
  .action(async (apiKey: string | undefined) => {
    try {
      if (!apiKey) apiKey = await promptHidden("Paste your GMI API key (input hidden): ");
      if (!apiKey) fail(new GmiError("No key provided."));
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
  .description("Upload a local file (any common format — auto-converted), print the public URL")
  .action(async (file: string) => {
    try {
      const prepared = await prepareForUpload(file);
      if (prepared.converted) console.error(`Converted ${basename(file)} → ${basename(prepared.path)}`);
      const bytes = await readFile(prepared.path);
      const { public_url } = await client().uploadFile(basename(prepared.path), bytes);
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
