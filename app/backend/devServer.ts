import http from "node:http";
import path from "node:path";

/**
 * Local stand-in for the Vercel functions in app/api/, for development:
 *
 *   npm run agent:dev            (from the repo root; port 8787)
 *
 * and in app/.env:  EXPO_PUBLIC_AGENT_API_URL=http://localhost:8787
 *
 * It loads app/.env (ANTHROPIC_API_KEY + the Supabase keys), then serves
 * the same handlers Vercel does. CORS is open here only: on Vercel the
 * website and the functions share one origin, and native apps don't do CORS.
 */

const PORT = Number(process.env.AGENT_DEV_PORT ?? 8787);

try {
  process.loadEnvFile(path.resolve(__dirname, "../.env"));
} catch {
  console.warn("[dev] app/.env not found; using the shell environment only");
}

// Required after the env is loaded.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleAgentChat } = require("./controllers/agentChat") as typeof import("./controllers/agentChat");

const routes: Record<string, (request: Request) => Promise<Response>> = {
  "POST /api/agent/chat": handleAgentChat,
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  const handler = routes[`${req.method} ${pathname}`];
  if (!handler) {
    res.writeHead(404, CORS_HEADERS).end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });

  const started = Date.now();
  const response = await handler(request);
  res.writeHead(response.status, { ...Object.fromEntries(response.headers), ...CORS_HEADERS });
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(`[dev] ${req.method} ${pathname} -> ${response.status} (${Date.now() - started} ms)`);
});

server.listen(PORT, () => console.log(`[dev] agent API on http://localhost:${PORT}`));
