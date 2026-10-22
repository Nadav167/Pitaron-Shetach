import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import HoverTip from "@/components/HoverTip";
import { FAVORITE_PIN_COLOR } from "@/constants/map";
import { TOUCH_TARGET } from "@/constants/theme";

type Props = {
  campsiteId: string;
  /**
   * `overlay`: a white heart on a dark disc, for laying over a photo.
   * `plain`: a heart in the theme's colours, for a light background.
   */
  variant?: "overlay" | "plain";
  style?: StyleProp<ViewStyle>;
};

/**
 * The heart toggle on cards and the map's site card. The visible disc is
 * 34px, but the pressable area around it is a full 44px, the smallest
 * comfortable touch target. (`hitSlop` would do the same on native, but
 * react-native-web ignores it.)
 */
export default function FavoriteButton({ campsiteId, variant = "overlay", style }: Props) {
  const { t } = useLocale();
  const colors = useThemeColors();
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(campsiteId);
  const label = favorite ? t("site.removeFromFavorites") : t("site.addToFavorites");

  const heartColor = variant === "overlay" ? "#FFFFFF" : favorite ? FAVORITE_PIN_COLOR : colors.textMuted;

  return (
    <View style={style}>
      {/* The bubble opens toward the card's inside rather than past its
          (clipping) left edge. */}
      <HoverTip label={label} align="left">
        <Pressable
          style={styles.hitArea}
          onPress={() => toggleFavorite(campsiteId)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: favorite }}
        >
          <View style={[styles.disc, variant === "overlay" ? styles.discOverlay : { backgroundColor: colors.surfaceAlt }]}>
            <MaterialCommunityIcons name={favorite ? "heart" : "heart-outline"} size={18} color={heartColor} />
          </View>
        </Pressable>
      </HoverTip>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  disc: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  discOverlay: { backgroundColor: "rgba(17,24,20,0.45)" },
});
