# MCP integration (Cursor, Claude Desktop, …)

Expose BER `browser_*` tools over the [Model Context Protocol](https://modelcontextprotocol.io) via **stdio**.

## Prerequisites

1. Start the BER daemon (in a terminal):

```bash
npm run daemon
# or: npm start
```

2. Confirm health:

```bash
curl -s http://127.0.0.1:8787/health
```

## Run the MCP server

From this repo (development):

```bash
npm run mcp
```

After `npm run build` / global install:

```bash
ber mcp
# or
npx browser-execution-runtime mcp
```

Environment:

| Variable | Meaning |
|----------|---------|
| `BER_URL` | Daemon URL (default `http://127.0.0.1:8787`) |

The MCP process talks **stdio only** — do not pipe logs to stdout.

## Cursor

Add to your project or user MCP config (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "browser-execution-runtime": {
      "command": "node",
      "args": ["/absolute/path/to/browser-execution-runtime/dist/mcp/stdio.js"],
      "env": {
        "BER_URL": "http://127.0.0.1:8787"
      }
    }
  }
}
```

For local dev without building:

```json
{
  "mcpServers": {
    "browser-execution-runtime": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/browser-execution-runtime/src/mcp/stdio.ts"],
      "env": {
        "BER_URL": "http://127.0.0.1:8787"
      }
    }
  }
}
```

## Tools exposed

Same as `npm run tools` / OpenAI bridge:

`browser_attach` · `browser_execute` · `browser_run_plan` · `browser_observe` · `browser_diff` · `browser_resume` · `browser_status` · `browser_tabs` · `browser_events`

Prefer these over computer-use / screenshots when automating browsers.
