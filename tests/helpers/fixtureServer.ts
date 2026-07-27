import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures");

export function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

export interface FixtureServer {
  baseUrl: string;
  url: (pathname: string) => string;
  close: () => Promise<void>;
}

/** Serves static HTML fixtures on 127.0.0.1 with path → file name mapping. */
export async function startFixtureServer(
  routes: Record<string, string>,
): Promise<FixtureServer> {
  const htmlByPath = new Map<string, string>();
  for (const [pathname, file] of Object.entries(routes)) {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    htmlByPath.set(path, readFixture(file));
  }

  const server: Server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0] || "/";
    const html = htmlByPath.get(path) ?? htmlByPath.get("/");
    if (!html) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("fixture server: no port"));
        return;
      }
      resolve(addr.port);
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    url: (pathname: string) => {
      const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
      return `${baseUrl}${path}`;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
