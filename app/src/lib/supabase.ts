import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The app's Supabase client, used for accounts (Supabase Auth) and each
 * user's saved favorites. Campsite data does NOT come from here; it ships
 * inside the app.
 *
 * It runs with the public "anon" key, which is safe to ship in an app:
 * what a signed-in user may read or change is enforced by the database's
 * Row Level Security policies (supabase/migrations/0003_...). The
 * service-role key must never be put here.
 *
 * Configured from app/.env (see .env.example). When the two variables are
 * missing, `supabase` is null and the account features hide themselves,
 * so the rest of the app keeps working without a backend.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // Keeps the user signed in across app restarts / page reloads.
          // AsyncStorage is backed by localStorage on web.
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          // There are no email-link sign-ins, so there is never a session
          // to pick up from the page URL.
          detectSessionInUrl: false,
        },
      })
    : null;

export const isAccountsEnabled = supabase !== null;
