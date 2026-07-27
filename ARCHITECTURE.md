# Architecture status

## Direct answers

### Is everything saved in JSON?
**No.**

| What | Format |
|---|---|
| Experience memory (L2) | **SQLite** DB at `data/experiences.db` |
| Fix steps inside each experience | JSON **text column** inside SQLite (`fix_json`) |
| Plans over HTTP/CLI | JSON request/files (transport format) |
| Failure screenshots | PNG files under `data/screenshots/` |
| Session cache (L1) | In-memory only |

We are **not** dumping full DOM/HTML/chat history into JSON files.

### Is memory implemented in Rust?
**No.**

Current stack:
- **TypeScript** runtime
- **SQLite** via `better-sqlite3`
- L3 similarity via hashing embeddings (optional neural) stored beside experiences

Rust was in the ChatGPT long-term vision. We deferred it on purpose until the agent loop proves value.

---

## What we decided vs what shipped

| Decision | Status |
|---|---|
| Hermes motor, not full agent OS | Done → generalized to any-agent open wrapper |
| TypeScript MVP first | Done |
| CDP launch/attach | Done |
| Explicit plan execution | Done |
| Semantic state + diffs | Done |
| Selector engine (role/text/a11y) | Done |
| Recovery heuristics | Done |
| Experience memory with confidence | Done (SQLite) |
| Daemon API for Hermes | Done → generic agent daemon (Hermes optional) |
| Safety policy | Done |
| Planner boundary (plan once / execute many) | Done (builtin + injectable) |
| L1 session memory | Done |
| Telemetry basics | Done |
| Failure screenshots | Done |
| Resume failed run | Done |
| Computer-use fallback hook | Done (noop by default; vision/LLM when configured) |
| Vector similarity (L3) | Done (local hashing embeddings + cosine in SQLite) |
| Site plugins | Done (cookie/auth/github/google/amazon/media-sites) |
| Multi-tab | Done (new/switch/close tab actions + API) |
| Dynamic page settle (SPA/AJAX) | Done (`settlePage`, wait.settle, post navigate/click) |
| Infinite scroll waits | Done (`scroll` + `untilText` / `untilCss` / `untilCountAtLeast`) |
| Media-site handling | Done (generic plugin for video/audio hosts + watch/results hints) |
| Media actions | Done (`media` play/pause/mute/skip_ad/fullscreen for video+audio) |
| One-command startup | Done (`npm start`) |
| Event bus | Done (`EventBus`, `GET /events`, SSE `/events/stream`) |
| Chrome extension bridge | Done (attach-only debug extension) |
| Optional neural embeddings | Done (`NeuralEmbedder`, hash fallback) |
| Rust core | Not yet (intentionally later) |
| Python SDK | Done (HTTP client parity with daemon: diff/act/tabs/events/policy/…) |
| Full Hermes LLM planner adapter | Done as generic `LlmPlanner` (OpenAI-compatible, key optional) |
| Hermes tool bridge/client | Done as generic `ToolBridge` / `AGENT_TOOLS` |
| Computer-use fallback (vision+text) | Done (`VisionComputerUseFallback` cascade) |
| Experience replay benchmark | Done (`npm run bench:replay`) |
| Provider-agnostic / no required API key | Done |
| Plugin workflows wired into planner | Done (`run <workflow> on <domain>`, media open/search/ready_player) |
| Iframe-aware targets | Done (`target.frame` / `target.frameUrl` + same-origin observe) |

---

## Dynamic pages & media sites (current behavior)

**Dynamic / SPA pages**
- After `navigate` / `click`, runtime waits for a short DOM-stable window (`settlePage`).
- Plans can use `{ "type": "wait", "settle": true }` or `networkIdle: true`.
- Observe walks **open shadow roots** and includes headings/video/audio nodes.
- Expect failures get one settle + recovery retry (not instant fail).
- Targets can scope into iframes via `frame` / `frameUrl`.
- Same-origin iframe contents are included in observe when reachable.
- Still no MutationObserver stream / closed-shadow piercing / cross-origin iframe DOM.

**Media sites (video/audio)**
- `media-sites` plugin covers common hosts (YouTube, Vimeo, Twitch, Dailymotion, Rumble, SoundCloud, Spotify web, TikTok, …).
- Shared patterns: consent, skip-ad/skip-intro, player wait, feed scroll, search.
- Page hints: `watch`, `results`, `shorts`, `media_home`, `media_site`.
- Signals: `media_site`, `video_player`, `audio_player`, `skip_ad`.
- Actions: `{ "type": "media", "command": "play"|"pause"|"skip_ad"|… }` operate on the largest visible `<video>`/`<audio>`.
- Limits: no DRM scrubbing, closed shadow / canvas-only controls may stay invisible; login walls need the user/agent.
- YouTube was only the first example host — not the product scope.

---

## Is the ChatGPT architecture useful?

**Yes — as a roadmap and vocabulary. No — as the thing we should fully build before proving Hermes token savings.**

Useful from ChatGPT:
- Layering: Planner / Executor / Experience Engine
- Runtime owns memory; model does not live in the browser
- Experience records instead of chat memory
- CDP daemon angle (not extension-as-brain)
- Recovery before calling the LLM again

Defer / treat as later:
- Rust rewrite
- Full crate monorepo
- Plugin marketplace
- Vector DB from day one
- Distributed/enterprise phases
- “OS for all browser agents” branding before personal Hermes wins

---

## Current module map

```text
Hermes / caller
    ↓
Runtime API (daemon/CLI)
    ├── Planner Engine        src/planner
    ├── Session Memory (L1)   src/memory
    ├── Experience Store (L2) src/experience (SQLite)
    ├── Plan Runner/Scheduler src/executor
    ├── Action Executor       src/executor/actions.ts
    ├── State Engine          src/state
    ├── Selector Engine       src/selectors
    ├── Recovery Engine       src/recovery
    ├── Telemetry             src/telemetry
    └── Browser Session/CDP   src/browser
            ↓
         Chromium
```
