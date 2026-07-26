import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import { BrowserRuntime } from "../runtime.js";
import { ActionSchema, PlanSchema, PolicySchema } from "../types.js";

const AttachBodySchema = z.object({
  cdpUrl: z.string().optional(),
  userDataDir: z.string().optional(),
  headless: z.boolean().optional(),
  startUrl: z.string().url().optional(),
});

export interface DaemonOptions {
  host?: string;
  port?: number;
  runtime: BrowserRuntime;
}

export function startDaemon(options: DaemonOptions): Server {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const runtime = options.runtime;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      const path = url.pathname;
      const method = req.method ?? "GET";

      if (method === "GET" && path === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (method === "GET" && path === "/status") {
        return sendJson(res, 200, runtime.status());
      }

      if (method === "GET" && path === "/observe") {
        const state = await runtime.observe();
        return sendJson(res, 200, state);
      }

      if (method === "GET" && path === "/diff") {
        const result = await runtime.diff();
        return sendJson(res, 200, result);
      }

      if (method === "GET" && path === "/experiences") {
        return sendJson(res, 200, { experiences: runtime.listExperiences() });
      }

      if (method === "GET" && path === "/metrics") {
        return sendJson(res, 200, runtime.metricsSnapshot());
      }

      if (method === "POST" && path === "/attach") {
        const body = AttachBodySchema.parse(await readJson(req));
        const state = await runtime.attach(body);
        return sendJson(res, 200, { ok: true, state });
      }

      if (method === "POST" && path === "/act") {
        const body = z.object({ action: ActionSchema }).parse(await readJson(req));
        const result = await runtime.act(body.action);
        return sendJson(res, 200, result);
      }

      if (method === "POST" && path === "/run") {
        const body = z
          .object({
            plan: PlanSchema,
            resumeFromStep: z.number().int().nonnegative().optional(),
          })
          .parse(await readJson(req));
        const result = await runtime.run(body.plan, {
          resumeFromStep: body.resumeFromStep,
        });
        return sendJson(res, 200, result);
      }

      if (method === "POST" && path === "/resume") {
        const result = await runtime.resume();
        return sendJson(res, 200, result);
      }

      if (method === "POST" && path === "/execute") {
        const body = z.object({ intent: z.string().min(1) }).parse(await readJson(req));
        const result = await runtime.execute(body.intent);
        return sendJson(res, 200, result);
      }

      if (method === "POST" && path === "/policy") {
        const body = PolicySchema.partial().parse(await readJson(req));
        const policy = runtime.setPolicy(body);
        return sendJson(res, 200, { policy });
      }

      if (method === "POST" && path === "/remember") {
        const body = z
          .object({
            site: z.string(),
            goal: z.string(),
            stateHash: z.string(),
            problem: z.string(),
            fix: z.array(ActionSchema),
          })
          .parse(await readJson(req));
        const saved = runtime.remember(body);
        return sendJson(res, 200, { experience: saved });
      }

      if (method === "POST" && path === "/close") {
        await runtime.close();
        sendJson(res, 200, { ok: true });
        server.close();
        return;
      }

      return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return sendJson(res, 400, { error: message });
    }
  });

  server.listen(port, host, () => {
    console.log(`browser-execution-runtime daemon listening on http://${host}:${port}`);
  });

  return server;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
