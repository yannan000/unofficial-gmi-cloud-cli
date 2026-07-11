# Unofficial GMI Cloud CLI

[![CI](https://github.com/yannan000/unofficial-gmi-cloud-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/yannan000/unofficial-gmi-cloud-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)

> **Your terminal is now a film studio.**
> One command to any of GMI Studio's 300+ models — image, video, audio, and LLMs — with uploads, format conversion, polling, downloads, and cost checks handled for you.

> ⚠️ Unofficial community tool for **GMI Studio**. Not affiliated with or endorsed by GMI Cloud. MIT-licensed, bring your own API key — this tool adds $0 markup.

## Why

GMI Studio hosts the best generative models in one place — Kling, Veo, Sora, Seedance, Gemini Image, and 300+ more. But using them at production pace means fighting four kinds of friction:

- **Console click-work** — every generation is a browser session. Fine for one image, brutal for a 12-shot storyboard.
- **Raw API plumbing** — an async job queue with quirks (presigned uploads that sign a literal `image/jpg` content type, jobs to poll, media URLs buried in nested JSON). Every developer rebuilds the same wrapper.
- **Format walls** — the upload API accepts six file types; creators live in HEIC, WebP, MOV, and FLAC.
- **Blind spend** — malformed payloads and over-spec jobs cost money to discover.

`gmi` solves all four:

| | |
|---|---|
| ⚡ **One command per shot** | `gmi generate -m kling-v3-image-to-video --image ./keyframe.heic -p "..." -o ./clips` — upload, conversion, submission, polling, and download in one line |
| 📁 **Any file in** | HEIC off your iPhone, WebP, TIFF, MOV, FLAC — auto-converted before upload |
| 💰 **Never pay to be wrong** | Payloads validated against the model's schema and **priced before submission**; failed submissions cost $0; `--dry-run` previews everything |
| 🔁 **Async, tamed** | Live progress with elapsed time, `Ctrl+C` prints the resume command, retries that never double-submit a paid job |
| 🤖 **Agent-native** | The same package is an MCP server — Claude Code (or any MCP client) can drive your whole render pipeline |
| 🧠 **Production knowledge included** | Which providers accept human likenesses (Kling ✓, Seedance ✗ — even AI-rendered ones) — learned in real production so you don't burn an evening finding out |

**Proof:** a three-scene short film — a real person's likeness scoring in a World Cup final alongside a Messi-style #10, plus a pirate-harbor epilogue — was produced entirely through this CLI in one evening for ~**$12** in model spend, including all failed takes ($0 each, thanks to pre-flight).

## What it covers

CLI **and** MCP server for [GMI Cloud](https://console.gmicloud.ai) — one shared client covering:

- **Studio / generative media** — image, video, and audio models (Seedream, Veo, Kling, Sora, Flux, MiniMax TTS, …) via the async request queue at `console.gmicloud.ai/api/v1/ie/requestqueue/apikey`
- **Inference Engine LLMs** — OpenAI-compatible chat API at `api.gmi-serving.com/v1` (DeepSeek, Qwen, Llama, …)

**Who it's for:**

- **Creators** shipping daily — storyboard in stills, render in batches, download to `./clips`
- **Builders** adding gen-media to a product — the API client you were about to write, already battle-tested (30-test suite, CI on every push)
- **Agent users** — add one MCP server and your assistant sees all 305 models

*Not a GUI, not a marketplace, not official. If the console serves you well, keep it — `gmi` is for the day you outgrow it.*

## Setup

```bash
npm install
npm run build
```

Create an API key at **console.gmicloud.ai → API Keys** (shown only once), then put it in any of (checked in order; shell env always wins):

- `./.env` in your working directory
- `.env` in this package's root
- `~/.config/gmi/.env`

```bash
# e.g.
mkdir -p ~/.config/gmi && echo 'GMI_API_KEY=your-key' > ~/.config/gmi/.env
# optional, only for multi-org accounts: GMI_ORG_ID=your-org-id
```

## CLI

```bash
gmi models                        # Studio media models, as a table
gmi models --type video           # filter by type/name
gmi models --llm                  # LLM models
gmi models --json                 # raw JSON (for scripting)
gmi model seedream-5.0-lite       # parameter schema + pricing, readable

# generate an image and save it locally (spinner shows live status + elapsed time)
gmi generate -m seedream-5.0-lite -p "Oakland skyline at dusk, cinematic" -o ./out

# generate a video with full payload control
gmi generate -m Veo3 --payload '{"prompt":"eagle over mountains","durationSeconds":"8","aspectRatio":"16:9"}' -o ./out

# image-to-video: local files are auto-uploaded (--image-key picks the payload field)
gmi generate -m kling-v3-image-to-video --image ./photo.jpg -p "gentle camera push-in" -o ./out
gmi generate -m seedance-2-0-260128 --image ./face1.jpg ./face2.jpg --image-key reference_images -p "..." -o ./out

# pre-flight: validate the payload against the model schema + estimate cost, no submit
gmi generate -m Veo3 -p "..." --dry-run

# fire-and-forget, then poll / fetch later (Ctrl+C during a wait prints the resume command)
gmi generate -m Veo3 -p "..." --no-wait -q        # -q prints only the request_id
gmi status <request-id> --wait -o ./out
gmi download <request-id> -o ./out -q             # -q prints only saved paths
gmi requests --status failed --limit 10           # filterable job history

# upload a file yourself, get a public URL (jpg, jpeg, png, mp4, mp3, wav)
gmi upload ./photo.jpg

# chat with an LLM (streams by default; --no-stream for scripting)
gmi chat -m deepseek-ai/DeepSeek-V3 "Summarize BSIS armed guard requirements"

# store your key without touching .env files by hand
gmi config set-key YOUR_KEY       # writes ~/.config/gmi/.env, chmod 600
```

Requests retry automatically on 429 rate limits (and on 5xx/network errors for reads; job submissions are never blindly re-sent).

Run `npm link` once to get the `gmi` command on your PATH (or use `node dist/cli.js ...`).

## MCP server — works with every AI IDE

The MCP server speaks standard stdio, so it works in **Claude Code, Claude Desktop, Cursor, Windsurf (Cognition), Cline, Kilo Code, OpenAI Codex, Grok CLI, Factory (droid)**, and any other MCP client. One command sets each of them up:

```bash
gmi mcp-config                    # list every supported client + its config file
gmi mcp-config cursor             # print the exact snippet for one client
gmi mcp-config cursor --install   # write it into the client's config (backs up the old one)
```

| Client | Setup |
|--------|-------|
| Claude Code / Cowork | `gmi mcp-config claude-code` → prints the `claude mcp add` one-liner (Cowork shares it; Cowork agents can also drive the `gmi` CLI directly in their terminal) |
| Claude Desktop | `gmi mcp-config claude-desktop --install` |
| Cursor | `gmi mcp-config cursor --install` |
| Windsurf (Cognition) | `gmi mcp-config windsurf --install` |
| Cline (VS Code) | `gmi mcp-config cline --install` (or paste via Cline's MCP UI) |
| Kilo Code (VS Code) | `gmi mcp-config kilo --install` |
| OpenAI Codex CLI | `gmi mcp-config codex` → TOML for `~/.codex/config.toml` |
| Grok CLI | `gmi mcp-config grok --install` |
| Factory (droid) | `gmi mcp-config factory --install` |
| Anything else | `gmi mcp-config generic` — standard `mcpServers` JSON |

No API key in your IDE configs: the server auto-loads `GMI_API_KEY` from `~/.config/gmi/.env`, so the config is just `command: node, args: [.../mcp-server.js]`. (You can still set an `env` block per client if you prefer.)

`gmi mcp` starts the same server — handy as the command in custom configs, and after npm install it's `npx -y unofficial-gmi-cloud-cli mcp`.

### Tools

| Tool | Purpose |
|------|---------|
| `list_studio_models` | List image/video/audio generation models |
| `get_studio_model` | Model parameter schema + pricing (call before generating) |
| `generate_media` | Submit a generation job; waits and returns media URLs by default |
| `get_generation` | Poll a job by `request_id` |
| `upload_file` | Upload a local file → public URL for payloads |
| `list_llm_models` | List OpenAI-compatible LLM models |
| `chat` | Chat completion against a GMI-hosted LLM |

## Choosing a video model (learned in production)

| Model | Human likenesses | Frame pinning | Audio | Price (720p-ish) |
|-------|-----------------|---------------|-------|------------------|
| **Kling V3 pro** | ✅ accepts real faces | `image` + `image_tail` | ✅ | $0.168–0.252/s |
| **Seedance 2.0** | ❌ rejects ANY photorealistic person — real photo *or* AI-rendered | `first_frame` + `last_frame` | ✅ | $0.152/s |
| **Veo 3.1** | ⚠️ strict person filters | first+last frame | ✅ native | $0.40/s |
| **Sora 2 Pro** | ⚠️ strictest of all | — | ✅ | $0.50/s |

**The recipe that works for character video:** generate an identity still with `gemini-3-pro-image` (reference your photo), build scene keyframes from it (start + end per shot), then animate with Kling V3 pinning both ends. The video model only interpolates motion between compositions that are already right.

## Job lifecycle

Generation is async: `created → queued → dispatched → processing → success | failed | cancelled`.
On `success`, the job's `outcome` contains the generated asset URLs (`video_url`, `media_urls`, etc.); the client extracts them for you.

## Docs

- API intro: https://docs.gmicloud.ai/api-reference/introduction
- Video API: https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference
- LLM API: https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference
- Full doc index: https://docs.gmicloud.ai/llms.txt
