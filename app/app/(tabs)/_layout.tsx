import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import DesktopNav from "@/components/DesktopNav";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function TabsLayout() {
  const { t } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();

  // A floating pill bar, built entirely from documented React Navigation
  // bottom-tabs props (tabBarStyle + a custom tabBarIcon per screen) rather
  // than a fully custom tabBar renderer — so the built-in RTL mirroring
  // (Home/Map/Favorites/Settings reverses under Hebrew automatically, same
  // as it always has), safe-area handling and platform back-behavior all
  // keep working untouched. The active tab's icon sits in a plain centered
  // accent circle — no vertical pop — per the design pass.
  const renderIcon = (name: IconName) =>
    function TabIcon({ color, focused }: { color: string; focused: boolean }) {
      return (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: focused ? colors.accent : "transparent",
          }}
        >
          <MaterialCommunityIcons name={name} size={20} color={focused ? colors.onAccent : color} />
        </View>
      );
    };

  return (
    <View style={{ flex: 1 }}>
      {/* Desktop-width screens get a top nav bar instead of the floating
          bottom tab bar — the layout the mockup's Home-Desktop artboard
          specified. The bottom bar is hidden (not unmounted) via
          tabBarStyle below, so switching window width doesn't remount the
          navigator. */}
      {isDesktop && <DesktopNav />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.onAccent,
          tabBarInactiveTintColor: "rgba(245,241,230,0.8)",
          tabBarHideOnKeyboard: true,
          tabBarStyle: isDesktop
            ? { display: "none" }
            : {
                position: "absolute",
                left: 20,
                right: 20,
                bottom: 18,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.primary,
                borderTopWidth: 0,
                elevation: 8,
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              },
          tabBarItemStyle: { height: 64, justifyContent: "center" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t("tabs.home"), tabBarIcon: renderIcon("home") }}
        />
        <Tabs.Screen
          name="map"
          options={{ title: t("tabs.map"), tabBarIcon: renderIcon("map") }}
        />
        <Tabs.Screen
          name="favorites"
          options={{ title: t("tabs.favorites"), tabBarIcon: renderIcon("heart") }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: t("tabs.settings"), tabBarIcon: renderIcon("cog") }}
        />
      </Tabs>
    </View>
  );
}
