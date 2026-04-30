import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components';
import GiftIcon from '../../assets/icons/GiftIcon';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';
import { useToast } from '../../context/ToastContext';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';
import { submitReferralCode } from '../../services/authApi';

const SocialReferralCodeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const locale = useAppSelector((state) => state.i18n.locale) as 'en' | 'ko' | 'zh';
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = (key: string) => {
    const keys = key.split('.');
    const selectedTranslations = translations[locale] || translations.ko;
    let value: any = selectedTranslations;
    let fallbackValue: any = translations.ko;

    for (const k of keys) {
      value = value?.[k];
      fallbackValue = fallbackValue?.[k];
    }

    return value || fallbackValue || key;
  };

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleSubmit = async () => {
    const trimmedCode = referralCode.trim();

    if (!trimmedCode) {
      goHome();
      return;
    }

    setIsSubmitting(true);
    const result = await submitReferralCode(trimmedCode, locale);
    setIsSubmitting(false);

    if (!result.success) {
      showToast(result.error || t('auth.socialReferral.submitFailed'), 'error');
      return;
    }

    showToast(result.message || t('auth.socialReferral.submitSuccess'), 'success');
    goHome();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <GiftIcon width={48} height={48} color={COLORS.red} />
          </View>

          <Text style={styles.title}>{t('auth.socialReferral.title')}</Text>
          <Text style={styles.description}>{t('auth.socialReferral.description')}</Text>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>{t('auth.referralCode')}</Text>
            <TextInput
              value={referralCode}
              onChangeText={setReferralCode}
              placeholder={t('auth.enterReferralCode')}
              placeholderTextColor={COLORS.text.secondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isSubmitting}
              maxLength={32}
              style={styles.input}
            />
          </View>

          <Button
            title={t('auth.socialReferral.submit')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            size="large"
            fullWidth
          />

          <TouchableOpacity
            style={styles.skipButton}
            onPress={goHome}
            disabled={isSubmitting}
          >
            <Text style={styles.skipText}>{t('auth.socialReferral.skip')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginBottom: SPACING.xl,
    ...SHADOWS.md,
  },
  title: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: FONTS.weights.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  inputCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  input: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.text.primary,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDark,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  skipText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    fontWeight: FONTS.weights.semibold,
  },
});

export default SocialReferralCodeScreen;
