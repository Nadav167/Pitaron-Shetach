import Anthropic from "@anthropic-ai/sdk";
import type { AgentChatMessage } from "../../src/types/itinerary";
import type { UserContext } from "../supabase";
import { requestContext, STABLE_SYSTEM_PROMPT } from "./prompt";
import { AGENT_TOOLS, executeTool } from "./tools";

/**
 * One turn of the travel agent: the conversation so far in, Claude's reply
 * (and the itinerary it saved, if any) out.
 *
 * A manual tool-use loop: call Claude; if it asks for tools, run them (in
 * parallel) and send every result back in one user message; repeat until
 * it answers in text. The assistant content, thinking blocks included, is
 * appended unmodified each round, as the API requires.
 *
 * Model: Claude Haiku 5.5, chosen by the site owner for cost (roughly
 * $0.0005 per Q&A message and under $0.01 per planned trip). Adaptive
 * thinking is on by default; `effort: "medium"` keeps it modest.
 */

export const AGENT_MODEL = "claude-haiku-5-5";

/** Model calls per user message. A full itinerary needs about 3-6. */
const MAX_ROUNDS = 10;

export type AgentResult = {
  reply: string;
  itinerary: { id: string; title: string } | null;
};

let client: Anthropic | null = null;

/** Reads ANTHROPIC_API_KEY from the environment. */
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

const FALLBACK_REPLY = {
  he: "מצטער, לא הצלחתי לענות הפעם. אפשר לנסח את השאלה מחדש?",
  en: "Sorry, I couldn't answer that one. Could you rephrase?",
};

export async function runAgent(
  history: AgentChatMessage[],
  locale: "he" | "en",
  user: UserContext,
  /** Itineraries saved earlier in this conversation, confirmed in the database. */
  savedEarlier: { id: string; title: string }[] = []
): Promise<AgentResult> {
  let itinerary: AgentResult["itinerary"] = null;
  const toolContext = { ...user, onItinerarySaved: (saved: { id: string; title: string }) => (itinerary = saved) };

  // Earlier turns are sent as plain text: the app only keeps what was shown.
  const messages: Anthropic.MessageParam[] = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await anthropic().messages.create({
      model: AGENT_MODEL,
      max_tokens: 16000,
      system: [
        // Breakpoint here caches the tools + the stable prompt (render order
        // is tools -> system -> messages).
        { type: "text", text: STABLE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: requestContext(locale, new Date(), savedEarlier) },
      ],
      tools: AGENT_TOOLS,
      output_config: { effort: "medium" },
      messages,
    });

    logUsage(round, response);

    if (response.stop_reason === "refusal") {
      return { reply: FALLBACK_REPLY[locale], itinerary };
    }

    const toolUses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (response.stop_reason === "tool_use" && toolUses.length > 0) {
      messages.push({ role: "assistant", content: response.content });
      const results = await Promise.all(
        toolUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
          try {
            const outcome = await executeTool(use.name, use.input, toolContext);
            return { type: "tool_result", tool_use_id: use.id, content: outcome.content, is_error: outcome.isError };
          } catch (error) {
            console.error(`[agent] tool ${use.name} failed`, error);
            return { type: "tool_result", tool_use_id: use.id, content: "The tool failed unexpectedly.", is_error: true };
          }
        })
      );
      messages.push({ role: "user", content: results });
      continue;
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return { reply: text || FALLBACK_REPLY[locale], itinerary };
  }

  console.warn("[agent] stopped after", MAX_ROUNDS, "rounds");
  return { reply: FALLBACK_REPLY[locale], itinerary };
}

/** One log line per model call, for watching cost in the Vercel logs. */
function logUsage(round: number, response: Anthropic.Message) {
  const u = response.usage;
  console.log(
    `[agent] round=${round} stop=${response.stop_reason} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`
  );
}
