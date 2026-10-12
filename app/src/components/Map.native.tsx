import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Callout, Marker, UrlTile } from "react-native-maps";
import { Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { localized } from "@/types/campsite";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { radius, spacing, type ColorTokens } from "@/constants/theme";

type Props = {
  campsites: Campsite[];
  onSelectCampsite?: (campsite: Campsite) => void;
};

/**
 * Native (iOS/Android) map. Uses react-native-maps with a raw OpenStreetMap
 * tile overlay (UrlTile) instead of Google/Apple tiles, so no API key is
 * required — mirrors the OSM tiles Map.web.tsx uses via Leaflet.
 *
 * OSM tile policy requires attribution and reasonable request volume; swap the
 * tile URL for a paid provider before shipping at scale.
 *
 * Markers use a custom colored-circle + tent-icon view instead of the
 * default teardrop `pinColor`, matching Map.web.tsx's pins (which also carry
 * a small tent glyph, not a plain circle).
 *
 * The callout carries the non-official warning but NOT the Waze/Google Maps
 * buttons: touches on individual controls inside a Callout don't propagate
 * reliably on Android (the whole callout is one tappable surface). Tapping it
 * opens the detail screen, where the navigation buttons live and work.
 */
export default function Map({ campsites, onSelectCampsite }: Props) {
  const { locale, t } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Sites with no verified coordinates can't be pinned; they remain in the list.
  const mappable = campsites.filter(
    (campsite): campsite is Campsite & { coordinates: { lat: number; lng: number } } =>
      campsite.coordinates !== null
  );

  const initialRegion = {
    latitude: mappable[0]?.coordinates.lat ?? 31.5,
    longitude: mappable[0]?.coordinates.lng ?? 34.8,
    latitudeDelta: 4,
    longitudeDelta: 4,
  };

  return (
    <MapView style={styles.map} initialRegion={initialRegion}>
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
      {mappable.map((campsite) => {
        const name = localized(campsite.name, locale);
        const price = campsite.pricing.isFree
          ? t("common.free")
          : campsite.pricing.perNight != null
          ? `₪${campsite.pricing.perNight}`
          : t("common.priceUnknown");
        // Official sites are pinned in forest green, non-official in amber,
        // matching the pin colours on web.
        const pinColor = campsite.isOfficial ? colors.primary : colors.accent;

        return (
          <Marker
            key={campsite.id}
            coordinate={{
              latitude: campsite.coordinates.lat,
              longitude: campsite.coordinates.lng,
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={[styles.pin, { backgroundColor: pinColor }]}>
              <MaterialCommunityIcons name="tent" size={16} color="#FFFFFF" />
            </View>
            <Callout tooltip={false} onPress={() => onSelectCampsite?.(campsite)}>
              <View style={styles.callout}>
                <Text variant="titleSmall" numberOfLines={2}>
                  {name}
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {`${t(`region.${campsite.region}`)} · ${price}`}
                </Text>

                {!campsite.isOfficial && (
                  <View style={styles.warning}>
                    <Text variant="labelSmall" style={styles.warningText}>
                      {`⚠️ ${t("site.unofficialWarning")}`}
                    </Text>
                  </View>
                )}

                <Text variant="labelSmall" style={styles.cta}>
                  {t("site.viewDetails")}
                </Text>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    map: { flex: 1 },
    pin: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    callout: { minWidth: 180, padding: spacing.sm, gap: spacing.xs },
    muted: { color: colors.textMuted },
    warning: {
      backgroundColor: colors.accentTint,
      borderColor: colors.accent,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
    },
    warningText: { color: colors.accentDeep },
    cta: { color: colors.primary, marginTop: spacing.xs },
  });
}
