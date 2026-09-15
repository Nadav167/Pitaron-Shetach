import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Chip, SegmentedButtons, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useLocale } from "@/context/LocaleContext";
import SiteList from "@/components/SiteList";
import Map from "@/components/Map";
import { colors, spacing } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

type ViewMode = "list" | "map";
type SourceFilter = "all" | "official" | "unofficial";

export default function HomeScreen() {
  const { campsites, loading } = useCampsites();
  const { t } = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("list");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  const visible = useMemo(() => {
    if (sourceFilter === "official") return campsites.filter((c) => c.isOfficial);
    if (sourceFilter === "unofficial") return campsites.filter((c) => !c.isOfficial);
    return campsites;
  }, [campsites, sourceFilter]);

  // Sites without verified coordinates are listed but can't be pinned; saying
  // so is better than silently showing fewer pins than list rows.
  const unmappable = visible.filter((c) => !c.coordinates).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall">{t("home.title")}</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t("home.subtitle")}
        </Text>

        <View style={styles.filterRow}>
          {(["all", "official", "unofficial"] as SourceFilter[]).map((filter) => (
            <Chip
              key={filter}
              compact
              selected={sourceFilter === filter}
              showSelectedOverlay
              onPress={() => setSourceFilter(filter)}
              style={styles.filterChip}
            >
              {t(`home.filter.${filter}`)}
            </Chip>
          ))}
        </View>

        <SegmentedButtons
          style={styles.segmented}
          value={mode}
          onValueChange={(value) => setMode(value as ViewMode)}
          buttons={[
            { value: "list", label: t("home.listView"), icon: "format-list-bulleted" },
            { value: "map", label: t("home.mapView"), icon: "map-outline" },
          ]}
        />

        {mode === "map" && unmappable > 0 && (
          <Text variant="labelSmall" style={styles.note}>
            {t("home.unmappableNote").replace("{count}", String(unmappable))}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : mode === "list" ? (
        <SiteList campsites={visible} onSelectCampsite={openCampsite} />
      ) : (
        <Map campsites={visible} onSelectCampsite={openCampsite} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, gap: spacing.xs },
  subtitle: { color: colors.textMuted },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  filterChip: {},
  segmented: { marginTop: spacing.sm },
  note: { color: colors.textMuted, marginTop: spacing.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
