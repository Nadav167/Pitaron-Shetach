import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import DesktopNav from "@/components/DesktopNav";
import { useAuth } from "@/context/AuthContext";
import MobileHeader from "@/components/MobileHeader";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function TabsLayout() {
  const { t } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  // The trip planner shows whenever accounts exist (signed-out visitors get
  // a log-in prompt there); a user's itineraries only while signed in.
  const { enabled: accountsEnabled, status } = useAuth();

  // A floating pill bar, built entirely from documented React Navigation
  // bottom-tabs props (tabBarStyle + a custom tabBarIcon per screen) rather
  // than a fully custom tabBar renderer — so the built-in RTL mirroring
  // (Home/Map/Favorites runs right-to-left, like the rest of the layout), safe-area handling and platform back-behavior all
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
          bottom tab bar; phone-width screens get a slim header carrying
          the brand and the language / light-dark / About controls. The
          bottom bar is hidden (not unmounted) via tabBarStyle below, so
          switching window width doesn't remount the navigator. */}
      {isDesktop ? <DesktopNav /> : <MobileHeader />}
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
          name="agent"
          options={{
            title: t("tabs.agent"),
            tabBarIcon: renderIcon("compass-outline"),
            href: accountsEnabled ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="itineraries"
          options={{
            title: t("tabs.itineraries"),
            tabBarIcon: renderIcon("map-marker-path"),
            href: status === "signedIn" ? undefined : null,
          }}
        />
        {/* About lives in this group so it keeps the same top bar as every
            other page, but `href: null` keeps it out of the bottom tab bar:
            it is reached from the nav link / the header's info button. */}
        <Tabs.Screen name="about" options={{ title: t("about.title"), href: null }} />
        {/* Same for the account screens, reached from the header. */}
        <Tabs.Screen name="login" options={{ title: t("auth.loginTitle"), href: null }} />
        <Tabs.Screen name="register" options={{ title: t("auth.registerTitle"), href: null }} />
      </Tabs>
    </View>
  );
}
