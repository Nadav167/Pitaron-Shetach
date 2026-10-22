import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/useResponsive";
import { spacing, TAB_BAR } from "@/constants/theme";

/**
 * How much bottom padding a scrolling screen needs so its last item can
 * scroll out from under the floating tab bar: the bar's height, its gap
 * above the screen edge, the home-indicator inset on iPhones (0 on web and
 * on phones without one) and a little breathing room. Where there is no
 * bottom bar (desktop, and phone-width web, which uses the side menu) this
 * is only the breathing room.
 */
export function useTabBarClearance(): number {
  const { isDesktop, hasBottomTabBar } = useResponsive();
  const insets = useSafeAreaInsets();
  if (isDesktop) return spacing.xl;
  if (!hasBottomTabBar) return spacing.md + insets.bottom;
  return TAB_BAR.height + TAB_BAR.bottom + insets.bottom + spacing.md;
}
