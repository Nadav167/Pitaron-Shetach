import React, { useState } from "react";
import { Pressable, Text, type StyleProp, type TextStyle } from "react-native";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  text: string;
  /** Lines shown while collapsed. */
  lines?: number;
  style?: StyleProp<TextStyle>;
  toggleStyle?: StyleProp<TextStyle>;
};

/**
 * Long free text (price notes, hours notes) clamped to a few lines, with a
 * "read all" toggle. Whether the text overflows is estimated from its
 * length: measuring rendered lines (onTextLayout) isn't reported on web.
 * Roughly 45 characters fit on a phone-width line at 14px, so `lines`
 * lines hold about lines × 45; shorter text never gets a pointless toggle.
 */
export default function ExpandableText({ text, lines = 3, style, toggleStyle }: Props) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const long = text.length > lines * 45;

  return (
    <>
      <Text style={style} numberOfLines={expanded || !long ? undefined : lines}>
        {text}
      </Text>
      {long && (
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
