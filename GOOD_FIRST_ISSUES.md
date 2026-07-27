# Good first issues (curated)

These tasks are sized for a first PR. Each should be doable in an evening without deep CDP knowledge. **Live trackers:** [issues labeled `good first issue`](https://github.com/shehrii9/browser-execution-runtime/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

Maintainers: when an issue below is opened on GitHub, link it here (replace “TBD” with `#NNN`).

| # | Task | Skills | Files |
|---|------|--------|-------|
| TBD | Add one news/blog domain to `content-sites` (e.g. `apnews.com`) and assert plugin match in a unit test | TypeScript | `src/plugins/contentSites.ts`, `tests/plugins.test.ts` |
| TBD | Add one video host to `media-sites` `MEDIA_SITE_DOMAINS` + domain match test | TypeScript | `src/plugins/mediaSites.ts`, `tests/media-sites.test.ts` |
| TBD | Add cookie-consent recovery variant (`"Allow all"`, `"OK"`, locale-specific label) | TypeScript | `src/plugins/cookieConsent.ts`, `tests/plugins.test.ts` |
| TBD | Document Python `events()` / SSE in `sdk/python/README.md` with a short example | Markdown, Python | `sdk/python/README.md` |
| TBD | Add agent integration one-pager (e.g. LangChain-style HTTP tools) | Markdown | `examples/integrations/` |
| TBD | Add Vitest case: `content-sites` `read_article` workflow shape unchanged | TypeScript | `tests/plugins.test.ts` or new file |
| TBD | Typo / clarity pass on [`INTEGRATING.md`](./INTEGRATING.md) for one integration path you use | Markdown | `INTEGRATING.md` |

**Already in repo (no issue needed):** [`examples/QUICK_DEMO.md`](./examples/QUICK_DEMO.md), `curl-demo.sh` `/diff` step, [`examples/integrations/ollama-demo.sh`](./examples/integrations/ollama-demo.sh).

## Claiming work

Comment on the GitHub issue: *“I’d like to work on this.”* No assignment bot — first PR wins unless the issue says otherwise.

## Not good first issues

- Rewriting the executor or planner contracts
- Binding the daemon to `0.0.0.0` without an auth design
- DRM / paywall circumvention
