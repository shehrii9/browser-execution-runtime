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
**Not for L2 storage.** Experience memory stays in TypeScript + SQLite.

**Experimental:** `crates/ber-core` provides fingerprint + hashing embeddings + CLI. Set `BER_RUST_CORE=1` to prefer Rust fingerprints when `ber-core` is on `PATH`. The execution kernel remains TypeScript.

Current stack:
- **TypeScript** runtime
- **SQLite** via `better-sqlite3`
- L3 similarity via hashing embeddings (optional neural) stored beside experiences

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
| Site plugins | Done (cookie/auth/github/google/amazon/media-sites/content-sites) |
| Multi-tab | Done (new/switch/close tab actions + API) |
| Dynamic page settle (SPA/AJAX) | Done (`settlePage`, wait.settle, post navigate/click) |
| Infinite scroll waits | Done (`scroll` + `untilText` / `untilCss` / `untilCountAtLeast`) |
| Media-site handling | Done (generic plugin for video/audio hosts + watch/results hints) |
| Media actions | Done (`media` play/pause/mute/skip_ad/fullscreen for video+audio) |
| Content/article sites | Done (`content-sites` plugin + `article` page hint) |
| One-command startup | Done (`npm start`) |
| Event bus | Done (`EventBus`, `GET /events`, SSE `/events/stream`) |
| Chrome extension bridge | Done (attach-only debug extension) |
| Optional neural embeddings | Done (`NeuralEmbedder`, hash fallback) |
| Rust core | Scaffolded (`crates/ber-core`: fingerprint + hashing embed + CLI; TS still default) |
| Closed-shadow pierce | Done (CDP `DOM.getDocument` pierce during observe; disable with `BER_PIERCE_SHADOW=0`) |
| Publish automation | Done (tag-triggered Release workflow for npm/PyPI/`ber-core` artifact) |
| Python SDK | Done (HTTP client parity with daemon: diff/act/tabs/events/policy/…) |
| Full Hermes LLM planner adapter | Done as generic `LlmPlanner` (OpenAI-compatible, key optional) |
| Hermes tool bridge/client | Done as generic `ToolBridge` / `AGENT_TOOLS` |
| Computer-use fallback (vision+text) | Done (`VisionComputerUseFallback` cascade) |
| Experience replay benchmark | Done (`npm run bench:replay`) |
| Provider-agnostic / no required API key | Done |
| Plugin workflows wired into planner | Done (`run <workflow> on <domain>`, media open/search/ready_player) |
| Iframe-aware targets | Done (`frame` / `frameUrl` / `frameName` / `frameIndex`; observe walks frame tree) |
| CI | Done (GitHub Actions: typecheck, test, build, pack:check) |

---

## Dynamic pages, frames & media sites (current behavior)

**Dynamic / SPA pages**
- After `navigate` / `click`, runtime waits for a short DOM-stable window (`settlePage`).
- Plans can use `{ "type": "wait", "settle": true }` or `networkIdle: true`.
- Observe walks **open shadow roots** and includes headings/video/audio nodes.
- Observe also evaluates **every Playwright frame** (cross-origin child frames included when CDP allows).
- Expect failures get one settle + recovery retry (not instant fail).
- Targets can scope into iframes via `frame` / `frameUrl` / `frameName` / `frameIndex`.
- Prefer role/name targets: Playwright a11y locators often reach into shadow UI better than CSS.
- Closed shadow: observe merges CDP-pierced interactive nodes (`shadow_pierced` signal). Still imperfect for canvas-only UIs.
- Still no MutationObserver push stream.

**Dialogs & modals (DOM + native)**

Two layers:

| Layer | Examples | Runtime behavior |
|-------|----------|------------------|
| **Native JS** | `alert`, `confirm`, `prompt`, `beforeunload` | `autoDismissDialogs` (default on). `confirm` on pay/delete/logout text is **dismissed** unless `autoDismissNativeConfirm: true`. OTP-style `prompt` uses `dialogPromptDefault` or dismiss. |
| **DOM modals** | Cookie CMP, login, OTP, checkout, newsletter | `observe` emits `modal:<kind>` signals: `cookie`, `login`, `otp`, `payment`, `newsletter`, `critical`, `generic`. |

Recovery policy:

- **Auto-dismiss safe modals** — cookie, newsletter, generic marketing (`dismiss_overlays`).
- **Protected modals** — login, OTP, payment, `alertdialog`: recovery **does not** click Accept/Close; classifies `auth_required` / `otp_required` / `payment_confirm` so the **agent** must `type` credentials, OTP, or explicit confirm steps.
- **Popups** — `window.open` / `_blank`: `autoFocusPopupTabs` (default on) switches the active tab.

**Rust core (experimental)**
- Crate: `crates/ber-core` — fingerprint + hashing embeddings + `ber-core` CLI
- TypeScript remains the execution kernel; set `BER_RUST_CORE=1` to try Rust fingerprints when the binary is on `PATH`
- CI runs `cargo test -p ber-core`

**Media sites (video/audio)**
- `media-sites` plugin covers common hosts (YouTube, Vimeo, Twitch, Dailymotion, Rumble, SoundCloud, Spotify web, TikTok, …).
- Shared patterns: consent, skip-ad/skip-intro, player wait, feed scroll, search.
- Page hints: `watch`, `results`, `shorts`, `media_home`, `media_site`.
- Signals: `media_site`, `video_player`, `audio_player`, `skip_ad`.
- Actions: `{ "type": "media", "command": "play"|"pause"|"skip_ad"|… }` operate on the largest visible `<video>`/`<audio>`.
- Limits: no DRM scrubbing, closed shadow / canvas-only controls may stay invisible; login walls need the user/agent.
- YouTube was only the first example host — not the product scope.

**Content / article sites**
- `content-sites` plugin: BBC, CNN, NYTimes, Guardian, Reuters, Wikipedia, Medium, Substack, …
- Workflows: `read_article`, `dismiss_chrome`
- Page hint: `article`

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

---

## Help wanted

Contributor-friendly work (see [`GOOD_FIRST_ISSUES.md`](./GOOD_FIRST_ISSUES.md) and [`ROADMAP.md`](./ROADMAP.md)):

- **Site plugins** — add domains and recovery button variants (`src/plugins/`)
- **Dynamic SPAs** — push-style DOM change hints (today: settle + re-observe; no MutationObserver stream yet)
- **Iframe / closed shadow** — more tests and observe edge cases (`tests/content-frames.test.ts`, `BER_PIERCE_SHADOW`)
- **Integrations** — agent-specific examples under `examples/integrations/`
- **Python SDK docs** — parity examples for events/SSE (`sdk/python/README.md`)
- **Rust core** — optional fingerprint/embed improvements in `crates/ber-core/` (TS kernel stays default)

