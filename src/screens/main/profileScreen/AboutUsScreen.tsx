import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../../components/Icon';
import { BackNavTouchableOpacity } from '../../../components/BackNavTouchable';
import { COLORS, FONTS, SHADOWS, SPACING } from '../../../constants';
import { useAppSelector } from '../../../store/hooks';
import { translations } from '../../../i18n/translations';

type AboutUsScreenProps = {
  embedded?: boolean;
  onEmbeddedBack?: () => void;
};

const AboutUsScreen: React.FC<AboutUsScreenProps> = ({ embedded = false, onEmbeddedBack }) => {
  const navigation = useNavigation();
  const locale = useAppSelector((state) => state.i18n.locale);

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {!embedded || onEmbeddedBack ? (
          <BackNavTouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (embedded && onEmbeddedBack) {
                onEmbeddedBack();
                return;
              }
              navigation.goBack();
            }}
          >
            <Icon name="arrow-back" size={18} color={COLORS.text.primary} />
          </BackNavTouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        <Text style={styles.headerTitle}>{t('profile.aboutUs')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.introText}>{t('profile.aboutUsIntro')}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t('profile.aboutUsLabel')}</Text>
            <Text style={styles.value}>{t('auth.supportText')}</Text>
          </View>

          <Text style={styles.footer}>{t('auth.copyright')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  placeholder: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  introText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.gray[100],
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  label: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  value: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  footer: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING['3xl'],
  },
});

export default AboutUsScreen;
