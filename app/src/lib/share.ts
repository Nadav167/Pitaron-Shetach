import { Platform, Share } from "react-native";
import type { Campsite } from "@/types/campsite";

/** The public site; native builds have no page address of their own. */
const SITE_ORIGIN = "https://pitaron-shetach.vercel.app";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * Shares a campsite's page link: the system share sheet where there is one
 * (iOS, Android, phone browsers), else, on desktop browsers without
 * `navigator.share`, copies the link so the caller can say "link copied".
 */
export async function shareCampsite(campsite: Campsite, name: string): Promise<ShareResult> {
  const origin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN;
  const url = `${origin}/site/${campsite.id}`;

  if (Platform.OS !== "web") {
    try {
      // iOS shows `url` as a link preview; Android only shares `message`.
      const result = await Share.share({ message: `${name}\n${url}`, url, title: name });
      return result.action === Share.dismissedAction ? "cancelled" : "shared";
    } catch {
      return "failed";
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: name, url });
      return "shared";
    } catch (error) {
      // Closing the share sheet rejects with AbortError: not a failure.
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // Some browsers refuse outside a secure context; fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
