import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, type ColorTokens } from "@/constants/theme";

/** Room the bubble may take; long labels wrap inside it. */
const LAYER_WIDTH = 240;

type Props = {
  label: string;
  /**
   * Which edge of the wrapped control the bubble lines up with. A control
   * sitting against the left edge of the screen (or of a clipping card)
   * needs "left" so the bubble grows inward instead of being cut off.
   */
  align?: "left" | "center" | "right";
  children: React.ReactNode;
};

/**
 * Small hover label shown directly under the control it wraps (web only —
 * there is no hover on a touch screen, where the control's accessibility
 * label does the same job).
 *
 * Replaces react-native-paper's <Tooltip>, which measures its anchor in
 * left-to-right page coordinates and so, in this app's right-to-left layout,
 * drew the bubble on the opposite side of the window. This one is positioned
 * purely with CSS relative to the control, so there is nothing to measure
 * and nothing to mirror.
 */
export default function HoverTip({ label, align = "center", children }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  if (Platform.OS !== "web") return <>{children}</>;

  // react-native-web forwards mouse events on View, but React Native's own
  // View typings don't know them, hence the loose object.
  const hoverProps: object = {
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
  };

  return (
    <View {...hoverProps}>
      {children}
      {visible && (
        <View style={[styles.layer, styles[align]]} pointerEvents="none">
          <View style={styles.bubble}>
            <Text style={styles.label}>{label}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    // `direction: "ltr"` makes flex-start / flex-end below mean physical
    // left / right, whatever direction the page is in.
    layer: {
      position: "absolute",
      top: "100%",
      marginTop: 6,
      width: LAYER_WIDTH,
      direction: "ltr",
      zIndex: 1000,
    },
    left: { left: 0, alignItems: "flex-start" },
    right: { right: 0, alignItems: "flex-end" },
    center: { left: "50%", marginLeft: -LAYER_WIDTH / 2, alignItems: "center" },
    bubble: {
      backgroundColor: colors.text,
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.background, textAlign: "center" },
  });
}
