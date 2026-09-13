import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "@/context/LocaleContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { paperTheme } from "@/constants/paperTheme";

export default function RootLayout() {
  // React Native Paper's icon-bearing components (Chip, SegmentedButtons,
  // Appbar, ...) render via react-native-vector-icons/MaterialCommunityIcons
  // under the hood. That package resolves fine on Expo (it's a dependency
  // of @expo/vector-icons, already installed), but its font still needs to
  // be loaded explicitly through expo-font or icons render as blank boxes.
  const [iconsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  if (!iconsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <LocaleProvider>
          <FavoritesProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              {/* site/[id] renders its own Paper Appbar.Header, so the
                  native stack header stays off for that route too. */}
              <Stack.Screen name="site/[id]" />
            </Stack>
          </FavoritesProvider>
        </LocaleProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
