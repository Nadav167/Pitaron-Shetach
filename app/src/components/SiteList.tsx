import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import type { Campsite } from "@/types/campsite";
import SiteCard from "./SiteCard";
import EmptyState from "./EmptyState";
import { spacing } from "@/constants/theme";
import { useLocale } from "@/context/LocaleContext";
import { useBottomClearance } from "@/hooks/useBottomClearance";

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
  const clearance = useBottomClearance();

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
        // Room under the last card (and the iPhone home indicator).
        { paddingBottom: clearance },
        numColumns > 1 && styles.gridContent,
        contentMaxWidth ? { width: "100%", maxWidth: contentMaxWidth, marginHorizontal: "auto" } : undefined,
      ]}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      renderItem={({ item }) => (
        <View style={numColumns > 1 ? gridItemStyle(numColumns) : undefined}>
          <SiteCard
            campsite={item}
            note={noteFor?.(item)}
            onPress={() => onSelectCampsite(item)}
            // Photo-less sites become compact rows in a one-column list. A
            // grid keeps every card the same shape, so there they keep the
            // generic cover.
            variant={numColumns === 1 && !hasPhoto(item) ? "compact" : "photo"}
          />
        </View>
      )}
    />
  );
}

function hasPhoto(campsite: Campsite): boolean {
  return campsite.photos.some((photo) => !photo.isPlaceholder);
}

// Every column is exactly 1/numColumns of the row, full row or not. The
// gutter between cards is each item's own horizontal padding (half a gutter
// per side, cancelled at the row's edges by the row's negative margin),
// not a flex `gap`. With a gap, a full row's three 33% items had to
// shrink to make room for it, while a short last row had room to spare,
// so its cards came out wider than the ones above (seen on Favorites).
// flex:1 had the same problem in the other direction: a short row's cards
// stretched to fill it.
const GRID_GUTTER = spacing.md;

function gridItemStyle(numColumns: number) {
  return {
    width: `${100 / numColumns}%`,
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: GRID_GUTTER / 2,
  } as const;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, flexGrow: 1 },
  // Grid mode (numColumns > 1): SiteCard's own marginBottom already spaces
  // rows vertically, so only the horizontal gap between columns is added
  // here — adding a vertical gap too would double up with that margin.
  gridContent: { gap: 0 },
  row: { marginHorizontal: -GRID_GUTTER / 2 },
});
