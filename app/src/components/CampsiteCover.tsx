import React, { useMemo } from "react";
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useThemeColors } from "@/context/ThemeContext";
import type { ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

type Props = {
  campsite: Campsite;
  /** Size and shape; applied to the photo and the generic cover alike. */
  style?: StyleProp<ViewStyle>;
};

/**
 * A campsite's cover photo, or, when it has no real photo, a generic
 * camping illustration in exactly the same box, so every card and page has
 * the same structure whether or not the source supplied a photo.
 *
 * Stock images the source captioned "illustration only" (`isPlaceholder`)
 * are never shown as if they documented the place; those sites get the
 * generic cover too. It is drawn from views and icons (no image file), so
 * it follows the light/dark theme.
 */
export default function CampsiteCover({ campsite, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const photo = campsite.photos.find((candidate) => !candidate.isPlaceholder);

  if (photo) {
    return <Image source={{ uri: photo.url }} style={[styles.box, style as StyleProp<ImageStyle>]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.box, styles.generic, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Two soft hills along the bottom, then pines and a tent on top. */}
      <View style={[styles.hill, styles.hillBack]} />
      <View style={[styles.hill, styles.hillFront]} />
      <View style={styles.scene}>
        <MaterialCommunityIcons name="pine-tree" size={34} color={colors.primaryLight} />
        <MaterialCommunityIcons name="tent" size={64} color={colors.primary} />
        <MaterialCommunityIcons name="pine-tree" size={44} color={colors.primaryLight} />
      </View>
      <MaterialCommunityIcons name="weather-night" size={22} color={colors.accent} style={styles.moon} />
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    box: { width: "100%", aspectRatio: 16 / 9 },
    generic: { backgroundColor: colors.primaryTint, overflow: "hidden", alignItems: "center" },
    // Rounded mounds whose vertical size and position are fractions of the
    // box's height, so the scene looks the same in a 16:9 card and in the
    // wider fixed-height banner on the site page.
    // Width follows height (aspectRatio), so they stay mounds, not bands.
    hill: { position: "absolute", height: "90%", borderRadius: 9999, backgroundColor: colors.primaryLight },
    hillBack: { aspectRatio: 1.5, top: "56%", left: "-4%", opacity: 0.2 },
    hillFront: { aspectRatio: 1.8, top: "66%", right: "-6%", opacity: 0.3 },
    // Absolute with no left/right: centered horizontally by alignItems.
    scene: { position: "absolute", bottom: "18%", flexDirection: "row", alignItems: "flex-end", gap: 6 },
    moon: { position: "absolute", top: "14%", right: "16%" },
  });
}
