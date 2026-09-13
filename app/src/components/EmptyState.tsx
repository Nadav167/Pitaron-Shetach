import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { colors, spacing } from "@/constants/theme";

export default function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text variant="bodyMedium" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  text: {
    color: colors.textMuted,
    textAlign: "center",
  },
});
