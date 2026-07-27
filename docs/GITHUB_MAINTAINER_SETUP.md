# GitHub settings checklist (maintainer)

The cloud agent token cannot change some repository settings (403). Run these locally with `gh` or in the GitHub UI.

## Repository About

- **Description:** Open provider-agnostic browser execution runtime for AI agents — plan once, execute many, no API key required.
- **Website:** `https://github.com/shehrii9/browser-execution-runtime#readme`
- **Topics:** `browser-automation`, `ai-agents`, `cdp`, `playwright`, `openai-tools`, `chromium`, `mit-license`, `cursor`, `ollama`

```bash
gh repo edit shehrii9/browser-execution-runtime \
  --description "Open provider-agnostic browser execution runtime for AI agents — plan once, execute many, no API key required." \
  --enable-discussions \
  --add-topic browser-automation --add-topic ai-agents --add-topic cdp \
  --add-topic playwright --add-topic openai-tools --add-topic chromium
```

## Discussions

1. Enable **Discussions** (command above or Settings → General).
2. Create categories: **Announcements**, **Q&A**, **Ideas**, **Show and tell**.
3. Pin a post from [`DISCUSSIONS_FAQ.md`](./DISCUSSIONS_FAQ.md).

## Labels

```bash
gh label create "good first issue" --color 7057ff --description "Good for newcomers"
```

Then label issues [#29](https://github.com/shehrii9/browser-execution-runtime/issues/29)–[#35](https://github.com/shehrii9/browser-execution-runtime/issues/35).

## npm badge

After first publish to npm, the README npm shield will show a version. See [`PUBLISHING.md`](../PUBLISHING.md).

## Outreach

Copy from [`CONTRIBUTOR_CALL.md`](./CONTRIBUTOR_CALL.md) when posting to HN, Reddit, or social.
