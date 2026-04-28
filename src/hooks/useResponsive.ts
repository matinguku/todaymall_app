import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { SPACING } from '../constants';

const TABLET_BREAKPOINT = 600;

export function useResponsive() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = Math.min(screenWidth, screenHeight) >= TABLET_BREAKPOINT;
    const isLandscape = screenWidth > screenHeight;

    const contentWidth = screenWidth - SPACING.sm * 2;

    // Tablet-landscape gets 4 columns (more screen real estate to fill);
    // tablet-portrait stays at 3; phones stay at 2. The grid card width
    // below is computed from this so individual cards shrink/expand to
    // fit the new column count automatically.
    const moreToLoveColumns = isTablet ? (isLandscape ? 4 : 3) : 2;

    const gridCardWidth =
      (contentWidth - SPACING.sm * (moreToLoveColumns - 1) - SPACING.sm * 2) / moreToLoveColumns;

    const newInColumns = isTablet ? 5 : 3;
    const newInGaps = SPACING.xs * (newInColumns - 1);
    const newInCardWidth = Math.floor(
      (contentWidth - SPACING.sm * 2 - newInGaps) / newInColumns,
    );
    const newInCardHeight = Math.floor(newInCardWidth * 1.55);

    const liveChannelCardWidth = isTablet ? 260 : 163;

    const brandImageHeight = isTablet
      ? Math.round(contentWidth * 0.38)
      : 128;

    const categoryIconSize = isTablet
      ? Math.floor((contentWidth - SPACING.md * 2 - SPACING.sm * 4) / 6)
      : Math.floor((contentWidth - SPACING.md * 2 - SPACING.sm * 4) / 5);

    const todaysDealsColumns = 2;
    const todaysDealsCardWidth =
      (contentWidth - SPACING.sm * (todaysDealsColumns + 1)) / todaysDealsColumns;

    const dealsCardWidth = Math.floor(
      (contentWidth - SPACING.sm * 3) / 2,
    );

    const maxContentWidth = screenWidth;

    return {
      screenWidth,
      screenHeight,
      contentWidth,
      isTablet,
      isLandscape,
      moreToLoveColumns,
      gridCardWidth,
      newInColumns,
      newInCardWidth,
      newInCardHeight,
      liveChannelCardWidth,
      brandImageHeight,
      categoryIconSize,
      todaysDealsColumns,
      todaysDealsCardWidth,
      dealsCardWidth,
      maxContentWidth,
    };
  }, [screenWidth, screenHeight]);
}
