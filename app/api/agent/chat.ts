import { handleAgentChat } from "../../backend/controllers/agentChat";

/**
 * Vercel serverless function: POST /api/agent/chat.
 *
 * Routing only; see backend/controllers/agentChat.ts. Vercel deploys every
 * file under app/api/ as a function (the project's root directory is `app`).
 * Needs ANTHROPIC_API_KEY plus the EXPO_PUBLIC_SUPABASE_* variables in the
 * Vercel project's environment.
 */
export function POST(request: Request): Promise<Response> {
  return handleAgentChat(request);
}
