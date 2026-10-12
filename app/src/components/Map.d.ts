import type { ComponentType } from "react";
import type { Campsite } from "@/types/campsite";

/**
 * `@/components/Map` has no Map.tsx — Metro resolves it to Map.web.tsx on web
 * and Map.native.tsx on iOS/Android, via platform-specific extensions
 * (https://docs.expo.dev/router/advanced/platform-specific-modules/).
 *
 * TypeScript doesn't implement that resolution, so without this declaration
 * every import of the bare module is a TS2307 error even though the bundle is
 * fine. Declaring the shared contract here also keeps the two implementations
 * honest: both must satisfy these props.
 *
 * Metro ignores .d.ts files, so this affects typechecking only.
 */
declare const Map: ComponentType<{
  campsites: Campsite[];
  onSelectCampsite?: (campsite: Campsite) => void;
}>;

export default Map;
