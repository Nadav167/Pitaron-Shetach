import React from "react";
import { FlatList, StyleSheet } from "react-native";
import type { Campsite } from "@/types/campsite";
import SiteCard from "./SiteCard";
import EmptyState from "./EmptyState";
import { spacing } from "@/constants/theme";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  campsites: Campsite[];
  onSelectCampsite: (campsite: Campsite) => void;
};

export default function SiteList({ campsites, onSelectCampsite }: Props) {
  const { t } = useLocale();

  if (campsites.length === 0) {
    return <EmptyState message={t("home.emptySites")} />;
  }

  return (
    <FlatList
      data={campsites}
      keyExtractor={(campsite) => campsite.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <SiteCard campsite={item} onPress={() => onSelectCampsite(item)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
});
