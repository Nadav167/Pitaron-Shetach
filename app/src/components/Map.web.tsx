import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Site } from "@/types/site";

/**
 * Leaflet's CSS ships its default marker icons as relative `url(images/...)`
 * references (see node_modules/leaflet/dist/leaflet.css) and normally
 * auto-detects that "images/" folder by reading a background-image style
 * off a hidden element. Metro doesn't process url() references inside CSS
 * the way a bundler like webpack does, so the CSS-relative PNGs 404 and the
 * auto-detection resolves to a broken path, leaving markers with no icon.
 *
 * First attempt was `require`-ing the PNGs as JS assets and handing Metro's
 * result straight to Leaflet — that still didn't work, because outside of
 * React Native's own <Image> component, Metro's web asset pipeline doesn't
 * reliably hand back a plain string URL the way it does for native (it can
 * be a registered-asset descriptor instead), and Leaflet needs a literal
 * URL string.
 *
 * Fix that actually works everywhere: point Leaflet at the same marker
 * PNGs hosted on a CDN instead of trying to get Metro to serve local
 * node_modules assets at all. Sidesteps bundler asset resolution entirely
 * (the browser just fetches the image directly), which is why this is the
 * standard workaround for this exact issue across bundlers, not just
 * Metro. Delete Leaflet's CSS-based path-detection method and hand it
 * these URLs via `mergeOptions` instead — has to run once, before any
 * <Marker> mounts, so it lives at module scope rather than inside the
 * component. Background: https://github.com/Leaflet/Leaflet/issues/4968
 */
const LEAFLET_CDN = "https://unpkg.com/leaflet@1.9.4/dist/images";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${LEAFLET_CDN}/marker-icon-2x.png`,
  iconUrl: `${LEAFLET_CDN}/marker-icon.png`,
  shadowUrl: `${LEAFLET_CDN}/marker-shadow.png`,
});

type Props = {
  sites: Site[];
  onSelectSite?: (site: Site) => void;
};

/**
 * Web map, rendered only on react-native-web (Metro resolves `Map.web.tsx`
 * for web builds and `Map.native.tsx` for iOS/Android — see
 * https://docs.expo.dev/router/advanced/platform-specific-modules/).
 * Uses Leaflet + the public OpenStreetMap tile server.
 */
export default function Map({ sites, onSelectSite }: Props) {
  const center: [number, number] = sites[0]
    ? [sites[0].coordinates.lat, sites[0].coordinates.lng]
    : [31.5, 34.8];

  return (
    <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sites.map((site) => (
        <Marker
          key={site.id}
          position={[site.coordinates.lat, site.coordinates.lng]}
          eventHandlers={{ click: () => onSelectSite?.(site) }}
        >
          <Popup>{site.translations.he.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
