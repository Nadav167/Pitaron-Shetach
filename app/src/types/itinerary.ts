/**
 * A trip planned by the travel agent, as stored in the `itineraries` table
 * (supabase/migrations/0004_travel_agent.sql) and shown on the Itineraries
 * tab and in the PDF.
 *
 * The agent fills `ItineraryPlan` through its save_itinerary tool, whose
 * JSON schema (app/backend/agent/tools.ts) mirrors these types field for
 * field. Change both together.
 *
 * Shared by the app and the serverless agent, so this file must stay free of
 * React Native imports.
 */

export type ItineraryItemKind = "drive" | "hike" | "activity" | "meal" | "camp" | "shopping" | "other";

export type ItineraryItem = {
  /** Clock time ("08:30") or a part of the day ("בוקר" / "Morning"). */
  time: string;
  kind: ItineraryItemKind;
  title: string;
  description: string;
  /** Name of the place, when the stop is a specific place. */
  placeName: string | null;
  /** Straight-line km from that day's campsite, when known. */
  distanceKm: number | null;
  lat: number | null;
  lng: number | null;
};

export type ItineraryDay = {
  dayNumber: number;
  /** ISO date (YYYY-MM-DD) when the user gave dates, else null. */
  date: string | null;
  title: string;
  /** Id from the app's campsite list (assets/data/campsites.json), if the night is at one. */
  campsiteId: string | null;
  campsiteName: string | null;
  items: ItineraryItem[];
};

export type ItineraryPlan = {
  title: string;
  summary: string;
  /** Language the plan is written in. */
  language: "he" | "en";
  startDate: string | null;
  /** Who is going, in the user's words ("2 adults and 3 kids"). */
  travelers: string;
  /** Preferences the plan was built around ("easy hikes", "kosher food"). */
  preferences: string[];
  days: ItineraryDay[];
  packingList: string[];
  tips: string[];
};

export type Itinerary = {
  id: string;
  title: string;
  plan: ItineraryPlan;
  createdAt: string;
};

/** One chat bubble, as the app keeps and sends the conversation. */
export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Set on the assistant message that saved an itinerary. */
  itinerary?: { id: string; title: string };
};

/** POST /api/agent/chat request body. */
export type AgentChatRequest = {
  messages: AgentChatMessage[];
  locale: "he" | "en";
  /** Itineraries the agent saved earlier in this conversation (verified server-side). */
  savedItineraryIds?: string[];
};

/** POST /api/agent/chat success body. */
export type AgentChatResponse = {
  reply: string;
  itinerary: { id: string; title: string } | null;
  /** Agent messages the user has left today, after this one. */
  messagesLeft: number;
};

/** Error codes the agent endpoint returns (`{ error: code }`). */
export type AgentErrorCode =
  | "unauthenticated"
  | "badRequest"
  | "dailyLimit"
  | "siteLimit"
  | "notConfigured"
  | "agentFailed";
