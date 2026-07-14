# Launch Posts — ready to paste

**Status: LIVE.** `npm install -g unofficial-gmi-cloud-cli`
- npm: https://www.npmjs.com/package/unofficial-gmi-cloud-cli
- repo: https://github.com/yannan000/unofficial-gmi-cloud-cli

Keep honest everywhere: the CLI **runs** GMI Studio generation (image/video/audio models, published Workflows) + LLM inference, and works in every AI assistant — Claude, Cursor, Codex, ChatGPT, and claude.ai (remote MCP). It does **not** create/edit workflows (that's the Studio visual editor). Chat apps get media **URLs** back, not downloaded files (no filesystem).

---

## 1. X / Twitter thread

**Tweet 1 — hook + proof**
> I made a World Cup film starring myself — scoring a goal, Messi assisting — from my terminal. One command per shot. ~$12 all in, failed takes included.
>
> So I turned the whole pipeline into an open-source CLI for GMI Studio. Your terminal is now a film studio. Live on npm 🧵

*(attach: the World Cup clip)*

**Tweet 2 — what it is**
> GMI Studio has 300+ models in one place — Kling, Veo, Sora, Gemini Image, MiniMax. Great for one image. Painful for a real project: dozens of uploads, tabs, downloads.
>
> `gmi` makes it one command: upload → generate → poll → download. Any file in, even iPhone HEIC.

**Tweet 3 — the feature I actually care about**
> It prices every job BEFORE you submit. Bad payload? Fails locally for $0. `--dry-run` shows the cost without spending a cent.
>
> The failed takes on my film cost nothing. That's the point.

**Tweet 4 — works in every AI you already use**
> It's also an MCP server. It plugs into Claude, Cursor, Codex, Windsurf, Cline, Kilo, Grok, Factory — and now ChatGPT and claude.ai too.
>
> `gmi mcp-config cursor --install`
>
> Then just say: "make me 5 vertical b-roll clips." Your AI runs the studio.

**Tweet 5 — CTA**
> Live now, open source, MIT, bring your own GMI key (I add $0):
>
> `npm install -g unofficial-gmi-cloud-cli`
> https://github.com/yannan000/unofficial-gmi-cloud-cli
>
> Unofficial — built by a creator tired of the console. And yes, I made Haaland do the Jack Sparrow dock walk. Because I could. 🏴‍☠️

---

## 2. Announcement (LinkedIn / blog / launch post)

**Title:** Your terminal is now a film studio — introducing the Unofficial GMI Cloud CLI

> GMI Studio put 300+ generative models in one place — Kling, Veo, Sora, Gemini Image, MiniMax, and more. It's a fantastic place to make a single image. But the moment you try to make something *real* — a multi-scene video, a batch of ads, a week of shorts — the web console turns into dozens of uploads, tabs, and manual downloads.
>
> So I built **`gmi`**, an open-source CLI (and MCP server) that turns all of that into commands. It's live on npm today.
>
> **One command per shot:**
> `gmi generate -m kling-v3-image-to-video --image ./photo.heic -p "..." -o ./clips`
> — uploads your file (any format, even HEIC), submits, waits, and downloads the result.
>
> **What I ended up caring about most while building it:**
> - **It prices every job before submitting.** A malformed request fails locally for $0 instead of after you've paid. `--dry-run` previews cost without spending.
> - **Any file format in** — HEIC, WebP, MOV, FLAC — auto-converted before upload.
> - **It works in whatever AI you already use.** The same package is an MCP server for Claude Code, Cursor, Codex, Windsurf, Cline, Kilo, Grok, and Factory — and, over a secure remote connector, ChatGPT and claude.ai. "Make me 5 vertical clips and download them" becomes a real workflow.
> - **Production knowledge baked in.** The README documents which models accept real faces (Kling) and which reject them (Seedance) — so you don't burn an evening finding out.
>
> As a stress test, I produced a three-scene short film — a real person scoring a World Cup goal with a Messi assist, plus a pirate-harbor scene — end to end through the CLI in one evening for about **$12**, failed takes included.
>
> It's **unofficial** — not affiliated with GMI Cloud, MIT-licensed, bring your own key, zero markup. This release drives GMI Studio's **generation** side (running models and published workflows) plus LLM inference; creating workflows still lives in the Studio visual editor.
>
> `npm install -g unofficial-gmi-cloud-cli`
> https://github.com/yannan000/unofficial-gmi-cloud-cli

---

## 3. Show HN

**Title:**
`Show HN: A CLI + MCP server for GMI Studio's 300+ gen-media models`

**Body:**
> I kept using GMI Studio (Kling, Veo, Sora, Gemini Image, etc.) and kept rebuilding the same wrapper around its async job queue, so I turned it into a proper tool. It's on npm: `npm install -g unofficial-gmi-cloud-cli`.
>
> `gmi generate -m kling-v3-image-to-video --image ./photo.heic -p "..." -o ./clips` does upload → submit → poll → download in one line. Things I ended up caring about:
>
> - **Cost pre-flight.** It validates the payload against each model's schema and prints the estimated cost before submitting. A malformed job fails locally for $0. `--dry-run` previews without spending.
> - **The upload contract was undocumented-weird.** GMI's presigned PUT is signed for a literal `image/jpg` content type, and the request body wants `{"file_type": "jpg"}` (bare extension). Reverse-engineered and pinned with a test.
> - **Provider likeness filters differ a lot.** Kling accepts photorealistic faces; Seedance (BytePlus) rejects ANY photorealistic person — even AI-rendered ones. The README says which model to use so you don't waste credits.
> - **It's an MCP server two ways.** Local stdio for Claude Code / Cursor / Codex / etc. (`gmi mcp-config <client> --install`), and an authenticated HTTP/SSE mode (`gmi mcp --http`) so ChatGPT and claude.ai remote connectors can drive it too. The HTTP endpoint refuses to start without a bearer token, since it spends real credits.
>
> Retries never double-submit a paid job (429 retries everywhere, 5xx only for reads). 43 tests, CI on ubuntu+macos × Node 22/24. Unofficial, MIT, bring your own key. Scope note: it runs generation (models + published Studio workflows) and LLM inference; it doesn't author workflows — that's the Studio UI.
>
> As a stress test I made a 3-scene short film (a real person scoring a World Cup goal, a pirate-harbor scene) end to end through the CLI in one evening for ~$12 including failed takes. Recipe's in the README: identity still (Gemini) → scene keyframes → Kling with start/end frames pinned → ffmpeg.
>
> Repo: https://github.com/yannan000/unofficial-gmi-cloud-cli
>
> Happy to answer questions about the async-queue quirks, the keyframe pipeline, or the remote-MCP setup.

---

## 4. GMI Discord

*(Lead with the useful gift — the model matrix — not the pitch. Community-first. Post in #showcase / #community / #built-with-gmi.)*

> Hey all — I've been building a lot on GMI Studio and made an open-source CLI + MCP server to drive it from the terminal (and from Claude, Cursor, Codex, ChatGPT…). It's live on npm now. Sharing in case it's useful, plus a couple of things I learned the hard way that might save you credits:
>
> **Model likeness filters (the big one):**
> - `kling-v3-image-to-video` — accepts photorealistic faces, has `image_tail` for end-frame pinning. Best for character video.
> - `seedance-2-0-260128` — rejects ANY photorealistic person, even AI-rendered keyframes (`InputImageSensitiveContentDetected`). Great model, just not for human subjects.
> - Veo 3.1 / Sora 2 — strictest likeness filters.
>
> **Upload gotcha:** the presigned upload wants `{"file_type": "jpg"}` (bare extension, only jpeg/jpg/png/mp4/mp3/wav) and the PUT must send the literal signed content type (`image/jpg`). Took me a while.
>
> **Nice surprise:** published Studio Workflows show up in the model catalog, so the CLI can run them too — `gmi generate -m <workflow-id> --image selfie.jpg -o ./out`. (Creating workflows is still the visual editor — the CLI only runs them.)
>
> **The tool** (`gmi`): one command does upload → generate → poll → download, auto-converts any file format, and — the part I like most — prices every job before submitting so a bad payload fails for $0. It's an MCP server, so your AI assistant can run the whole thing (works in Claude Code/Desktop, Cursor, Codex, and via a secure remote connector, ChatGPT + claude.ai).
>
> `npm install -g unofficial-gmi-cloud-cli`
> https://github.com/yannan000/unofficial-gmi-cloud-cli
>
> ⚠️ It's **unofficial** — not affiliated with the GMI team, just a community tool. Bring your own key, zero markup. Feedback very welcome, and mods please pull this if it's the wrong channel 🙏
>
> (I also used it to make myself score a World Cup goal with a Messi assist for ~$12 — pipeline's in the README if you want to make your own.)
