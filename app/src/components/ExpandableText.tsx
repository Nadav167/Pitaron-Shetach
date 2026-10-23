import React, { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from "react-native";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  text: string;
  /** Lines shown while collapsed. */
  lines?: number;
  style?: StyleProp<TextStyle>;
  toggleStyle?: StyleProp<TextStyle>;
};

/**
 * Long free text (descriptions, price and hours notes) clamped to a few
 * lines, with a "קרא עוד" toggle that appears only when the text really is
 * cut off.
 *
 * Whether it is gets measured, not guessed: an invisible, unclamped copy of
 * the text is laid out at the same width, and the toggle shows when it's
 * taller than the clamped text. (It used to be estimated from the length,
 * ~45 characters a line, which put a toggle that did nothing under text
 * that fit on a wide screen or was broken into short lines. onTextLayout,
 * the direct way to count lines, isn't reported on web.)
 */
export default function ExpandableText({ text, lines = 3, style, toggleStyle }: Props) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [clampedHeight, setClampedHeight] = useState(0);
  // The clamped height is only meaningful while clamped; keep the last one.
  const onClampedLayout = (e: LayoutChangeEvent) => {
    if (!expanded) setClampedHeight(e.nativeEvent.layout.height);
  };
  const overflows = fullHeight > clampedHeight + 2;

  return (
    <>
      <View>
        <Text style={style} numberOfLines={expanded ? undefined : lines} onLayout={onClampedLayout}>
          {text}
        </Text>
        <Text
          style={[style, { position: "absolute", top: 0, left: 0, right: 0, opacity: 0, pointerEvents: "none" }]}
          onLayout={(e) => setFullHeight(e.nativeEvent.layout.height)}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {text}
        </Text>
      </View>
      {(overflows || expanded) && (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          hitSlop={{ top: 10, bottom: 10 }}
          style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={toggleStyle}>{t(expanded ? "site.readLess" : "site.readMore")}</Text>
        </Pressable>
      )}
    </>
  );
}
