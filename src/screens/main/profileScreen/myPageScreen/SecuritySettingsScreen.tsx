import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from '../../../../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, FONTS, SPACING, BACK_NAVIGATION_HIT_SLOP } from '../../../../constants';
import { RootStackParamList } from '../../../../types';
import { useAppSelector } from '../../../../store/hooks';
import { translations } from '../../../../i18n/translations';

type SecuritySettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SecuritySettings'>;
type SecuritySettingsScreenProps = {
  embedded?: boolean;
  onSelectEmbeddedPage?: (page: 'changePassword' | 'paymentPassword' | 'privacyPolicy') => void;
};

const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({
  embedded = false,
  onSelectEmbeddedPage,
}) => {
  const navigation = useNavigation<SecuritySettingsScreenNavigationProp>();
  const locale = useAppSelector((state) => state.i18n.locale) as 'en' | 'ko' | 'zh';

  const t = (key: string, params?: { [key: string]: string }) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    if (params && typeof value === 'string') {
      Object.keys(params).forEach((paramKey) => {
        value = value.replace(`{${paramKey}}`, params[paramKey]);
      });
    }
    return value || key;
  };

  const rows: { title: string; onPress: () => void }[] = [
    {
      title: t('profile.changePassword'),
      onPress: () =>
        embedded && onSelectEmbeddedPage
          ? onSelectEmbeddedPage('changePassword')
          : navigation.navigate('ChangePassword'),
    },
    {
      title: t('profile.paymentPassword'),
      onPress: () =>
        embedded && onSelectEmbeddedPage
          ? onSelectEmbeddedPage('paymentPassword')
          : navigation.navigate('PaymentPassword'),
    },
    {
      title: t('auth.privacyPolicy'),
      onPress: () =>
        embedded && onSelectEmbeddedPage
          ? onSelectEmbeddedPage('privacyPolicy')
          : navigation.navigate('PrivacyPolicy'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {!embedded ? (
          <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        <Text style={styles.headerTitle}>{t('profile.securitySettings')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('profile.securitySettingsIntro')}</Text>

        <View style={styles.card}>
          {rows.map((row, index) => (
            <TouchableOpacity
              key={row.title}
              style={[
                styles.row,
                index === 0 && styles.rowFirst,
                index === rows.length - 1 && styles.rowLast,
              ]}
              onPress={row.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Icon name="chevron-forward" size={18} color={COLORS.black} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 32,
    height: 32,
  },
  scrollView: {
    flex: 1,
  },
  intro: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    backgroundColor: COLORS.white,
  },
  rowFirst: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  rowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  rowTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
});

export default SecuritySettingsScreen;
