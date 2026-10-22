import type { ComponentType } from "react";
import type { MapProps } from "@/types/map";

/**
 * `@/components/Map` has no Map.tsx — Metro resolves it to Map.web.tsx on web
 * and Map.native.tsx on iOS/Android, via platform-specific extensions
 * (https://docs.expo.dev/router/advanced/platform-specific-modules/).
 *
 * TypeScript doesn't implement that resolution, so without this declaration
 * every import of the bare module is a TS2307 error even though the bundle is
 * fine. Both implementations type their props as the same `MapProps`
 * (src/types/map.ts), which keeps them honest.
 *
 * Metro ignores .d.ts files, so this affects typechecking only.
 */
declare const Map: ComponentType<MapProps>;

export default Map;
