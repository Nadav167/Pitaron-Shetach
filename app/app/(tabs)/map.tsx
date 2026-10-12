import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import Map from "@/components/Map";
import { spacing, type ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

/**
 * Dedicated Map tab — every site with a verified location, all at once.
 * Previously this was a list/map toggle bolted onto the Home tab; splitting
 * it into its own tab is what actually makes the map icon in the tab bar
 * mean "map" instead of "home, but sometimes a map."
 */
export default function MapScreen() {
  const { campsites, loading } = useCampsites();
  const { t } = useLocale();
  const colors = useThemeColors();
  const router = useRouter();

  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  // Sites without verified coordinates can't be pinned; say so rather than
  // silently showing fewer pins than the dataset actually has.
  const unmappable = campsites.filter((c) => !c.coordinates).length;

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <Map campsites={campsites} onSelectCampsite={openCampsite} />
          {unmappable > 0 && (
            <View style={styles.noteWrap} pointerEvents="none">
              <Text variant="labelSmall" style={styles.note}>
                {t("home.unmappableNote").replace("{count}", String(unmappable))}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    noteWrap: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      alignItems: "center",
    },
    note: {
      backgroundColor: colors.surface,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      overflow: "hidden",
    },
  });
}
