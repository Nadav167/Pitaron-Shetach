import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import type { Campsite } from "@/types/campsite";
import SiteCard from "./SiteCard";
import EmptyState from "./EmptyState";
import { spacing } from "@/constants/theme";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  campsites: Campsite[];
  onSelectCampsite: (campsite: Campsite) => void;
  /** 1 = the original single-column mobile list. >1 = a wrapping grid, used
   *  on desktop-width screens (see Home-Desktop in the mockup). */
  numColumns?: number;
  /** Rendered above the list, inside the same scroll view — the screen
   *  title/subtitle/filter chips (and, on desktop, the search hero) live
   *  here so the whole screen scrolls as one region instead of nesting a
   *  second scrollable container around the list. */
  header?: React.ReactNode;
  /** Caps and centers the *rendered content* (header + rows) at this width
   *  on wide windows — deliberately applied to the FlatList's own
   *  `contentContainerStyle`, not to a `<View>` wrapping the whole
   *  FlatList. The FlatList itself is the actual scrollable element (it's
   *  the one with `overflow` and the native scrollbar); constraining *it*
   *  to a centered box left the scrollbar pinned to the edge of that box
   *  instead of the true edge of the browser viewport — it looked like it
   *  was floating in the middle of the screen instead of against the
   *  window edge. Keeping the FlatList full-width and only capping its
   *  content fixes both: content still centers, scrollbar sits where a
   *  native scrollbar belongs. */
  contentMaxWidth?: number;
  /** Shown in place of the rows when `campsites` is empty. */
  emptyMessage?: string;
  /** Extra line for a card, e.g. its distance from a searched town. */
  noteFor?: (campsite: Campsite) => string | undefined;
};

export default function SiteList({
  campsites,
  onSelectCampsite,
  numColumns = 1,
  header,
  contentMaxWidth,
  emptyMessage,
  noteFor,
}: Props) {
  const { t } = useLocale();

  // The empty state is the FlatList's own ListEmptyComponent rather than a
  // separate early return: swapping the whole FlatList out for another view
  // unmounted the header with it, so a search box living in `header` lost
  // focus (and the keyboard) the moment a query stopped matching anything.
  return (
    <FlatList
      // FlatList doesn't support changing numColumns on a mounted instance
      // (RN throws) — keying on it forces a clean remount when the
      // desktop/mobile breakpoint crosses, e.g. on a browser window resize.
      key={`cols-${numColumns}`}
      data={campsites}
      keyExtractor={(campsite) => campsite.id}
      numColumns={numColumns}
      ListHeaderComponent={header ? <>{header}</> : undefined}
      ListEmptyComponent={<EmptyState message={emptyMessage ?? t("home.emptySites")} />}
      // Typing in a header search box must not be interrupted by a tap on a
      // result: without this the first tap only dismisses the keyboard.
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        numColumns > 1 && styles.gridContent,
        contentMaxWidth ? { width: "100%", maxWidth: contentMaxWidth, marginHorizontal: "auto" } : undefined,
      ]}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      renderItem={({ item }) => (
        <View style={numColumns > 1 ? gridItemStyle(numColumns) : undefined}>
          <SiteCard campsite={item} note={noteFor?.(item)} onPress={() => onSelectCampsite(item)} />
        </View>
      )}
    />
  );
}

// flexBasis (not flex:1/flexGrow) keeps every card the SAME width whether
// its row is full or not — flex:1 was making the last, short row's card(s)
// stretch to fill the whole row width instead of matching the other cards.
function gridItemStyle(numColumns: number) {
  return { flexBasis: `${100 / numColumns}%`, flexGrow: 0, flexShrink: 1 } as const;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, flexGrow: 1 },
  // Grid mode (numColumns > 1): SiteCard's own marginBottom already spaces
  // rows vertically, so only the horizontal gap between columns is added
  // here — adding a vertical gap too would double up with that margin.
  gridContent: { gap: 0 },
  row: { gap: spacing.md },
});
