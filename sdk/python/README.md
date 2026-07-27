# Python client

Open wrapper client for the browser runtime daemon. No API key required.

```bash
# from repo root, with daemon running
PYTHONPATH=sdk/python python - <<'PY'
from browser_execution_runtime import BrowserRuntimeClient

client = BrowserRuntimeClient()
print(client.health())
client.attach(start_url="https://example.com")
print(client.run({
  "goal": "open example",
  "steps": [{"action": {"type": "navigate", "url": "https://example.com"}}]
}))
PY
```

Or install locally:

```bash
pip install -e sdk/python
```
