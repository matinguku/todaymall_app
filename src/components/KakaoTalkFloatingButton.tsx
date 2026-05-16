import React, { useCallback, useRef } from 'react';
import { Animated, Easing, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path as SvgPath } from 'react-native-svg';

import { COLORS, SPACING } from '../constants';

interface KakaoTalkFloatingButtonProps {
  /** Override the default `bottom: 19`. Use to clear a screen-specific bar. */
  bottom?: number;
  /** Override the default `right: SPACING.lg`. */
  right?: number;
}

/**
 * Floating KAKAO/TALK chat baton. Bubble shape + label cross-fade; whole
 * control bounces vertically while the host screen is focused. Animation
 * stops on blur via `useFocusEffect` so it doesn't burn cycles on screens
 * the user has navigated away from.
 *
 * Visual + behavioural source-of-truth previously lived inline in HomeScreen;
 * extracted here so the Live, Product Detail, and Live Seller screens render
 * the exact same button without re-implementing the animation/deep-link flow.
 */
const KAKAO_TALK_SWAP_MS = 1500;
const KAKAO_TALK_FADE_MS = 320;
const KAKAO_BOUNCE_UP_PX = 25;
const KAKAO_BOUNCE_UP_MS = 380;
const KAKAO_BOUNCE_DOWN_MS = 420;
const KAKAO_BOUNCE_REST_MS = 140;
// Design SVG is 34 × 39; rendered at 1.275× to match the home-screen baton.
const KAKAO_TALK_W = 34 * 1.275;
const KAKAO_TALK_H = 39 * 1.275;

const KakaoTalkFloatingButton: React.FC<KakaoTalkFloatingButtonProps> = ({
  bottom = 19,
  right = SPACING.lg,
}) => {
  const kakaoTalkPhase = useRef(new Animated.Value(0)).current;
  const kakaoBounceY = useRef(new Animated.Value(0)).current;
  const kakaoLabelOpacity = kakaoTalkPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const talkLabelOpacity = kakaoTalkPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  useFocusEffect(
    useCallback(() => {
      // Track whether the screen is still focused. Animation callbacks that
      // arrive after blur must not call .start() again, otherwise the native
      // animated module can compute a negative frame index against a torn-down
      // view and crash with `IllegalStateException: Calculated frame index
      // should never be lower than 0` (NativeAnimatedModule.kt:379).
      let isActive = true;
      let phase = 0;
      kakaoTalkPhase.stopAnimation();
      kakaoTalkPhase.setValue(0);
      kakaoBounceY.stopAnimation();
      kakaoBounceY.setValue(0);

      // Both timings use the JS driver. Mixing native and JS drivers on the
      // same `Animated.Value` instance throws "Attempting to run JS driven
      // animation on animated node that has been moved to 'native' earlier"
      // because RN permanently flags the value the first time a native-driven
      // animation runs against it (the flag survives reloads). Keeping both
      // animations on the JS driver also avoids the navigation tear-down race
      // that produced the earlier `IllegalStateException: Calculated frame
      // index should never be lower than 0` on continuous native loops.
      const interval = setInterval(() => {
        if (!isActive) return;
        phase = phase === 0 ? 1 : 0;
        Animated.timing(kakaoTalkPhase, {
          toValue: phase,
          duration: KAKAO_TALK_FADE_MS,
          useNativeDriver: false,
        }).start();
      }, KAKAO_TALK_SWAP_MS);

      const bounceLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(kakaoBounceY, {
            toValue: -KAKAO_BOUNCE_UP_PX,
            duration: KAKAO_BOUNCE_UP_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(kakaoBounceY, {
            toValue: 0,
            duration: KAKAO_BOUNCE_DOWN_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.delay(KAKAO_BOUNCE_REST_MS),
        ]),
      );
      bounceLoop.start();

      return () => {
        // Order matters: flip the guard and stop the loop FIRST so any
        // already-scheduled frame callbacks short-circuit before we tear
        // down the timer / reset the values. Doing it the other way lets
        // a pending frame schedule a new timing after `setValue(0)` and
        // hit the negative-frame-index crash.
        isActive = false;
        bounceLoop.stop();
        kakaoTalkPhase.stopAnimation();
        kakaoBounceY.stopAnimation();
        clearInterval(interval);
        kakaoTalkPhase.setValue(0);
        kakaoBounceY.setValue(0);
      };
    }, [kakaoTalkPhase, kakaoBounceY]),
  );

  const openKakaoTalk = useCallback(async () => {
    // Native deep link first; fall back to the web channel page when the
    // KakaoTalk app isn't installed (or the scheme isn't whitelisted).
    const channelId = '_todaymall';
    const nativeUrl = `kakaoplus://plusfriend/home/${channelId}`;
    const webUrl = `https://pf.kakao.com/${channelId}`;
    try {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      if (canOpen) {
        await Linking.openURL(nativeUrl);
        return;
      }
    } catch {
      // fall through
    }
    try {
      await Linking.openURL(webUrl);
    } catch {
      // no-op
    }
  }, []);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.button,
        { right, bottom },
        { transform: [{ translateY: kakaoBounceY }] },
      ]}
    >
      <TouchableOpacity
        onPress={openKakaoTalk}
        activeOpacity={0.85}
        style={styles.touchableFill}
      >
        <Svg
          width={KAKAO_TALK_W}
          height={KAKAO_TALK_H}
          viewBox="0 0 34 39"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <SvgPath
            d="M17 0C26.3888 0 34 7.61116 34 17C34 24.0692 29.6847 30.1298 23.5449 32.6934L12.4805 38.835L12.8555 33.4893C5.47003 31.6388 0 24.9591 0 17C0 7.61116 7.61116 0 17 0Z"
            fill={COLORS.yellow}
          />
        </Svg>
        <View style={styles.labelStack} pointerEvents="none">
          <Animated.Text style={[styles.label, { opacity: kakaoLabelOpacity }]}>
            KAKAO
          </Animated.Text>
          <Animated.Text style={[styles.label, { opacity: talkLabelOpacity }]}>
            TALK
          </Animated.Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: KAKAO_TALK_W,
    height: KAKAO_TALK_H,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  touchableFill: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Label band height matches the bubble's body (upper 34 of the original 39
  // viewBox), scaled in sync with the SVG so the text sits centered inside
  // the bubble rather than over the pointed tail.
  labelStack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 34 * 1.275,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    color: COLORS.black,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default KakaoTalkFloatingButton;
