import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";
import { defaultPersistentProfileDir } from "../browser/profiles.js";
import { BrowserRuntime } from "../runtime.js";
import { ActionSchema, PlanSchema, PolicySchema } from "../types.js";

const AttachBodySchema = z.object({
  cdpUrl: z.string().optional(),
  userDataDir: z.string().optional(),
  profile: z.enum(["ephemeral", "persistent"]).optional(),
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
      // Allow local debug extension / web tools to call the daemon.
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type");
      if ((req.method ?? "GET") === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      const path = url.pathname;
      const method = req.method ?? "GET";

      if (method === "GET" && path === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (method === "GET" && path === "/extension/info") {
        return sendJson(res, 200, {
          role: "debug-bridge-target",
          message:
            "Extension is attach-only. AI/memory/execution stay in the runtime daemon.",
          attach: "POST /attach",
          cdpHint:
            "Start Chrome with --remote-debugging-port=9222 and pass cdpUrl http://127.0.0.1:9222",
          plugins: runtime.listPlugins(),
        });
      }

      if (method === "GET" && path === "/status") {
        return sendJson(res, 200, await runtime.status());
      }

      if (method === "GET" && path === "/tabs") {
        return sendJson(res, 200, { tabs: await runtime.listTabs() });
      }

      if (method === "GET" && path === "/plugins") {
        return sendJson(res, 200, { plugins: runtime.listPlugins() });
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

      if (method === "GET" && path === "/events") {
        const afterId = url.searchParams.get("afterId");
        const limit = url.searchParams.get("limit");
        const type = url.searchParams.get("type") ?? undefined;
        return sendJson(res, 200, {
          events: runtime.listEvents({
            afterId: afterId ? Number(afterId) : undefined,
            limit: limit ? Number(limit) : undefined,
            type: type ?? undefined,
          }),
        });
      }

      if (method === "GET" && path === "/events/stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });
        res.write(`: ber-events\n\n`);
        const unsubscribe = runtime.events.on((event) => {
          res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
        });
        const heartbeat = setInterval(() => {
          res.write(`: ping\n\n`);
        }, 15000);
        req.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return;
      }

      if (method === "POST" && path === "/attach") {
        const body = AttachBodySchema.parse(await readJson(req));
        const userDataDir =
          body.userDataDir ??
          (body.profile === "persistent" ? defaultPersistentProfileDir() : undefined);
        const state = await runtime.attach({
          cdpUrl: body.cdpUrl,
          userDataDir,
          headless: body.headless,
          startUrl: body.startUrl,
        });
        return sendJson(res, 200, { ok: true, state });
      }

      if (method === "POST" && path === "/act") {
        const body = z.object({ action: ActionSchema }).parse(await readJson(req));
        const result = await runtime.act(body.action);
        return sendJson(res, 200, result);
      }

      if (method === "POST" && path === "/tabs/new") {
        const body = z.object({ url: z.string().url().optional() }).parse(await readJson(req));
        const tab = await runtime.newTab(body.url);
        return sendJson(res, 200, { tab, tabs: await runtime.listTabs() });
      }

      if (method === "POST" && path === "/tabs/switch") {
        const body = z.object({ index: z.number().int().nonnegative() }).parse(await readJson(req));
        const tab = await runtime.switchTab(body.index);
        return sendJson(res, 200, { tab, tabs: await runtime.listTabs() });
      }

      if (method === "POST" && path === "/tabs/close") {
        const body = z
          .object({ index: z.number().int().nonnegative().optional() })
          .parse(await readJson(req));
        const tabs = await runtime.closeTab(body.index);
        return sendJson(res, 200, { tabs });
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
        const saved = await runtime.remember(body);
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
