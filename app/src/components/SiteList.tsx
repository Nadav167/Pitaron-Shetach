import React from "react";
import { FlatList, StyleSheet } from "react-native";
import { Site } from "@/types/site";
import SiteCard from "./SiteCard";
import EmptyState from "./EmptyState";
import { spacing } from "@/constants/theme";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  sites: Site[];
  onSelectSite: (site: Site) => void;
};

export default function SiteList({ sites, onSelectSite }: Props) {
  const { t } = useLocale();

  if (sites.length === 0) {
    return <EmptyState message={t("home.emptySites")} />;
  }

  return (
    <FlatList
      data={sites}
      keyExtractor={(site) => site.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <SiteCard site={item} onPress={() => onSelectSite(item)} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
});
