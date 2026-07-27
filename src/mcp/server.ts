import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDefaultBridge } from "../agent/bridge.js";
import { AGENT_TOOLS, type AgentToolName } from "../agent/tools.js";
import { openAiParametersToZodShape, type OpenAiToolParameters } from "./schema.js";

const SERVER_VERSION = "0.2.1";

export interface BerMcpServerOptions {
  /** BER daemon base URL (default BER_URL or http://127.0.0.1:8787). */
  baseUrl?: string;
}

/**
 * MCP server exposing `browser_*` tools over stdio.
 * Requires the BER HTTP daemon (`npm run daemon` / `npm start`).
 */
export function createBerMcpServer(options: BerMcpServerOptions = {}): McpServer {
  const bridge = createDefaultBridge(options.baseUrl);
  const server = new McpServer({
    name: "browser-execution-runtime",
    version: SERVER_VERSION,
  });

  for (const tool of AGENT_TOOLS) {
    const { name, description, parameters } = tool.function;
    const inputSchema = openAiParametersToZodShape(parameters as OpenAiToolParameters);

    server.registerTool(
      name,
      {
        description,
        inputSchema,
      },
      async (args) => {
        try {
          const result = await bridge.handle({
            name: name as AgentToolName,
            arguments: (args ?? {}) as Record<string, unknown>,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            isError: true,
            content: [{ type: "text", text: message }],
          };
        }
      },
    );
  }

  return server;
}

/** Run MCP over stdio (for Cursor, Claude Desktop, etc.). Do not write to stdout. */
export async function runBerMcpStdio(options: BerMcpServerOptions = {}): Promise<void> {
  const server = createBerMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
