# BER Debug Bridge (Chrome extension)

Attach-only debug helper for `browser-execution-runtime`.

**No AI model lives in this extension.** It only talks to your local daemon.

## Load unpacked

1. Start the daemon: `npm run daemon`
2. Open Chrome → `chrome://extensions`
3. Enable Developer mode
4. Load unpacked → select this `extension/` folder

## What it does

- Ping daemon health
- Show current tab URL/title
- Ask the runtime to attach/navigate to the current tab URL
- Remind you how to use real CDP attach (`--remote-debugging-port=9222`)

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
