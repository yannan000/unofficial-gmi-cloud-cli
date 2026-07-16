# GMI Cloud CLI

<a href="https://console.gmicloud.ai/ref/ZB44WJST">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="banner/gmi-logo-white.png">
    <img src="banner/gmi-logo-black.png" alt="GMI Cloud" height="40">
  </picture>
</a>

**Powered by [GMI Cloud](https://gmicloud.ai)** — *if it can be imagined, run it.*

[![CI](https://github.com/yannan000/unofficial-gmi-cloud-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/yannan000/unofficial-gmi-cloud-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/unofficial-gmi-cloud-cli.svg)](https://www.npmjs.com/package/unofficial-gmi-cloud-cli)
[![npm downloads](https://img.shields.io/npm/dm/unofficial-gmi-cloud-cli.svg)](https://www.npmjs.com/package/unofficial-gmi-cloud-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)

> **Your terminal is now a film studio.**
> One command to any of GMI Studio's 300+ models — image, video, audio, and LLMs — with uploads, format conversion, polling, downloads, and cost checks handled for you.

> 🟡 Built for **GMI Studio** by a [**GMI Cloud ambassador**](https://console.gmicloud.ai/ref/ZB44WJST) — an independent, open-source tool (not an official GMI product). MIT-licensed, bring your own API key, $0 markup.

![GMI Cloud CLI — your AI is now a film studio](banner/social-preview.jpg)

---

## You don't need to be a developer

If you use an AI assistant — Claude, Cursor, Codex, Windsurf, Cline, Kilo, droid, Grok — **it can set this up and drive it for you.** Copy this sentence, paste it to your assistant, done:

> **Set up the GMI CLI by following the "For AI agents" steps at https://github.com/yannan000/unofficial-gmi-cloud-cli, then run `gmi doctor` to confirm everything works.**

The only thing your assistant will ask you for is a GMI API key. [**Sign up for GMI Cloud here**](https://console.gmicloud.ai/ref/ZB44WJST) *(referral link)*, then create a key under → API Keys — it's shown once, so copy it when it appears.

### Then just say what you want

You talk. Your assistant runs the studio. Some things creators say:

- *"Make a 9:16 POV vlog of a Roman soldier filming himself the morning before battle — selfie angle, talking to camera, handheld shake."*
- *"Bigfoot morning routine vlog, episode 2. Same Bigfoot as last time — use yesterday's keyframe so he looks identical."*
- *"Glass fruit cutting ASMR — knife slicing a translucent glass strawberry on a wooden board, macro shot, crisp sound on."*
- *"Here's my product photo — make a UGC-style ad where a woman holds it up and talks to camera about it, 15 seconds, vertical."*
- *"Here's a photo of me — put me in an Argentina kit and animate me scoring a World Cup goal, Messi assist."* (This works — see the recipe below. A three-scene film cost about $12.)
- *"Generate 10 b-roll clips for my faceless channel video about ancient Egypt, plus a voiceover of this script."*
- *"Batch out this week's 5 shorts overnight and put them in my content folder — tell me what it'll cost first."*

Your assistant will pick the model, check the price **before** spending, upload your files (iPhone HEIC photos are fine), wait on the render, and download the results. If something's misconfigured, it costs $0 — every job is validated before submission.

### What this actually is, in one paragraph

GMI Studio is a website where you can use 300+ AI models (Kling, Veo, Sora, Gemini Image, MiniMax…) to make images, video, and audio. It's great for one image — but making anything real (a batch of ads, a multi-scene video) means dozens of uploads, clicks, tabs, and downloads. This tool turns all of that into commands an AI assistant (or you) can run — so the work happens while you do something else.

---

## Works with every AI assistant

The package is both a **CLI** (commands) and an **MCP server** (native tool integration). One command configures any client:

```bash
gmi mcp-config                    # list every supported client + its config file
gmi mcp-config cursor --install   # write the config in (backs up the old one)
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

No API key in your IDE configs: the server auto-loads `GMI_API_KEY` from `~/.config/gmi/.env`. `gmi mcp` starts the same server — handy in custom configs, and after npm install it's `npx -y unofficial-gmi-cloud-cli mcp`.

### ChatGPT & claude.ai (remote connectors)

Browser chats (ChatGPT, claude.ai) can't run a local program — they only connect to **remote** MCP servers over HTTPS. `gmi mcp --http` serves exactly that:

```bash
# a strong token is REQUIRED — it guards an endpoint wired to your GMI key
GMI_MCP_TOKEN=$(openssl rand -hex 24) gmi mcp --http --port 8787
```

This exposes two endpoints: `/mcp` (Streamable HTTP — Claude Code `--transport http`, modern clients) and `/sse` (for ChatGPT connectors). Put it behind a tunnel you control (e.g. `cloudflared tunnel --url http://localhost:8787`), then add the public URL as a connector:

- **ChatGPT** — Settings → Connectors → add your `https://…/sse` URL, auth header `Authorization: Bearer <your token>`
- **claude.ai** — [claude.ai/customize/connectors](https://claude.ai/customize/connectors) → add `https://…/mcp` with the same bearer header
- **Claude Code (remote)** — `claude mcp add --transport http gmi-studio https://…/mcp --header "Authorization: Bearer <token>"`

> ⚠️ **Security:** the HTTP endpoint spends your GMI credits for anyone who has the URL + token. It requires a 16+ char `GMI_MCP_TOKEN` and refuses to start without one. Bind to localhost + a private tunnel; never expose it unauthenticated. Chat apps have no local filesystem, so `generate` returns media **URLs** rather than downloading files — the local CLI is still the best experience for saving assets.

## Who it's for

| You are… | Your pain | What you get |
|----------|-----------|--------------|
| **A creator** shipping daily (shorts, ASMR, UGC ads, faceless channels) | Console throughput; format walls; surprise spend | Storyboard in stills, render in batches, download to `./clips` — one command per shot |
| **A builder** adding gen-media to a product or pipeline | Weeks of API wrapper work; retry/idempotency landmines | The client you were about to write, already battle-tested — 39 tests pin the real API's behavior |
| **An agent user** (Claude, Cursor, Codex, droid…) | Wants the AI to *do* the work end to end | One MCP server = your assistant sees all 300+ models and runs your whole render pipeline |

## There's no extra cost

Work done through this tool costs exactly what the same generation costs in the GMI console. Bring your own API key; the tool adds nothing. It actually tends to cost *less* in practice, because every job is priced and validated **before** submission — the mistakes that would burn credits fail locally for free, and `--dry-run` previews any job without spending a cent.

---

## For developers

### Why this exists

Using GMI Studio at production pace means fighting four kinds of friction:

- **Console click-work** — every generation is a browser session. Fine for one image, brutal for a 12-shot storyboard.
- **Raw API plumbing** — an async job queue with quirks (presigned uploads that sign a literal `image/jpg` content type, jobs to poll, media URLs buried in nested JSON). Every developer rebuilds the same wrapper.
- **Format walls** — the upload API accepts six file types; creators live in HEIC, WebP, MOV, and FLAC.
- **Blind spend** — malformed payloads and over-spec jobs cost money to discover.

| | |
|---|---|
| ⚡ **One command per shot** | `gmi generate -m kling-v3-image-to-video --image ./keyframe.heic -p "..." -o ./clips` — upload, conversion, submission, polling, and download in one line |
| 📁 **Any file in** | HEIC, WebP, TIFF, MOV, FLAC — auto-converted before upload (via macOS `sips` or `ffmpeg`) |
| 💰 **Never pay to be wrong** | Payloads validated against the model's schema and **priced before submission**; failed submissions cost $0; `--dry-run` previews everything |
| 🔁 **Async, tamed** | Live progress with elapsed time, `Ctrl+C` prints the resume command, retries that never double-submit a paid job |
| 🤖 **Agent-native** | The same package is an MCP server with 7 typed tools |
| 🧠 **Production knowledge included** | Which providers accept human likenesses (Kling ✓, Seedance ✗ — even AI-rendered ones) — learned in real production |

It covers both GMI surfaces with one shared client:

- **Studio / generative media** — image, video, audio via the async request queue at `console.gmicloud.ai/api/v1/ie/requestqueue/apikey`
- **Inference Engine LLMs** — OpenAI-compatible chat at `api.gmi-serving.com/v1` (DeepSeek, Qwen, Llama, …)

> **Scope (this release):** `gmi` drives the **GMI Studio generation** side only — running models to produce images, video, and audio, plus LLM inference. Published GMI Studio **Workflows** are runnable too, since they appear in the model catalog (`gmi generate -m <workflow-id> …`). **Creating or editing** workflows — including natural-language workflow authoring — is done in the GMI Studio visual editor and is **not** part of this CLI (GMI exposes no authoring API). If that changes, support can follow.

### Setup

```bash
npm install && npm run build
```

Put your key (from **console.gmicloud.ai → API Keys** — [sign up here](https://console.gmicloud.ai/ref/ZB44WJST) if you don't have an account) in any of (shell env always wins):

```bash
gmi config set-key                # prompts with hidden input (keeps the key out of shell history)
gmi config set-key YOUR_KEY       # or pass it directly; writes ~/.config/gmi/.env, chmod 600
# or put GMI_API_KEY in ./.env, or <package>/.env
```

Run `npm link` once to get `gmi` on your PATH (or use `node dist/cli.js ...`).

### CLI reference

```bash
gmi models                        # Studio media models, as a table
gmi models --type video           # filter by type/name
gmi models --llm                  # LLM models with $/M-token pricing
gmi models --json                 # raw JSON (for scripting)
gmi model seedream-5.0-lite       # parameter schema + pricing, readable

# generate an image and save it locally (spinner shows live status + elapsed time)
gmi generate -m seedream-5.0-lite -p "San Francisco skyline at dusk, cinematic" -o ./out

# image-to-video: local files are auto-uploaded (--image-key picks the payload field)
gmi generate -m kling-v3-image-to-video --image ./photo.heic -p "gentle camera push-in" -o ./out

# pre-flight: validate the payload against the model schema + estimate cost, no submit
gmi generate -m Veo3 -p "..." --dry-run

# fire-and-forget, then poll / fetch later (Ctrl+C during a wait prints the resume command)
gmi generate -m Veo3 -p "..." --no-wait -q        # -q prints only the request_id
gmi status <request-id> --wait -o ./out
gmi download <request-id> -o ./out -q             # -q prints only saved paths
gmi requests --status failed --limit 10           # filterable job history

# upload any common file format, get a public URL (auto-converted if needed)
gmi upload ./photo.heic

# chat with an LLM (streams by default; --no-stream for scripting)
gmi chat -m deepseek-ai/DeepSeek-V3 "Write 5 punchy captions for a sunset lighthouse reel"

gmi doctor                        # key, connectivity, converters — health check
gmi update                        # update in place (git checkout → pull+build; npm → @latest)
```

The CLI also checks for new versions at most once a day (silently, on the npm registry) and prints a one-line notice when an update exists — never during MCP serving, and a failed check never breaks a command.

Requests retry automatically on 429 rate limits (and on 5xx/network errors for reads; job submissions are never blindly re-sent).

### Choosing a video model (learned in production)

| Model | Human likenesses | Frame pinning | Audio | Price (720p-ish) |
|-------|-----------------|---------------|-------|------------------|
| **Kling V3 pro** | ✅ accepts real faces | `image` + `image_tail` | ✅ | $0.168–0.252/s |
| **Seedance 2.0** | ❌ rejects ANY photorealistic person — real photo *or* AI-rendered | `first_frame` + `last_frame` | ✅ | $0.152/s |
| **Veo 3.1** | ⚠️ strict person filters | first+last frame | ✅ native | $0.40/s |
| **Sora 2 Pro** | ⚠️ strictest of all | — | ✅ | $0.50/s |

**The recipe that works for character video:** generate an identity still with `gemini-3-pro-image` (reference your photo), build scene keyframes from it (start + end per shot), then animate with Kling V3 pinning both ends. The video model only interpolates motion between compositions that are already right.

### Job lifecycle

Generation is async: `created → queued → dispatched → processing → success | failed | cancelled`.
On `success`, the job's `outcome` contains the generated asset URLs; the client extracts them for you.

### Testing

39 tests pin every real API behavior — response shapes, the upload contract, retry policy, cost math, config merging, and download path-traversal defense. `npm test`. CI runs on every push (ubuntu + macos × Node 22/24).

### Security

See [SECURITY.md](SECURITY.md) for the security model (key handling, public upload URLs, the MCP/agent surface, network footprint) and how to report a vulnerability. In short: your key is stored `0600` and sent only to GMI; uploads produce public URLs; downloads are written only inside your chosen output directory; no telemetry beyond a once-daily npm version check.

### Docs

- API intro: https://docs.gmicloud.ai/api-reference/introduction
- Video API: https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference
- LLM API: https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference
- Full doc index: https://docs.gmicloud.ai/llms.txt

---

## FAQ

**Why not just use the GMI console?**
Use both. The console is great for exploring one model. `gmi` is for the day you have 12 shots and a deadline — or an AI assistant you'd rather hand the work to.

**Is this affiliated with GMI Cloud?**
It's built by a GMI Cloud ambassador — an independent, open-source tool, not an official GMI product. MIT-licensed, bring your own key, no markup; it calls the same APIs your console session does.

**Another wrapper that'll rot in six months?**
39 tests pin every real API behavior, CI runs on every push across two OSes and two Node versions, and `gmi update` keeps installs current. It's maintained like infrastructure, not a gist.

**Can it handle real people / my face?**
Yes — with the right model. Kling accepts human likenesses; Seedance never will (its filter rejects any photorealistic person, even AI-rendered ones). The model matrix above saves you from finding that out with your own money.

**What does it cost to try?**
The tool is free. Generations bill to your GMI key at GMI's prices — a test image is ~$0.035, and every job shows its estimated cost before submitting. `--dry-run` costs nothing at all.

## The story

> One evening, one terminal: a three-scene World Cup short — a real person's likeness scoring in a packed final, a Messi-style #10 assisting — for about **$12** in model spend. Keyframes from Gemini, motion from Kling with start and end frames pinned, audio on, assembled with ffmpeg. The failed takes cost $0, because every job is priced and validated before it's submitted. Then Erling Haaland did the Jack Sparrow dock walk, just because the pipeline made it a ten-minute job. That pipeline is this repo.

---

## For AI agents

*If you are an AI assistant setting this up for a user, follow these steps:*

1. Clone and build:
   ```bash
   git clone https://github.com/yannan000/unofficial-gmi-cloud-cli.git
   cd unofficial-gmi-cloud-cli && npm install && npm run build && npm link
   ```
2. Ask the user for their GMI API key (they create it at **console.gmicloud.ai → API Keys**; it is shown only once — new users can [sign up here](https://console.gmicloud.ai/ref/ZB44WJST)). Store it with:
   ```bash
   gmi config set-key THEIR_KEY
   ```
3. Verify: `gmi doctor` — all checks should pass. (`ffmpeg` is optional; without it, image conversion still works on macOS via `sips`.)
4. Optionally register yourself as an MCP client: `gmi mcp-config` lists supported clients; `gmi mcp-config <your-client> --install` writes the config.
5. Before submitting any paid generation for the user: check the model's parameters with `gmi model <id>`, prefer `--dry-run` first, and tell the user the estimated cost. Use `-q`/`--json` flags for parseable output.
6. Model selection guidance is in "Choosing a video model" above. Note: Seedance rejects any photorealistic person; use Kling for human subjects.
