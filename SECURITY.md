# Security policy

## Supported versions

Security fixes are applied on the latest release on the `main` branch. Older tags may not receive patches unless noted in a release.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report sensitive issues through one of:

1. **GitHub Private Security Advisory** — [Open a private report](https://github.com/shehrii9/browser-execution-runtime/security/advisories/new) (preferred).
2. **Email** — Contact the maintainer listed in [`package.json`](./package.json) if you cannot use GitHub advisories.

Include:

- Description of the issue and impact
- Steps to reproduce
- Affected versions or commits
- Suggested fix (if any)

We aim to acknowledge reports within a few business days and will coordinate disclosure timing with you.

## Threat model notes

This runtime controls a local Chromium instance via CDP and exposes a **local HTTP daemon** (default `127.0.0.1:8787`). Treat exposed ports, domain allowlists (`BER_DOMAINS`), and purchase-blocking policy as part of your deployment security. Do not bind the daemon to `0.0.0.0` on untrusted networks without additional auth and network controls.
