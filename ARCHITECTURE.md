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
- L3 vector index **not implemented yet**

Rust was in the ChatGPT long-term vision. We deferred it on purpose until the Hermes loop proves value.

---

## What we decided vs what shipped

| Decision | Status |
|---|---|
| Hermes motor, not full agent OS | Done (positioning + scope) |
| TypeScript MVP first | Done |
| CDP launch/attach | Done |
| Explicit plan execution | Done |
| Semantic state + diffs | Done |
| Selector engine (role/text/a11y) | Done |
| Recovery heuristics | Done |
| Experience memory with confidence | Done (SQLite) |
| Daemon API for Hermes | Done |
| Safety policy | Done |
| Planner boundary (plan once / execute many) | Done (builtin + injectable) |
| L1 session memory | Done |
| Telemetry basics | Done |
| Failure screenshots | Done |
| Resume failed run | Done |
| Computer-use fallback hook | Done (noop by default) |
| Vector similarity (L3) | Partial (signal soft-match scoring; no embeddings yet) |
| Site plugins | Not yet |
| Event bus | Not yet |
| Chrome extension bridge | Not yet (intentionally later) |
| Rust core / Python SDK | Not yet (intentionally later) |
| Full Hermes LLM planner adapter | Done (OpenAI-compatible via `BER_HERMES_API_BASE`) |
| Hermes tool bridge/client | Done (`hermes-call`, `HERMES_TOOLS`) |
| Computer-use fallback (vision+text) | Done (`VisionComputerUseFallback` cascade) |
| Experience replay benchmark | Done (`npm run bench:replay`) |

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
