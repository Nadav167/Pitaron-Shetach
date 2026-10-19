import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import type { AgentChatMessage, AgentChatResponse, AgentErrorCode } from "@/types/itinerary";

/**
 * Talks to the travel agent (POST /api/agent/chat, a Vercel function; see
 * app/backend/). The request carries the signed-in user's Supabase access
 * token: the agent is for signed-in users only, and it saves itineraries
 * into their account with it.
 *
 * Where the endpoint lives:
 * - EXPO_PUBLIC_AGENT_API_URL when set (local dev: http://localhost:8787,
 *   served by `npm run agent:dev`);
 * - otherwise the website's own origin on web (Vercel serves the site and
 *   the functions together), and the live site from the native apps.
 */

const AGENT_API_URL =
  process.env.EXPO_PUBLIC_AGENT_API_URL ?? (Platform.OS === "web" ? "" : "https://pitaron-shetach.vercel.app");

export class AgentError extends Error {
  code: AgentErrorCode | "network";
  constructor(code: AgentErrorCode | "network") {
    super(code);
    this.name = "AgentError";
    this.code = code;
  }
}

export async function sendAgentMessage(
  messages: AgentChatMessage[],
  locale: "he" | "en"
): Promise<AgentChatResponse> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) throw new AgentError("unauthenticated");

  let res: Response;
  try {
    res = await fetch(`${AGENT_API_URL}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        // Earlier turns go back as plain text, without the agent's tool
        // calls, so it would otherwise doubt in later replies that it saved
        // anything. The server checks these ids and tells the agent.
        savedItineraryIds: messages.flatMap((message) => (message.itinerary ? [message.itinerary.id] : [])),
        locale,
      }),
    });
  } catch {
    throw new AgentError("network");
  }

  const body = (await res.json().catch(() => null)) as AgentChatResponse | { error?: AgentErrorCode } | null;
  if (!res.ok || !body || "error" in body) {
    const code = body && "error" in body && body.error ? body.error : "agentFailed";
    throw new AgentError(code);
  }
  return body as AgentChatResponse;
}
