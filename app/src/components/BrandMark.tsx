import React from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";

const MARK = require("../../assets/images/brand-mark.png");

type Props = {
  /** The coloured rounded box around the mark (size, radius, background). */
  style: StyleProp<ViewStyle>;
  size: number;
};

/**
 * The site logo: white pine tree + orange tent, the same art as the
 * favicon / home-screen icon. The PNG is transparent (the tent door too),
 * so the box's background colour shows through.
 */
export default function BrandMark({ style, size }: Props): React.JSX.Element {
  return (
    <View style={style}>
      <Image source={MARK} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
    </View>
  );
}
