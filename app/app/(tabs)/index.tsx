import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSites } from "@/hooks/useSites";
import { useLocale } from "@/context/LocaleContext";
import SiteList from "@/components/SiteList";
import Map from "@/components/Map";
import { colors, radius, spacing, typography } from "@/constants/theme";
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
        <Text style={styles.title}>{t("home.title")}</Text>
        <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
        {usingMockData && (
          <Text style={styles.mockBanner}>Showing sample data — connect EXPO_PUBLIC_API_URL for live sites.</Text>
        )}
        <View style={styles.toggleRow}>
          <ToggleButton label={t("home.listView")} active={mode === "list"} onPress={() => setMode("list")} />
          <ToggleButton label={t("home.mapView")} active={mode === "map"} onPress={() => setMode("map")} />
        </View>
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

function ToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, gap: spacing.xs },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  mockBanner: { ...typography.caption, color: colors.accent },
  toggleRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  toggle: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { ...typography.body, color: colors.text },
  toggleLabelActive: { color: colors.surface, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
