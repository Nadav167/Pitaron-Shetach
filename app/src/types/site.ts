/**
 * @deprecated Use `@/types/campsite` instead.
 *
 * The model was unified in the campsite-data work: official (parks.org.il)
 * and non-official (gocamping.co.il) sites now share one `Campsite` shape
 * with an `isOfficial` flag, rather than the old single-source `Site`.
 *
 * This module stays as a re-export so any straggling `@/types/site` import
 * keeps compiling. Delete it once nothing references it.
 */

export * from "./campsite";
export type { Campsite as Site } from "./campsite";
