import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import { Site } from "@/types/site";

type Props = {
  sites: Site[];
  onSelectSite?: (site: Site) => void;
};

/**
 * Native (iOS/Android) map. Uses react-native-maps with a raw OpenStreetMap
 * tile overlay (via UrlTile) instead of Google/Apple map tiles, so no API
 * key is required — mirrors the OSM tiles used by Map.web.tsx (Leaflet).
 *
 * OSM tile usage policy requires attribution and reasonable request volume;
 * swap the tile URL for a paid tile provider before shipping at scale.
 */
export default function Map({ sites, onSelectSite }: Props) {
  const initialRegion = {
    latitude: sites[0]?.coordinates.lat ?? 31.5,
    longitude: sites[0]?.coordinates.lng ?? 34.8,
    latitudeDelta: 4,
    longitudeDelta: 4,
  };

  return (
    <MapView style={styles.map} initialRegion={initialRegion}>
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
      {sites.map((site) => (
        <Marker
          key={site.id}
          coordinate={{ latitude: site.coordinates.lat, longitude: site.coordinates.lng }}
          title={site.translations.he.name}
          onPress={() => onSelectSite?.(site)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
