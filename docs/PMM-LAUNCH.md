# Launch Plan — `gmi`: The Unofficial GMI Cloud CLI

**Version:** v1.0 launch · **Owner:** Yoofi Annan · **Status:** Draft for launch week

---

## 1. The One-Liner

> **Your terminal is now a film studio.**
> One command to any of GMI Studio's 300+ models — image, video, audio, and LLMs — with uploads, formats, polling, downloads, and cost checks handled for you.

---

## 2. Why This Exists (The Problem)

GMI Studio hosts the best generative models in one place — Kling, Veo, Sora, Seedance, Gemini Image, 300+ more. But *using* them at any real pace means fighting four kinds of friction:

| Friction | What it looks like today |
|----------|--------------------------|
| **Console click-work** | Every generation is a browser session: pick model, upload, configure, wait on a tab, download by hand. Fine for one image. Brutal for a 12-shot production. |
| **Raw API plumbing** | The REST API is an async job queue with quirks: presigned uploads that sign a literal `image/jpg` content type, jobs to poll, media URLs buried in nested JSON. Every developer rebuilds the same wrapper. |
| **Format walls** | The upload API accepts six file types. Creators live in HEIC (iPhone), WebP, MOV, and ProRes. |
| **Blind spend** | Submit a malformed payload or an over-spec video job and you find out after the money is gone — or after a 500 error with no explanation. |

The result: the people with the most creative demand — solo creators, small studios, agent builders — use Studio at a fraction of its potential throughput.

---

## 3. What We Built (The Answer)

`gmi` is an open-source (MIT) CLI **and** MCP server, one shared client:

- **One command per shot.** `gmi generate -m kling-v3-image-to-video --image ./keyframe.heic -p "..." -o ./clips` — upload, format conversion, submission, polling, and download in a single line.
- **Any file in.** HEIC off your iPhone, WebP, TIFF, MOV, FLAC — auto-converted to what the API accepts before upload. No pre-processing step.
- **Cost pre-flight.** Every job is validated against the model's schema and priced *before* submission. Missing required parameter → instant local error, $0 spent. `--dry-run` shows the exact payload and estimated cost.
- **Async tamed.** Live spinner with elapsed time; `Ctrl+C` prints the resume command instead of orphaning your job; `gmi requests --status failed` for triage; retries with backoff that *never* double-submit a paid job.
- **Agent-native.** The same binary is an MCP server: Claude Code (or any MCP client) gets `generate_media`, `upload_file`, `chat`, and friends. Your AI assistant can run your render pipeline.
- **Scriptable by design.** `-q` and `--json` on everything; clean stdout for pipes; `gmi doctor` for health checks in CI.

**Proof it works:** the launch demo — a three-scene World Cup short film (a real person's likeness via reference stills, playing alongside a Messi-style #10, plus a pirate-harbor epilogue) — was produced entirely through `gmi` in one evening for roughly **$12** in model spend, including all failed takes.

---

## 4. Positioning

> **For** creators and developer-creators who want production throughput from GMI Studio
> **who are** slowed down by console click-work or raw API plumbing,
> **`gmi`** is an open-source CLI + MCP server
> **that** turns the entire Studio catalog into one composable command —
> **unlike** the web console (manual, one-at-a-time) or hand-rolled API scripts (weeks of quirk-hunting),
> **`gmi`** ships with the quirks already solved: upload contracts, format conversion, async lifecycle, cost pre-flight, and per-provider content rules learned in real production.

### Positioning pillars

1. **Speed of thought, not speed of clicks.** A 12-shot storyboard is 12 lines in a shell script, running while you sleep.
2. **Never pay to find out you were wrong.** Schema validation and cost estimates run before a cent is spent; failed submissions cost $0.
3. **Your agent is your production assistant.** First-class MCP support means "Claude, render the next three scenes" is a real workflow, today.
4. **Institutional knowledge, included.** The README encodes what production taught us — e.g. Kling accepts human likenesses while Seedance's filter rejects any photorealistic person, real photo or AI-rendered. Hours of trial-and-error, pre-paid.

### What we are NOT

- Not an official GMI Cloud product (the name says so; the disclaimer is in the README).
- Not another model marketplace or wrapper-with-markup — bring your own GMI key; we add $0.
- Not a GUI. If the console serves you well, keep it. `gmi` is for when you outgrow it.

---

## 5. Audiences & Messages

| Persona | Who they are | Pain | Lead message |
|---------|--------------|------|--------------|
| **The Creator** | Solo video maker / meme-lord / social studio shipping daily | Console throughput; format walls; surprise spend | "Storyboard in stills, render in batches, download to `./clips` — one command per shot." |
| **The Builder** | Dev adding gen-media to a product or pipeline | Weeks of API wrapper work; retry/idempotency landmines | "The client you were about to write, already battle-tested — with the upload contract and retry semantics unit-tested." |
| **The Agent-Native** | Claude Code / MCP power user | Wants AI to *do* the work end to end | "Add one MCP server; your assistant can now see 305 models and run your whole render pipeline." |

---

## 6. Launch Motion

**Tier: community launch (open-source, $0 budget). Goal: credibility + first 100 real users.**

| # | Channel | Asset | Angle |
|---|---------|-------|-------|
| 1 | **X/Twitter thread** | The World Cup short + the one-evening receipts ($12, timestamps, commands) | "I made a World Cup film starring myself from my terminal. Here's the entire pipeline." |
| 2 | **Show HN** | Repo + honest engineering notes (upload-contract reverse-engineering, retry policy, person-filter matrix) | HN loves quirk-hunting write-ups more than product pitches. |
| 3 | **Product Hunt** | 45-sec screen capture: prompt → spinner → clip plays | "The terminal-to-film-studio pipeline." |
| 4 | **GMI community (Discord/forum)** | The provider-quirks matrix (Kling vs Seedance vs Veo on likenesses) | Genuinely useful reference; positions the CLI as the community's power tool. |
| 5 | **r/ClaudeAI, MCP directories** | MCP config snippet + agent demo | "Your agent can now render video." Submit to MCP server registries. |
| 6 | **Dev.to / personal blog** | "What building a CLI against a real gen-media API taught me" | SEO tail + the Builder persona. |

**Sequencing:** 4 → 2 → 1/5 same day → 3 → 6 within the week. Community goodwill first, then reach.

### Launch checklist (blockers before any of the above)

- [ ] Repo → public
- [ ] `NPM_TOKEN` secret added; v1.0.0 GitHub Release → auto-publish to npm
- [ ] README: 30-second quickstart GIF at the top
- [ ] Demo video exported in 16:9 + 9:16
- [ ] Disclaimer verified prominent ("unofficial, not affiliated with GMI Cloud")

---

## 7. Objections & Answers

| Objection | Answer |
|-----------|--------|
| "Why not just use the console?" | Use both. The console is great for exploring one model. `gmi` is for the day you have 12 shots and a deadline. |
| "Is this affiliated with GMI?" | No — unofficial, MIT-licensed, bring your own key. If GMI ships an official CLI, ours has still moved the ecosystem forward. |
| "Another wrapper that'll rot?" | 39-test suite pinning every real API behavior, CI on every push across two OSes and two Node versions, npm provenance on releases. It's maintained like infrastructure, not a gist. |
| "Can it handle real people / my face?" | Yes — with the right model. The docs tell you which providers accept human likenesses (Kling) and which never will (Seedance), so you don't burn an evening finding out. |

---

## 8. Success Metrics

| Horizon | Metric | Target |
|---------|--------|--------|
| Week 1 | GitHub stars / npm installs | 100 / 200 |
| Week 1 | Qualitative: unsolicited "this saved me time" posts | 3+ |
| Month 1 | Weekly npm downloads | 500 |
| Month 1 | MCP registry listings live | 2+ |
| Month 3 | Community contributions (issues w/ repro, PRs) | 10+ |
| Ongoing | CI green rate on main | 100% |

Counter-metric to watch: support burden. If issue volume outpaces stars, the quickstart is failing — fix docs before features.

---

## 9. The Story, In One Paragraph

*(for launch posts, adapt per channel)*

> Last night I wanted to see myself score in a World Cup final with Messi assisting. The web console would have meant forty uploads, tabs, and downloads. Instead: one CLI. Keyframes from Gemini, motion from Kling with start/end frames pinned, audio on, assembled with ffmpeg — about $12 all-in, including the takes that failed (which cost $0, because the CLI prices and validates every job before submitting). Then I made Erling Haaland do the Jack Sparrow dock walk, just because I could. The tool is open source. Your terminal is now a film studio.
