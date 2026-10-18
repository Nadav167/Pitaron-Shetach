import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import SearchBar from "@/components/SearchBar";
import FilterChip from "@/components/FilterChip";
import { RADIUS_OPTIONS_KM, type SiteFilters, type SourceFilter } from "@/hooks/useSiteFilters";
import { localized } from "@/types/campsite";
import { fonts, spacing, type ColorTokens } from "@/constants/theme";

// Official sites are the Nature and Parks Authority's night PARKING grounds;
// non-official sites are the community CAMPING directory — that's the
// distinction people actually search by, so the filter chips are labeled
// that way rather than "official/non-official". No icon for "all", a pin for
// parking, a tent for camping.
const FILTER_ICON: Record<SourceFilter, string | undefined> = {
  all: undefined,
  official: "map-marker",
  unofficial: "tent",
};

const FILTER_ORDER: SourceFilter[] = ["all", "unofficial", "official"];

type Props = {
  filters: SiteFilters;
  /** Desktop hero treatment: a width-capped search bar with centered chips. */
  centered?: boolean;
};

/**
 * Search bar (with its sort menu) above the source filter chips. Once the
 * search names a town, a radius scale appears under them.
 */
export default function SiteFilterBar({ filters, centered = false }: Props) {
  const { t, locale, writingDirection } = useLocale();
  const colors = useThemeColors();
  const themed = useMemo(() => makeThemedStyles(colors), [colors]);

  return (
    <View style={centered ? styles.centered : undefined}>
      <View style={[styles.searchWrap, centered && styles.searchWrapCentered]}>
        <SearchBar
          value={filters.query}
          onChangeText={filters.setQuery}
          sortMode={filters.sortMode}
          onSortModeChange={filters.setSortMode}
        />
      </View>
      <View style={[styles.chipRow, centered && styles.chipRowCentered]}>
        {FILTER_ORDER.map((filter) => (
          <FilterChip
            key={filter}
            label={t(`home.filter.${filter}`)}
            icon={FILTER_ICON[filter]}
            selected={filters.sourceFilter === filter}
            onPress={() => filters.setSourceFilter(filter)}
          />
        ))}
      </View>

      {filters.city && (
        <View style={[styles.radius, centered && styles.radiusCentered]}>
          <Text style={[themed.radiusLabel, { writingDirection, textAlign: centered ? "center" : "right" }]}>
            {t("home.radius.label").replace("{city}", localized(filters.city.name, locale))}
          </Text>
          <View style={[styles.chipRow, centered && styles.chipRowCentered]}>
            {RADIUS_OPTIONS_KM.map((km) => (
              <FilterChip
                key={km}
                label={t("home.radius.km").replace("{km}", String(km))}
                selected={filters.radiusKm === km}
                onPress={() => filters.setRadiusKm(km)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { width: "100%", alignItems: "center" },
  searchWrap: { marginBottom: spacing.md },
  searchWrapCentered: { width: "100%", maxWidth: 560 },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chipRowCentered: { justifyContent: "center" },
  radius: { marginTop: spacing.md, gap: spacing.sm },
  radiusCentered: { alignItems: "center" },
});

function makeThemedStyles(colors: ColorTokens) {
  return StyleSheet.create({
    radiusLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  });
}
