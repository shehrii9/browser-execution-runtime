# Roadmap

This is a living priority list — not a promise calendar. For shipped vs in-progress detail, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Now (maintainer focus)

- Keep the execution kernel stable: plans, observe/diff, recovery, daemon API
- Expand **site plugins** and recovery playbooks for real-world consent/login/media flows
- CI coverage for browser smoke, plugins, and Python client parity

## Next (great for contributors)

| Theme | Goal | Entry points |
|-------|------|----------------|
| **Dynamic pages** | Cheaper context when SPAs mutate without full re-observe | `src/state/`, architecture notes on MutationObserver-style signaling |
| **More hosts** | Add domains + recovery fixes to existing plugins | `src/plugins/mediaSites.ts`, `contentSites.ts`, `cookieConsent.ts` |
| **Iframe / shadow** | Harden edge cases beyond current CDP pierce | `src/browser/`, `tests/content-frames.test.ts`, `BER_PIERCE_SHADOW` |
| **Integrations** | Copy-paste bridges for more agents and frameworks | `examples/integrations/` |
| **Python SDK** | Docs + thin helpers matching daemon routes | `sdk/python/` |
| **Rust core** | Optional fingerprint/embed path; TS remains kernel | `crates/ber-core/` |

## Later (explicitly deferred)

- Full Rust rewrite of the runtime
- Plugin marketplace / distribution
- Hosted vector DB as a requirement
- Enterprise multi-tenant daemon auth (local `127.0.0.1` default stays the safe baseline)

## How to propose changes

1. Check [`GOOD_FIRST_ISSUES.md`](./GOOD_FIRST_ISSUES.md) and [open issues](https://github.com/shehrii9/browser-execution-runtime/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
2. Open a feature issue or Discussion for anything larger than a single PR.
3. Follow [`CONTRIBUTING.md`](./CONTRIBUTING.md).
