import { Site } from "@/types/site";

/**
 * Placeholder data so screens render something meaningful before the
 * backend/database has real content. `useSites` falls back to this list
 * whenever EXPO_PUBLIC_API_URL is unset or the request fails, purely so
 * the skeleton is demoable out of the box — remove once the API is live.
 */
export const mockSites: Site[] = [
  {
    id: "mock-1",
    translations: {
      he: { name: "חניון לילה - עין גדי", description: "חניון לילה שקט ליד שמורת עין גדי, נוף למדבר יהודה." },
      en: { name: "Ein Gedi Night Parking", description: "Quiet overnight parking near the Ein Gedi reserve, Judean Desert views." },
    },
    region: "Dead Sea",
    coordinates: { lat: 31.4618, lng: 35.3822 },
    address: "Route 90, Ein Gedi",
    pricePerNight: 0,
    currency: "ILS",
    openingHours: { note: "Open year-round" },
    amenities: {
      water: false,
      electricity: false,
      toilets: true,
      shower: false,
      shade: false,
      picnicTables: true,
      wasteDisposal: true,
      fourByFourRequired: false,
      cellReception: true,
    },
    photos: [],
    contact: {},
    rating: 4.3,
    source: "seed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-2",
    translations: {
      he: { name: "קמפינג יער יתיר", description: "אתר קמפינג מאורגן ביער יתיר עם שירותים ומקלחות." },
      en: { name: "Yatir Forest Campsite", description: "Organized campground in Yatir Forest with toilets and showers." },
    },
    region: "Negev",
    coordinates: { lat: 31.3752, lng: 35.0361 },
    address: "Yatir Forest",
    pricePerNight: 60,
    currency: "ILS",
    openingHours: { note: "Sun–Thu 08:00–20:00, Fri 08:00–14:00" },
    amenities: {
      water: true,
      electricity: false,
      toilets: true,
      shower: true,
      shade: true,
      picnicTables: true,
      wasteDisposal: true,
      fourByFourRequired: false,
      cellReception: true,
    },
    photos: [],
    contact: { phone: "+972-8-000-0000" },
    rating: 4.6,
    source: "seed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-3",
    translations: {
      he: { name: "חניון לילה - רמת הגולן", description: "חניון פתוח בגולן, מתאים לרכבי שטח." },
      en: { name: "Golan Heights Overlook Parking", description: "Open overnight parking on the Golan, best with a 4x4." },
    },
    region: "Golan",
    coordinates: { lat: 32.9317, lng: 35.7431 },
    pricePerNight: null,
    currency: "ILS",
    openingHours: { note: "Weather-dependent, check road conditions" },
    amenities: {
      water: false,
      electricity: false,
      toilets: false,
      shower: false,
      shade: false,
      picnicTables: false,
      wasteDisposal: false,
      fourByFourRequired: true,
      cellReception: false,
    },
    photos: [],
    contact: {},
    source: "seed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
