import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/useResponsive";
import { spacing } from "@/constants/theme";

/**
 * Bottom padding for a scrolling screen's content: breathing room below the
 * last item, plus the iPhone home-indicator inset (0 on web and on phones
 * without one) so nothing ends up under it.
 *
 * It used to also clear the floating bottom tab bar, which the side menu
 * replaced (2026-10-22); screens still take it from here so that any
 * future bottom bar needs one change, not seven.
 */
export function useBottomClearance(): number {
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  return isDesktop ? spacing.xl : spacing.md + insets.bottom;
}
