import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../../components';
import ShieldCheckIcon from '../../assets/icons/ShieldCheckIcon';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { confirmQrLogin } from '../../services/authApi';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';

type QrLoginConfirmRouteParams = {
  token?: string;
};

const QrLoginConfirmScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { token } = (route.params || {}) as QrLoginConfirmRouteParams;
  const { isAuthenticated, isLoading, user } = useAuth();
  const { showToast } = useToast();
  const locale = useAppSelector((state) => state.i18n.locale) as 'en' | 'ko' | 'zh';
  const [isConfirming, setIsConfirming] = useState(false);

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

  const handleCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main');
  };

  const handleLogin = () => {
    navigation.navigate('Auth', {
      screen: 'Login',
      params: {
        returnTo: 'QrLoginConfirm',
        returnParams: { token },
      },
    });
  };

  const handleConfirm = async () => {
    if (!token) {
      showToast(t('auth.qrLogin.invalidLink'), 'error');
      return;
    }

    if (!isAuthenticated) {
      handleLogin();
      return;
    }

    setIsConfirming(true);
    const result = await confirmQrLogin(token, locale);
    setIsConfirming(false);

    if (!result.success) {
      showToast(result.error || t('auth.qrLogin.failed'), 'error');
      return;
    }

    showToast(result.message || t('auth.qrLogin.success'), 'success');
    navigation.navigate('Main');
  };

  const renderAction = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.red} />
          <Text style={styles.loadingText}>{t('auth.qrLogin.checkingStatus')}</Text>
        </View>
      );
    }

    if (!isAuthenticated) {
      return (
        <Button
          title={t('auth.qrLogin.loginToConfirm')}
          onPress={handleLogin}
          size="large"
          fullWidth
          disabled={!token}
        />
      );
    }

    return (
      <Button
        title={t('auth.qrLogin.confirmButton')}
        onPress={handleConfirm}
        size="large"
        fullWidth
        loading={isConfirming}
        disabled={!token || isConfirming}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <ShieldCheckIcon width={54} height={54} color={COLORS.red} />
        </View>

        <Text style={styles.title}>{t('auth.qrLogin.title')}</Text>
        <Text style={styles.description}>
          {t('auth.qrLogin.description')}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('auth.qrLogin.account')}</Text>
          <Text style={styles.accountText}>
            {isAuthenticated
              ? user?.email || user?.name || t('auth.qrLogin.loggedInUser')
              : t('auth.qrLogin.loginRequired')}
          </Text>
        </View>

        {!token ? (
          <Text style={styles.errorText}>
            {t('auth.qrLogin.missingToken')}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {renderAction()}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isConfirming}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  accountText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.text.primary,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  actions: {
    gap: SPACING.md,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  cancelText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    fontWeight: FONTS.weights.semibold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
});

export default QrLoginConfirmScreen;
