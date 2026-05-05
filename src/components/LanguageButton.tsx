import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store/hooks';
import { COLORS, FONTS } from '../constants';

/**
 * Header icon that opens the language settings screen and displays the
 * current locale as a flag emoji. Used on every main screen — Home /
 * Message / Live / Cart / Account — so the language switcher always
 * appears in the same place and shows what's selected at a glance.
 */
const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  ko: '🇰🇷',
  zh: '🇨🇳',
};

const LanguageButton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const navigation = useNavigation<any>();
  const locale = useAppSelector((s) => s.i18n.locale);
  const flag = LOCALE_FLAGS[locale] || LOCALE_FLAGS.en;

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={() => navigation.navigate('LanguageSettings')}
      activeOpacity={0.7}
    >
      <Text style={styles.flag}>{flag}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    // Big enough to read at a glance in the header. The emoji's actual
    // box leaves a bit of extra height/width depending on the platform's
    // font, so the 36×36 button still has comfortable padding around it.
    fontSize: FONTS.sizes.xl,
    lineHeight: FONTS.sizes.xl + 2,
  },
});

export default LanguageButton;
