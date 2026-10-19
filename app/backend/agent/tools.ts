import type Anthropic from "@anthropic-ai/sdk";
import type { ItineraryPlan } from "../../src/types/itinerary";
import { consumeUsage, insertItinerary, type UserContext } from "../supabase";
import { campsiteDetails } from "./campsites";
import { findNearbyPlaces, PLACE_CATEGORIES } from "./places";

/**
 * The agent's tools. All are "client" tools: Claude asks for a call, and
 * runAgent.ts executes it here and sends the result back.
 *
 * Every tool is `strict: true`, so the API guarantees the input matches the
 * schema (that needs `additionalProperties: false` and every property listed
 * in `required`; optional values are expressed as nullable instead).
 */

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

const ITEM_KINDS = ["drive", "hike", "activity", "meal", "camp", "shopping", "other"];

// Mirrors ItineraryPlan in src/types/itinerary.ts.
const itineraryPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "language", "startDate", "travelers", "preferences", "days", "packingList", "tips"],
  properties: {
    title: { type: "string", description: "Short trip title, e.g. 'סופ\"ש משפחתי בגליל העליון'." },
    summary: { type: "string", description: "2-3 sentences: the idea of the trip and who it suits." },
    language: { type: "string", enum: ["he", "en"], description: "Language the plan is written in." },
    startDate: { ...nullableString, description: "YYYY-MM-DD if the user gave dates, else null." },
    travelers: { type: "string", description: "Who is going, e.g. '2 adults, 2 kids (6, 9)'." },
    preferences: { type: "array", items: { type: "string" }, description: "Preferences the plan honors." },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayNumber", "date", "title", "campsiteId", "campsiteName", "items"],
        properties: {
          dayNumber: { type: "integer" },
          date: nullableString,
          title: { type: "string" },
          campsiteId: { ...nullableString, description: "Id from the campsite index where the group sleeps, or null." },
          campsiteName: nullableString,
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["time", "kind", "title", "description", "placeName", "distanceKm", "lat", "lng"],
              properties: {
                time: { type: "string", description: "'08:30' or a part of day ('בוקר' / 'Morning')." },
                kind: { type: "string", enum: ITEM_KINDS },
                title: { type: "string" },
                description: { type: "string", description: "1-3 practical sentences." },
                placeName: nullableString,
                distanceKm: { ...nullableNumber, description: "Distance from that night's campsite, from the tool result." },
                lat: nullableNumber,
                lng: nullableNumber,
              },
            },
          },
        },
      },
    },
    packingList: { type: "array", items: { type: "string" } },
    tips: { type: "array", items: { type: "string" }, description: "Safety, weather, booking and timing tips." },
  },
} as const;

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_campsite_details",
    description:
      "Full details of one campsite from the app's list: description, price and price notes, gate hours, confirmed amenities, contact info. Use before recommending a site or answering specific questions about it.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["campsite_id"],
      properties: { campsite_id: { type: "string", description: "Id from the campsite index." } },
    },
  },
  {
    name: "find_nearby_places",
    description:
      "Finds named places near one of the app's campsites, from OpenStreetMap: restaurants, cafes/bakeries, attractions, viewpoints, nature spots (springs, peaks, caves, waterfalls), beaches, museums, historic and archaeological sites, picnic sites, supermarkets, fuel stations, outdoor-gear shops. Returns up to 8 per category, nearest first, with straight-line distance in km from the campsite. Only works for campsites that have coordinates. No opening hours or kosher info: tell the user to check those.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["campsite_id", "categories", "max_km"],
      properties: {
        campsite_id: { type: "string", description: "Id from the campsite index." },
        categories: {
          type: "array",
          items: { type: "string", enum: [...PLACE_CATEGORIES] },
          description: "Which kinds of places to look for.",
        },
        max_km: { type: "number", description: "Furthest distance to include, 1-20 km. 10-15 is a good default." },
      },
    },
  },
  {
    name: "save_itinerary",
    description:
      "Saves the finished trip plan to the user's account, where it appears in their Itineraries tab and can be downloaded as a PDF. Call it once, when the plan is complete. The user can save at most 3 itineraries per day.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["plan"],
      properties: { plan: itineraryPlanSchema },
    } as unknown as Anthropic.Tool.InputSchema,
  },
];

export type ToolContext = UserContext & {
  /** Called when save_itinerary stores a plan, so the reply can link to it. */
  onItinerarySaved: (saved: { id: string; title: string }) => void;
};

type ToolOutcome = { content: string; isError?: boolean };

const asJson = (value: unknown): ToolOutcome => ({ content: JSON.stringify(value) });
const fail = (message: string): ToolOutcome => ({ content: message, isError: true });

export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const args = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "get_campsite_details": {
      const details = campsiteDetails(String(args.campsite_id));
      return details ? asJson(details) : fail(`No campsite with id "${String(args.campsite_id)}". Use an id from the index.`);
    }

    case "find_nearby_places": {
      const categories = Array.isArray(args.categories) ? args.categories.map(String) : [];
      const result = findNearbyPlaces(String(args.campsite_id), categories, Number(args.max_km) || 15);
      return result.ok ? asJson(result) : fail(result.error);
    }

    case "save_itinerary": {
      const plan = args.plan as ItineraryPlan | undefined;
      if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
        return fail("The plan needs at least one day.");
      }
      if (plan.days.length > 14) return fail("Plans are limited to 14 days.");
      const left = await consumeUsage(ctx.db, "itinerary");
      if (left === "dailyLimit" || left === "siteLimit") {
        return fail(
          "Not saved: the user has reached today's limit of 3 saved itineraries. Tell them, and offer to keep refining the plan in the chat; they can save it tomorrow."
        );
      }
      const id = await insertItinerary(ctx.db, ctx.userId, plan);
      ctx.onItinerarySaved({ id, title: plan.title });
      return asJson({ saved: true, id, itinerariesLeftToday: left });
    }

    default:
      return fail(`Unknown tool "${name}".`);
  }
}
