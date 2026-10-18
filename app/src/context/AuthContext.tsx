import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { isAccountsEnabled, supabase } from "@/lib/supabase";
import * as account from "@/services/account";
import type { Profile, RegisterInput } from "@/services/account";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  /** False when the app was built without Supabase keys: hide account UI. */
  enabled: boolean;
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  register: (input: RegisterInput) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Who is signed in. Supabase keeps the session itself (persisted, and its
 * access token refreshed automatically); this context mirrors it into React
 * state and loads the user's profile (first/last name) to go with it.
 *
 * The actual account operations live in services/account.ts.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isAccountsEnabled ? "loading" : "signedOut");
  const [profile, setProfile] = useState<Profile | null>(null);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;
    // INITIAL_SESSION fires first with the session restored from storage
    // (or null), then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED as they
    // happen. Supabase warns against awaiting other Supabase calls inside
    // this callback, so the profile is loaded by the effect below instead.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? "signedIn" : "signedOut");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Native apps are suspended in the background, where the refresh timer
  // can't run; Supabase's guidance is to pause and resume it with the app.
  useEffect(() => {
    if (!supabase || Platform.OS === "web") return;
    const client = supabase;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  // Profile for the signed-in user. Until it arrives (or if the row is
  // somehow missing) the names sent at sign-up, kept on the auth user as
  // metadata, stand in, so the welcome message never flickers empty.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const meta = session?.user.user_metadata ?? {};
    if (typeof meta.first_name === "string") {
      setProfile({ firstName: meta.first_name, lastName: typeof meta.last_name === "string" ? meta.last_name : "" });
    }
    let cancelled = false;
    account
      .fetchProfile(userId)
      .then((loaded) => {
        if (!cancelled && loaded) setProfile(loaded);
      })
      .catch(() => {
        // Keep the metadata fallback; the profile is only cosmetic here.
      });
    return () => {
      cancelled = true;
    };
    // Re-run per user, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const register = useCallback(async (input: RegisterInput) => {
    await account.register(input);
  }, []);

  const logIn = useCallback(async (email: string, password: string) => {
    await account.logIn(email, password);
  }, []);

  const logOut = useCallback(async () => {
    await account.logOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled: isAccountsEnabled,
      status,
      userId,
      email: session?.user.email ?? null,
      profile,
      register,
      logIn,
      logOut,
    }),
    [status, userId, session?.user.email, profile, register, logIn, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
