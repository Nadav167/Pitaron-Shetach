import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Rubik_500Medium, Rubik_700Bold, Rubik_900Black } from "@expo-google-fonts/rubik";
import { Heebo_400Regular, Heebo_500Medium, Heebo_700Bold } from "@expo-google-fonts/heebo";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "@/context/LocaleContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { getPaperTheme } from "@/constants/paperTheme";
import { useStorageReady } from "@/lib/storage";

function ThemedApp() {
  const { scheme, colors } = useTheme();

  return (
    <PaperProvider theme={getPaperTheme(scheme)}>
      <LocaleProvider>
        <FavoritesProvider>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            {/* site/[id] renders its own Paper Appbar.Header, so the
                native stack header stays off for that route too. */}
            <Stack.Screen name="site/[id]" />
          </Stack>
        </FavoritesProvider>
      </LocaleProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  // React Native Paper's icon-bearing components (Chip, SegmentedButtons,
  // Appbar, ...) render via react-native-vector-icons/MaterialCommunityIcons
  // under the hood. That package resolves fine on Expo (it's a dependency
  // of @expo/vector-icons, already installed), but its font still needs to
  // be loaded explicitly through expo-font or icons render as blank boxes.
  //
  // Rubik (display) + Heebo (body) are the design brief's type pairing —
  // both ship as Google Fonts packages with real Hebrew glyphs, so headings
  // don't silently fall back to the system font the moment Hebrew text
  // appears the way a Latin-only display face would.
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
    Rubik_500Medium,
    Rubik_700Bold,
    Rubik_900Black,
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
  });

  // Saved theme / language / favorites must be readable before the
  // providers mount (native loads them asynchronously; see lib/storage).
  const storageReady = useStorageReady();

  if (!fontsLoaded || !storageReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
