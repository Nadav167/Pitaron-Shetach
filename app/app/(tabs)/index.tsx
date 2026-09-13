import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, SegmentedButtons, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSites } from "@/hooks/useSites";
import { useLocale } from "@/context/LocaleContext";
import SiteList from "@/components/SiteList";
import Map from "@/components/Map";
import { colors, spacing } from "@/constants/theme";
import type { Site } from "@/types/site";

type ViewMode = "list" | "map";

export default function HomeScreen() {
  const { sites, loading, usingMockData } = useSites();
  const { t } = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("list");

  const openSite = (site: Site) => router.push(`/site/${site.id}`);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall">{t("home.title")}</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t("home.subtitle")}
        </Text>
        {usingMockData && (
          <Text variant="labelSmall" style={styles.mockBanner}>
            Showing sample data — connect EXPO_PUBLIC_API_URL for live sites.
          </Text>
        )}
        <SegmentedButtons
          style={styles.segmented}
          value={mode}
          onValueChange={(value) => setMode(value as ViewMode)}
          buttons={[
            { value: "list", label: t("home.listView"), icon: "format-list-bulleted" },
            { value: "map", label: t("home.mapView"), icon: "map-outline" },
          ]}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : mode === "list" ? (
        <SiteList sites={sites} onSelectSite={openSite} />
      ) : (
        <Map sites={sites} onSelectSite={openSite} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, gap: spacing.xs },
  subtitle: { color: colors.textMuted },
  mockBanner: { color: colors.accent },
  segmented: { marginTop: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
