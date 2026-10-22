import { Platform, useWindowDimensions } from "react-native";

/**
 * Below this width the app renders as the original mobile-first design
 * (single-column list, floating bottom tab bar). At or above it, screens
 * switch to the wider desktop treatment from the mockup's Home-Desktop
 * artboard (top nav bar, centered search hero, multi-column card grid).
 * 900px keeps small laptop windows and split-screen browsers on the mobile
 * layout rather than showing a cramped, half-empty grid.
 */
export const DESKTOP_BREAKPOINT = 900;

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  // Phone-width web navigates with a side menu (the ☰ button in
  // MobileHeader, Nadav 2026-10-22) instead of the floating bottom tab bar,
  // which the native app keeps.
  const sideMenu = !isDesktop && Platform.OS === "web";
  return { width, isDesktop, sideMenu, hasBottomTabBar: !isDesktop && !sideMenu };
}
