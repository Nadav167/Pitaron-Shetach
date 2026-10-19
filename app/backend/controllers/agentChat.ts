import Anthropic from "@anthropic-ai/sdk";
import type { AgentChatMessage, AgentChatResponse, AgentErrorCode } from "../../src/types/itinerary";
import { authenticate, consumeUsage, isSupabaseConfigured } from "../supabase";
import { runAgent } from "../agent/runAgent";

/**
 * POST /api/agent/chat: HTTP in, HTTP out. Checks who is asking, validates
 * the body and charges the daily allowance; the agent itself is in
 * agent/runAgent.ts. Written against the web-standard Request/Response so
 * the same function serves the Vercel route (api/agent/chat.ts) and the
 * local dev server (backend/devServer.ts).
 *
 * Body: { messages: AgentChatMessage[], locale: "he" | "en" }, the whole
 * conversation, oldest first, ending with the user's new message. The app
 * keeps the conversation; nothing is stored here except saved itineraries.
 */

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 4000;

function json(status: number, body: AgentChatResponse | { error: AgentErrorCode }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** The conversation from the request body, trimmed and checked, or null if malformed. */
function parseHistory(body: unknown): AgentChatMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const messages: AgentChatMessage[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    const { role, content } = (item ?? {}) as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return null;
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  // The API needs the conversation to start with the user (the trim above
  // can cut it mid-exchange) and the newest message must be the user's.
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export async function handleAgentChat(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY || !isSupabaseConfigured()) {
    return json(503, { error: "notConfigured" });
  }

  const user = await authenticate(request.headers.get("authorization"));
  if (!user) return json(401, { error: "unauthenticated" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "badRequest" });
  }
  const history = parseHistory(body);
  if (!history) return json(400, { error: "badRequest" });
  const locale = (body as { locale?: unknown }).locale === "en" ? "en" : "he";

  let messagesLeft: number;
  try {
    const left = await consumeUsage(user.db, "message");
    if (left === "dailyLimit" || left === "siteLimit") return json(429, { error: left });
    messagesLeft = left;
  } catch (error) {
    console.error("[agent] usage check failed", error);
    return json(500, { error: "agentFailed" });
  }

  try {
    const result = await runAgent(history, locale, user);
    return json(200, { reply: result.reply, itinerary: result.itinerary, messagesLeft });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      // 401: bad key; 429: rate limit; 400 with a credit message: the
      // monthly spend limit was reached. All are the owner's to fix.
      console.error(`[agent] Claude API error ${error.status}:`, error.message);
    } else {
      console.error("[agent] failed", error);
    }
    return json(502, { error: "agentFailed" });
  }
}
