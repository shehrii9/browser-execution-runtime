# BER Debug Bridge (Chrome extension)

Attach-only debug helper for `browser-execution-runtime`.

**No AI model lives in this extension.** It only talks to your local daemon.

## Load unpacked

1. Start the daemon: `npm run daemon`
2. Open Chrome → `chrome://extensions`
3. Enable Developer mode
4. Load unpacked → select this `extension/` folder

## What it does

- **Health / status** — ping daemon and show memory/plugin info
- **Attach** — `POST /attach` with the active tab URL (persistent profile)
- **Observe** — semantic state from `GET /observe` (signals, page hint, buttons)
- **Diff** — `GET /diff` since last observe
- **Events** — recent runtime bus events (`step_*`, `recovery`, `dom_change`, …)
- **Dismiss overlays** — `POST /act` with `dismiss_overlays` (cookie/newsletter safe path)
- **Modal signal chips** — highlights `modal:*`, cookie, login, OTP, payment signals
- **Keyboard shortcut** — `Ctrl+Shift+Y` / `Cmd+Shift+Y` runs daemon observe on the active tab (badge shows modal count)

## What it does not do

- Does not run an LLM
- Does not store experience memory
- Does not replace the runtime

For full control of an already-open Chrome profile:

```bash
google-chrome --remote-debugging-port=9222
# then
curl -X POST http://127.0.0.1:8787/attach \
  -H 'content-type: application/json' \
  -d '{"cdpUrl":"http://127.0.0.1:9222"}'
```

## Typical flow

1. `npm run daemon`
2. Open the page you are debugging
3. Extension → **Attach to this tab URL**
4. **Observe** / **Diff** / **Events** as you interact
5. Use **Dismiss overlays** for CMP popups (login/OTP still need the agent)
