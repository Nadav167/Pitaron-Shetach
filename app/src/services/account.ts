import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Account business logic: register, log in, log out and read the user's
 * profile, on top of Supabase Auth. Screens and contexts call these
 * functions; nothing outside this file talks to `supabase.auth` directly
 * (except AuthContext subscribing to session changes).
 *
 * Errors are thrown as AccountError with a stable `code` that the UI maps
 * to a translated message (`auth.error.<code>` in the i18n files), so no
 * raw English server message ever reaches a Hebrew screen.
 */

export type Profile = { firstName: string; lastName: string };

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type AccountErrorCode =
  | "notConfigured"
  | "missingFields"
  | "invalidEmail"
  | "weakPassword"
  | "emailTaken"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "rateLimited"
  | "network"
  | "unknown";

export class AccountError extends Error {
  code: AccountErrorCode;
  constructor(code: AccountErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AccountError";
    this.code = code;
  }
}

/** Supabase's own minimum (Auth settings → "Minimum password length"). */
export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function client() {
  if (!supabase) throw new AccountError("notConfigured");
  return supabase;
}

/**
 * Translates a Supabase Auth error into one of our codes. Supabase sends a
 * machine-readable `code` on newer versions; the message checks cover the
 * older wording of the same errors.
 */
function toAccountError(error: { message?: string; code?: string; status?: number }): AccountError {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered")) {
    return new AccountError("emailTaken", error.message);
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return new AccountError("invalidCredentials", error.message);
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return new AccountError("emailNotConfirmed", error.message);
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return new AccountError("weakPassword", error.message);
  }
  if (code === "email_address_invalid" || code === "validation_failed" || message.includes("invalid format")) {
    return new AccountError("invalidEmail", error.message);
  }
  if (code.startsWith("over_") || error.status === 429) {
    return new AccountError("rateLimited", error.message);
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return new AccountError("network", error.message);
  }
  return new AccountError("unknown", error.message);
}

/** Checks the register form before anything is sent. Throws AccountError. */
export function validateRegistration(input: RegisterInput): RegisterInput {
  const clean = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
  if (!clean.firstName || !clean.lastName || !clean.email || !clean.password) {
    throw new AccountError("missingFields");
  }
  if (!EMAIL_PATTERN.test(clean.email)) throw new AccountError("invalidEmail");
  if (clean.password.length < MIN_PASSWORD_LENGTH) throw new AccountError("weakPassword");
  return clean;
}

/**
 * Creates the account and signs the user in. The first/last name travel as
 * sign-up metadata, and a database trigger turns them into the user's
 * `profiles` row (see the 0003 migration).
 */
export async function register(input: RegisterInput): Promise<Session | null> {
  const clean = validateRegistration(input);
  const { data, error } = await client().auth.signUp({
    email: clean.email,
    password: clean.password,
    options: { data: { first_name: clean.firstName, last_name: clean.lastName } },
  });
  if (error) throw toAccountError(error);
  // With "Confirm email" turned off (as this project is set up), sign-up
  // returns a session straight away. If confirmation is ever turned on,
  // there is no session yet and the user must confirm first.
  if (!data.session) throw new AccountError("emailNotConfirmed");
  return data.session;
}

export async function logIn(email: string, password: string): Promise<Session> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) throw new AccountError("missingFields");
  const { data, error } = await client().auth.signInWithPassword({ email: cleanEmail, password });
  if (error) throw toAccountError(error);
  return data.session;
}

/**
 * Logs out. A normal sign-out also revokes the session on the server; if
 * that request fails (e.g. no connection), Supabase keeps the session, so
 * the fallback clears it on this device only. Pressing "Log out" must always
 * leave the device logged out.
 */
export async function logOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) await client().auth.signOut({ scope: "local" });
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client()
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw toAccountError(error);
  return data ? { firstName: data.first_name, lastName: data.last_name } : null;
}
