import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useLocale } from "@/context/LocaleContext";
import { useResponsive } from "@/hooks/useResponsive";
import DesktopNav from "@/components/DesktopNav";
import MobileHeader from "@/components/MobileHeader";

/**
 * The main screens. They sit in a tab navigator for its routing (each
 * screen keeps its state while you're on another), but its bar is never
 * shown: desktop-width screens navigate with DesktopNav's links, phone
 * widths (web and the native app) with the side menu behind MobileHeader's
 * ☰ button. The floating bottom tab bar was removed at Nadav's request
 * (2026-10-22). Which pages the menus list, and when, is decided there.
 */
export default function TabsLayout() {
  const { t } = useLocale();
  const { isDesktop } = useResponsive();

  return (
    <View style={{ flex: 1 }}>
      {isDesktop ? <DesktopNav /> : <MobileHeader />}
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
        <Tabs.Screen name="index" options={{ title: t("tabs.home") }} />
        <Tabs.Screen name="map" options={{ title: t("tabs.map") }} />
        <Tabs.Screen name="favorites" options={{ title: t("tabs.favorites") }} />
        <Tabs.Screen name="agent" options={{ title: t("tabs.agent") }} />
        <Tabs.Screen name="itineraries" options={{ title: t("tabs.itineraries") }} />
        <Tabs.Screen name="about" options={{ title: t("about.title") }} />
        <Tabs.Screen name="login" options={{ title: t("auth.loginTitle") }} />
        <Tabs.Screen name="register" options={{ title: t("auth.registerTitle") }} />
      </Tabs>
    </View>
  );
}
