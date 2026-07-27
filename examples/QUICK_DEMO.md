# 60-second demo (terminal)

No API key. Requires Node 20+, npm, and network for `example.com`.

## 1. Install and start

```bash
git clone https://github.com/shehrii9/browser-execution-runtime.git
cd browser-execution-runtime
npm install
npm start
```

Leave that terminal running (`http://127.0.0.1:8787`).

## 2. Health check

```bash
curl -s http://127.0.0.1:8787/health
```

## 3. Run a plan (no LLM)

```bash
npm run dev -- run-plan examples/sample-plan.json
```

## 4. Curl integration (daemon API)

```bash
bash examples/integrations/curl-demo.sh
```

## 5. See semantic state

With the browser still attached from step 4:

```bash
curl -s http://127.0.0.1:8787/observe | head -c 600
echo
curl -s http://127.0.0.1:8787/diff | head -c 400
echo
```

## 6. Agent tools (schemas only)

```bash
npm run tools -- examples/agent-tools.json | head -n 40
```

## Optional: headed browser on a desktop

```bash
BER_HEADLESS=0 npm run daemon
```

## Next steps

- Wire your agent: [`INTEGRATING.md`](../INTEGRATING.md)
- Why not screenshot-every-step: [`docs/COMPARISON.md`](../docs/COMPARISON.md)
- Contribute: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
