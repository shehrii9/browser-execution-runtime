# Python client

Open wrapper client for the browser runtime daemon. No API key required.

Covers the daemon HTTP API: attach, observe, diff, act, run, execute, resume,
tabs, events, policy, remember, metrics, experiences, plugins, close.

```bash
# from repo root, with daemon running (`npm start`)
PYTHONPATH=sdk/python python - <<'PY'
from browser_execution_runtime import BrowserRuntimeClient

client = BrowserRuntimeClient()
print(client.health())
client.attach(start_url="https://example.com")
print(client.observe()["title"])
print(client.diff()["diff"])
print(client.events(limit=10))
print(client.run({
  "goal": "open example",
  "steps": [{"action": {"type": "navigate", "url": "https://example.com"}}]
}))
print(client.call_tool("browser_events", {"limit": 5}))
PY
```

Or install locally:

```bash
pip install -e sdk/python
```
