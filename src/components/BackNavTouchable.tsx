import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Pressable,
  PressableProps,
  Platform,
  ViewStyle,
  PressableStateCallbackType,
} from 'react-native';
import { BACK_NAVIGATION_HIT_SLOP } from '../constants';

/**
 * Android: expand real layout bounds + elevation so touches register reliably.
 * hitSlop-only on a 24×24 box is flaky on some Android versions (parent hit-testing).
 * Tablets: same code path when the control is shown; embedded routes omit the control entirely.
 */
const ANDROID_BACK_NAV_LAYOUT: ViewStyle =
  Platform.OS === 'android'
    ? {
        minWidth: 48,
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 4,
        elevation: 4,
      }
    : {};

/** Same visuals as TouchableOpacity; expands tap area via hitSlop (default BACK_NAVIGATION_HIT_SLOP). */
export function BackNavTouchableOpacity({ hitSlop, style, ...rest }: TouchableOpacityProps) {
  return (
    <TouchableOpacity
      hitSlop={hitSlop ?? BACK_NAVIGATION_HIT_SLOP}
      style={[ANDROID_BACK_NAV_LAYOUT, style]}
      {...rest}
    />
  );
}

/** Same visuals as Pressable; expands tap area via hitSlop (default BACK_NAVIGATION_HIT_SLOP). */
export function BackNavPressable({ hitSlop, style, ...rest }: PressableProps) {
  const mergedStyle =
    typeof style === 'function'
      ? (state: PressableStateCallbackType) => [ANDROID_BACK_NAV_LAYOUT, style(state)]
      : [ANDROID_BACK_NAV_LAYOUT, style];

  return (
    <Pressable
      hitSlop={hitSlop ?? BACK_NAVIGATION_HIT_SLOP}
      style={mergedStyle as PressableProps['style']}
      {...rest}
    />
  );
}
