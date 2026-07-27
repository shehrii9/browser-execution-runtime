#!/usr/bin/env node
/**
 * BER MCP server (stdio). Start the daemon separately: npm run daemon
 */
import { runBerMcpStdio } from "./server.js";

const baseUrl = process.env.BER_URL;

runBerMcpStdio({ baseUrl }).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
