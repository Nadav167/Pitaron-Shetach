import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Site } from "@/types/site";

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
