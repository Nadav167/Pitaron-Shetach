import { useWindowDimensions } from "react-native";

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
  return { width, isDesktop: width >= DESKTOP_BREAKPOINT };
}
