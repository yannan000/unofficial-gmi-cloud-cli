# Unofficial GMI Cloud CLI

> ⚠️ Unofficial community tool for **GMI Studio**. Not affiliated with or endorsed by GMI Cloud.

CLI **and** MCP server for [GMI Cloud](https://console.gmicloud.ai) — one shared client covering:

- **Studio / generative media** — image, video, and audio models (Seedream, Veo, Kling, Sora, Flux, MiniMax TTS, …) via the async request queue at `console.gmicloud.ai/api/v1/ie/requestqueue/apikey`
- **Inference Engine LLMs** — OpenAI-compatible chat API at `api.gmi-serving.com/v1` (DeepSeek, Qwen, Llama, …)

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

# fire-and-forget, then poll / fetch later (Ctrl+C during a wait prints the resume command)
gmi generate -m Veo3 -p "..." --no-wait
gmi status <request-id> --wait -o ./out
gmi download <request-id> -o ./out

# upload a reference image (for image-to-video models), get a public URL
gmi upload ./photo.jpg

# chat with an LLM
gmi chat -m deepseek-ai/DeepSeek-V3 "Summarize BSIS armed guard requirements"
```

Run `npm link` once to get the `gmi` command on your PATH (or use `node dist/cli.js ...`).

## MCP server

Register with Claude Code:

```bash
claude mcp add gmi-studio -e GMI_API_KEY=your-key -- node "/Users/y/Documents/claude projects/GMI MCP or CLI/dist/mcp-server.js"
```

Or in any MCP client config:

```json
{
  "mcpServers": {
    "gmi-studio": {
      "command": "node",
      "args": ["/Users/y/Documents/claude projects/GMI MCP or CLI/dist/mcp-server.js"],
      "env": { "GMI_API_KEY": "your-key" }
    }
  }
}
```

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

## Job lifecycle

Generation is async: `created → queued → dispatched → processing → success | failed | cancelled`.
On `success`, the job's `outcome` contains the generated asset URLs (`video_url`, `media_urls`, etc.); the client extracts them for you.

## Docs

- API intro: https://docs.gmicloud.ai/api-reference/introduction
- Video API: https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference
- LLM API: https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference
- Full doc index: https://docs.gmicloud.ai/llms.txt
