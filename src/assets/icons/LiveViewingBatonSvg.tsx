import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const LIVE_VIEWING_BATON_DESIGN_W = 160;
export const LIVE_VIEWING_BATON_DESIGN_H = 34;

interface LiveViewingBatonSvgProps {
  width: number;
  height: number;
}

/** Background + border only (design 160×34). Label text is rendered by the parent. */
const LiveViewingBatonSvg: React.FC<LiveViewingBatonSvgProps> = ({ width, height }) => (
  <Svg
    width={width}
    height={height}
    viewBox={`0 0 ${LIVE_VIEWING_BATON_DESIGN_W} ${LIVE_VIEWING_BATON_DESIGN_H}`}
    fill="none"
  >
    <Path
      d="M1 9C1 4.58172 4.58172 1 9 1H151C155.418 1 159 4.58172 159 9V25C159 29.4183 155.418 33 151 33H9C4.58172 33 1 29.4183 1 25V9Z"
      fill="#000000"
      fillOpacity={0.6}
    />
    <Path
      d="M151 0.5C155.694 0.5 159.5 4.30558 159.5 9V25C159.5 29.6944 155.694 33.5 151 33.5H9C4.30558 33.5 0.5 29.6944 0.5 25V9C0.5 4.30558 4.30558 0.5 9 0.5H151Z"
      stroke="#FFFFFF"
      strokeOpacity={0.25}
      fill="none"
    />
  </Svg>
);

export default LiveViewingBatonSvg;
