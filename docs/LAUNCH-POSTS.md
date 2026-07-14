# Launch Posts — ready to paste

Package: https://www.npmjs.com/package/unofficial-gmi-cloud-cli
Repo: https://github.com/yannan000/unofficial-gmi-cloud-cli

---

## 1. X / Twitter thread

**Tweet 1 (hook + proof)**
> I made a World Cup film starring myself — scoring a goal, Messi assisting — from my terminal. One command per shot. ~$12 all in.
>
> So I turned the whole pipeline into an open-source CLI for GMI Studio's 300+ models. Your terminal is now a film studio. 🧵

*(attach: the-final.mp4 or a clip)*

**Tweet 2 (what it is)**
> GMI Studio hosts Kling, Veo, Sora, Gemini Image, MiniMax — 300+ models in one place. Amazing for one image. Brutal for a real project: dozens of uploads, tabs, downloads.
>
> `gmi` collapses that into one command: upload → generate → poll → download. Any file format in (even iPhone HEIC).

**Tweet 3 (the killer feature)**
> It prices every job BEFORE you submit. Malformed request? Fails locally for $0. `--dry-run` previews cost without spending a cent.
>
> The failed takes on my film cost nothing. That's the whole point.

**Tweet 4 (agent-native)**
> It's also an MCP server. One command wires it into Claude Code, Cursor, Codex, Windsurf, Cline, Kilo, Grok, or Factory:
>
> `gmi mcp-config cursor --install`
>
> Then just tell your AI: "make me 5 vertical b-roll clips and download them." It runs the studio.

**Tweet 5 (CTA)**
> Open source, MIT, bring your own GMI key (I add $0):
>
> `npm install -g unofficial-gmi-cloud-cli`
>
> https://github.com/yannan000/unofficial-gmi-cloud-cli
>
> Unofficial, built by a creator who got tired of the console. Also: yes, I made Haaland do the Jack Sparrow dock walk. Because I could.

---

## 2. Show HN

**Title:**
`Show HN: A CLI + MCP server for GMI Studio's 300+ gen-media models`

**Body:**
> I kept using GMI Studio (Kling, Veo, Sora, Gemini Image, etc.) and kept rebuilding the same wrapper around its async job queue, so I turned it into a proper tool.
>
> `gmi generate -m kling-v3-image-to-video --image ./photo.heic -p "..." -o ./clips` does upload → submit → poll → download in one line. A few things I ended up caring about while building it:
>
> - **Cost pre-flight.** It validates the payload against each model's schema and prints the estimated cost before submitting. A malformed job fails locally for $0 instead of after you've paid. `--dry-run` previews without spending.
> - **The upload contract was undocumented-weird.** GMI's presigned PUT is signed for a literal `image/jpg` content type, and the request body wants `{"file_type": "jpg"}` (bare extension). Reverse-engineered and pinned with a test.
> - **Provider likeness filters differ a lot.** Kling accepts real/photorealistic faces; Seedance (BytePlus) rejects ANY photorealistic person — even AI-rendered ones. The README documents which model to use so you don't burn an evening finding out.
> - **It's also an MCP server**, so Claude Code / Cursor / Codex / etc. can drive it. `gmi mcp-config <client> --install`.
>
> Retries never double-submit a paid job (429 retries everywhere, 5xx only for reads). 39 tests, CI on ubuntu+macos × Node 22/24. Unofficial, MIT, bring your own key.
>
> As a stress test I produced a 3-scene short film (a real person scoring a World Cup goal, a pirate-harbor scene) end to end through the CLI in one evening for ~$12 including failed takes. Recipe's in the README: identity still (Gemini) → scene keyframes → Kling with start/end frames pinned → ffmpeg.
>
> Repo: https://github.com/yannan000/unofficial-gmi-cloud-cli
> npm: `npm install -g unofficial-gmi-cloud-cli`
>
> Happy to answer questions about the async-queue quirks or the keyframe pipeline.

---

## 3. GMI Discord

*(Lead with the useful gift — the model matrix — not the pitch. Community-first. Post in a #showcase / #community / #built-with-gmi channel.)*

> Hey all — I've been building a lot on GMI Studio and made an open-source CLI + MCP server to drive it from the terminal (and from Claude Code / Cursor / Codex). Sharing in case it's useful, plus a few things I learned the hard way that might save you credits:
>
> **Model likeness filters (the big one):**
> - `kling-v3-image-to-video` — accepts real/photorealistic faces, has `image_tail` for end-frame pinning. Best for character video.
> - `seedance-2-0-260128` — rejects ANY photorealistic person, even AI-rendered keyframes (`InputImageSensitiveContentDetected`). Great model, just not for human subjects.
> - Veo 3.1 / Sora 2 — strictest likeness filters.
>
> **Upload gotcha:** the presigned upload wants `{"file_type": "jpg"}` (bare extension, only jpeg/jpg/png/mp4/mp3/wav) and the PUT must send the literal signed content type (`image/jpg`). Took me a while.
>
> **The tool** (`gmi`): one command does upload → generate → poll → download, auto-converts any file format, and — the part I like most — prices every job before submitting so a bad payload fails for $0. It's also an MCP server for AI IDEs.
>
> `npm install -g unofficial-gmi-cloud-cli`
> https://github.com/yannan000/unofficial-gmi-cloud-cli
>
> ⚠️ It's **unofficial** — not affiliated with the GMI team, just a community tool. Bring your own key, I add zero markup. Feedback very welcome, and mods please pull this if it's not the right channel. 🙏
>
> (I also used it to make myself score a World Cup goal with a Messi assist for ~$12. The pipeline's in the README if you want to make your own.)
