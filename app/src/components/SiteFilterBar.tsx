import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import SearchBar from "@/components/SearchBar";
import FilterChip from "@/components/FilterChip";
import FilterSheet from "@/components/FilterSheet";
import { RADIUS_OPTIONS_KM, type SiteFilters, type SourceFilter } from "@/hooks/useSiteFilters";
import { localized } from "@/types/campsite";
import { fonts, spacing, type ColorTokens } from "@/constants/theme";
import { PIN_GLYPH } from "@/constants/map";

// Official sites are the Nature and Parks Authority's night PARKING grounds;
// non-official sites are the community CAMPING directory — that's the
// distinction people actually search by, so the filter chips are labeled
// that way rather than "official/non-official". No icon for "all"; the
// others use the same glyphs as their map pins (a moon for night parking, a
// tent for camping).
const FILTER_ICON: Record<SourceFilter, string | undefined> = {
  all: undefined,
  official: PIN_GLYPH.official,
  unofficial: PIN_GLYPH.unofficial,
};

const FILTER_ORDER: SourceFilter[] = ["all", "unofficial", "official"];

type Props = {
  filters: SiteFilters;
  /** Desktop hero treatment: a width-capped search bar with centered chips. */
  centered?: boolean;
  /** Laid over the map: no background of its own, stronger shadows. */
  floating?: boolean;
};

/**
 * Search bar (whose button opens the filter sheet) above the quick-filter
 * chips: the kind of site, plus "free". Once the search names a town, a
 * radius scale appears under them.
 *
 * On phones the chips are one horizontally scrolling row rather than a
 * wrapping block: in English they wrapped onto a second line, and every
 * extra line pushes the first result further down the screen.
 */
export default function SiteFilterBar({ filters, centered = false, floating = false }: Props) {
  const { t, locale, writingDirection } = useLocale();
  const colors = useThemeColors();
  const themed = useMemo(() => makeThemedStyles(colors), [colors]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const chips = (
    <>
      {FILTER_ORDER.map((filter) => (
        <FilterChip
          key={filter}
          label={t(`home.filter.${filter}`)}
          icon={FILTER_ICON[filter]}
          selected={filters.sourceFilter === filter}
          onPress={() => filters.setSourceFilter(filter)}
          floating={floating}
        />
      ))}
      <FilterChip
        label={t("common.free")}
        icon="cash-remove"
        selected={filters.freeOnly}
        onPress={() => filters.setFreeOnly(!filters.freeOnly)}
        floating={floating}
      />
    </>
  );

  return (
    <View style={centered ? styles.centered : undefined}>
      <View style={[styles.searchWrap, centered && styles.searchWrapCentered]}>
        <SearchBar
          value={filters.query}
          onChangeText={filters.setQuery}
          onOpenFilters={() => setSheetVisible(true)}
          activeFilterCount={filters.sheetFilterCount}
          floating={floating}
        />
      </View>
      {centered ? (
        <View style={[styles.chipRow, styles.chipRowCentered]}>{chips}</View>
      ) : (
        // Bleeds to the screen edges (negative margin, padding back in) so
        // a chip scrolls off the edge instead of being cut at the gutter.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {chips}
        </ScrollView>
      )}

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
                floating={floating}
              />
            ))}
          </View>
        </View>
      )}

      <FilterSheet filters={filters} visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { width: "100%", alignItems: "center" },
  searchWrap: { marginBottom: spacing.sm + 4 },
  searchWrapCentered: { width: "100%", maxWidth: 560 },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chipRowCentered: { justifyContent: "center" },
  chipScroll: { marginHorizontal: -spacing.md, flexGrow: 0 },
  // Vertical padding leaves room for the floating chips' shadows.
  chipScrollContent: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 2 },
  radius: { marginTop: spacing.md, gap: spacing.sm },
  radiusCentered: { alignItems: "center" },
});

function makeThemedStyles(colors: ColorTokens) {
  return StyleSheet.create({
    radiusLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  });
}
