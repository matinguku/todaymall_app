import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';

export const LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_W = 377;
export const LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_H = 78;

interface LiveCarouselBottomFadeProps {
  /** Render width (design is 377 wide). */
  width?: number;
  /** Render height (design is 78 tall). Keep aspect ratio with width for correct corners. */
  height?: number;
  /** Unique id for the gradient def (required when multiple instances mount). */
  gradientId: string;
}

/**
 * Bottom fade shape for the featured live carousel card — transparent at top of the band,
 * solid at bottom (matches export: linear gradient + rounded bottom corners).
 */
const LiveCarouselBottomFade: React.FC<LiveCarouselBottomFadeProps> = ({
  width = LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_W,
  height = LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_H,
  gradientId,
}) => (
  <Svg width={width} height={height} viewBox={`0 0 ${LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_W} ${LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_H}`} fill="none">
    <Defs>
      <LinearGradient
        id={gradientId}
        x1="188.5"
        y1="0"
        x2="188.5"
        y2="78"
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset="0" stopColor="#000000" stopOpacity="0" />
        <Stop offset="1" stopColor="#000000" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    <Path
      d="M0 0H377V62C377 70.8366 369.837 78 361 78H16C7.16344 78 0 70.8366 0 62V0Z"
      fill={`url(#${gradientId})`}
    />
  </Svg>
);

export default LiveCarouselBottomFade;
