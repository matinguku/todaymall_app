import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from '../../components/Icon';
import {
  COLORS,
  FONTS,
  SPACING,
  BORDER_RADIUS,
  BACK_NAVIGATION_HIT_SLOP,
} from '../../constants';
import { useToast } from '../../context/ToastContext';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';
import { guestOrderApi } from '../../services/guestOrderApi';
import { AuthStackParamList } from '../../types';

type Nav = StackNavigationProp<AuthStackParamList, 'GuestOrderInquiry'>;

const GuestOrderInquiryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { showToast } = useToast();
  const locale = useAppSelector((s) => s.i18n.locale);

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) value = value?.[k];
    return value || key;
  };

  const [recipientName, setRecipientName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const countryCode = '+82';
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeRequesting, setCodeRequesting] = useState(false);
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  // Full response.data from verifyCode — already contains `orders[]`, so
  // pressing "Order Inquiry" just swaps the page to the result view; no
  // second API call is needed.
  const [verifyData, setVerifyData] = useState<any | null>(null);
  // When non-null, the page swaps from the input form to the compact
  // "N orders found" card list.
  const [inquiryResult, setInquiryResult] = useState<any | null>(null);

  // Build the API phone string: local-only digits, no country code, no
  // dashes (e.g. "010-1234-5678" -> "01012345678"). Both request-code
  // and verify-code send the exact same string.
  const buildPhone = () => phoneLocal.replace(/\D/g, '');

  const handleGetCode = async () => {
    if (!recipientName.trim() || !phoneLocal.trim()) {
      showToast(t('auth.nonMemberFillFields'), 'info');
      return;
    }
    if (codeRequesting) return;
    setCodeRequesting(true);
    // Re-requesting clears any previously verified state so the new code
    // can be entered and re-verified.
    setVerificationCode('');
    setCodeVerified(false);
    setVerifyData(null);

    const phone = buildPhone();
    const result = await guestOrderApi.requestCode(phone);
    setCodeRequesting(false);

    if (!result.success) {
      showToast(
        t('auth.failedToSendCode') ||
          result.error ||
          'Failed to send verification code',
        'error',
      );
      return;
    }
    showToast(
      t('auth.verificationCodeHint') ||
        result.message ||
        'Verification code sent.',
      'success',
    );
    setCodeSent(true);
  };

  // Auto-verify when 6 digits are entered.
  useEffect(() => {
    if (!codeSent) return;
    if (verificationCode.length !== 6) {
      if (codeVerified) setCodeVerified(false);
      return;
    }
    if (codeVerifying || codeVerified) return;

    let cancelled = false;
    setCodeVerifying(true);
    (async () => {
      const phone = buildPhone();
      const result = await guestOrderApi.verifyCode(
        phone,
        verificationCode,
        recipientName.trim(),
      );
      if (cancelled) return;
      setCodeVerifying(false);
      if (result.success) {
        setCodeVerified(true);
        setVerifyData(result.data);
        showToast(
          t('auth.verificationCodeHint') ||
            result.message ||
            'Verification successful',
          'success',
        );
      } else {
        showToast(
          t('auth.failedToSendCode') ||
            result.error ||
            'Invalid verification code',
          'error',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode, codeSent]);

  const handleOrderInquiry = () => {
    if (!recipientName.trim() || !phoneLocal.trim()) {
      showToast(t('auth.nonMemberFillFields'), 'info');
      return;
    }
    if (!codeVerified || !verifyData) {
      showToast(
        t('auth.enterCompleteCode') || 'Please verify the 6-digit code first',
        'info',
      );
      return;
    }
    setInquiryResult(verifyData);
  };

  const handleRecheck = () => setInquiryResult(null);

  const handleResultCardPress = (order: any) => {
    if (!order) return;
    (navigation as any).navigate('GuestOrderResult', {
      response: { status: 'success', data: { order } },
    });
  };

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else (navigation as any).navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back-to-login button */}
      <View style={styles.header}>
        <TouchableOpacity
          hitSlop={BACK_NAVIGATION_HIT_SLOP}
          style={styles.backButton}
          onPress={handleBack}
        >
          <Icon name="arrow-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('auth.nonMemberModalTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.titleRow}>
            <View style={styles.titleIconBox}>
              <Icon name="note" size={22} color={COLORS.white} />
            </View>
            <Text style={styles.modalTitle}>{t('auth.nonMemberModalTitle')}</Text>
          </View>
          <Text style={styles.subtitle}>{t('auth.nonMemberModalSubtitle')}</Text>

          {inquiryResult ? (
            (() => {
              const orders: any[] = Array.isArray((inquiryResult as any)?.orders)
                ? (inquiryResult as any).orders
                : [];
              const count = orders.length;
              return (
                <>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultCount}>
                      {`${count} order${count === 1 ? '' : 's'} found`}
                    </Text>
                    <TouchableOpacity
                      onPress={handleRecheck}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.resultRecheck}>Re-check</Text>
                    </TouchableOpacity>
                  </View>
                  {orders.map((order: any) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const firstItem = items[0] || {};
                    const subjectVal = firstItem.subject;
                    const subject =
                      typeof subjectVal === 'object' && subjectVal
                        ? subjectVal[locale] ||
                          subjectVal.en ||
                          subjectVal.ko ||
                          subjectVal.zh ||
                          ''
                        : subjectVal || '';
                    const price = firstItem.userPrice ?? firstItem.salePriceKrw ?? 0;
                    const status = String(order.orderStatus || 'pending').toUpperCase();
                    const created = order.createdAt ? new Date(order.createdAt) : null;
                    const dateStr =
                      created && !isNaN(created.getTime())
                        ? created.toLocaleDateString()
                        : '';
                    return (
                      <TouchableOpacity
                        key={order._id || order.orderNumber}
                        style={[styles.resultCard, { marginBottom: SPACING.sm }]}
                        activeOpacity={0.85}
                        onPress={() => handleResultCardPress(order)}
                      >
                        <View style={styles.resultTopRow}>
                          <Text style={styles.resultOrderNo} numberOfLines={1}>
                            {order.orderNumber || ''}
                          </Text>
                          <Text style={styles.resultDate}>{dateStr}</Text>
                        </View>
                        <View style={styles.resultBody}>
                          {firstItem.imageUrl ? (
                            <Image
                              source={{ uri: firstItem.imageUrl }}
                              style={styles.resultImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.resultImage,
                                { backgroundColor: COLORS.gray[200] },
                              ]}
                            />
                          )}
                          <View style={styles.resultMeta}>
                            <Text style={styles.resultSubject} numberOfLines={2}>
                              {subject}
                            </Text>
                            <Text style={styles.resultPrice}>
                              {`₩${Math.round(Number(price)).toLocaleString('ko-KR')}`}
                            </Text>
                          </View>
                          <View style={styles.resultStatusBox}>
                            <Text style={styles.resultStatus}>{status}</Text>
                            <Icon
                              name="chevron-forward"
                              size={14}
                              color={COLORS.text.secondary}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              );
            })()
          ) : (
            <>
              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Icon name="person-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.fieldLabel}>
                    {t('auth.recipientNameLabel')}
                  </Text>
                </View>
                <RNTextInput
                  style={styles.input}
                  placeholder={t('auth.recipientNamePlaceholder')}
                  placeholderTextColor={COLORS.gray[500]}
                  value={recipientName}
                  onChangeText={setRecipientName}
                />
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.labelRow}>
                  <Icon name="call-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.fieldLabel}>
                    {t('auth.phoneNumberShortLabel')}
                  </Text>
                </View>
                <View style={styles.phoneRow}>
                  <View style={styles.countryBox}>
                    <Text style={styles.countryText}>{countryCode}</Text>
                  </View>
                  <RNTextInput
                    style={[styles.input, styles.phoneInput]}
                    placeholder={t('auth.phoneLocalPlaceholder')}
                    placeholderTextColor={COLORS.gray[500]}
                    value={phoneLocal}
                    onChangeText={setPhoneLocal}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.verifyButton}
                onPress={handleGetCode}
                activeOpacity={0.85}
                disabled={codeRequesting}
              >
                <Text style={styles.verifyButtonText}>
                  {codeRequesting
                    ? t('auth.verificationCodeHint') || 'Sending…'
                    : t('auth.getVerificationCode')}
                </Text>
              </TouchableOpacity>

              {codeSent && (
                <View style={styles.fieldBlock}>
                  <View style={styles.labelRow}>
                    <Icon
                      name={codeVerified ? 'checkmark-circle' : 'key-outline'}
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.fieldLabel}>
                      {t('auth.enterVerificationCode') || 'Verification code'}
                    </Text>
                  </View>
                  <RNTextInput
                    style={styles.input}
                    placeholder={
                      t('auth.enterCompleteCode') || 'Enter the 6-digit code'
                    }
                    placeholderTextColor={COLORS.gray[500]}
                    value={verificationCode}
                    onChangeText={(text) =>
                      setVerificationCode(text.replace(/\D/g, '').slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!codeVerifying && !codeVerified}
                  />
                </View>
              )}

              <View style={styles.noticeBox}>
                <View style={styles.noticeHeader}>
                  <View style={styles.infoIconCircle}>
                    <Icon
                      name="information-circle-outline"
                      size={14}
                      color={COLORS.white}
                    />
                  </View>
                  <Text style={styles.noticeTitle}>
                    {t('auth.nonMemberNoticeTitle')}
                  </Text>
                </View>
                <Text style={styles.bullet}>{`• ${t('auth.nonMemberNotice1')}`}</Text>
                <Text style={styles.bullet}>{`• ${t('auth.nonMemberNotice2')}`}</Text>
                <Text style={styles.bullet}>{`• ${t('auth.nonMemberNotice3')}`}</Text>
                <Text style={styles.privacyFooter}>
                  {t('auth.nonMemberPrivacyFooter')}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!codeVerified || !verifyData) && { opacity: 0.5 },
                ]}
                onPress={handleOrderInquiry}
                activeOpacity={0.9}
                disabled={!codeVerified || !verifyData}
              >
                <Text style={styles.primaryButtonText}>
                  {t('auth.orderInquiry')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerSpacer: { width: 36 },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  titleIconBox: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  fieldBlock: {
    marginBottom: SPACING.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  input: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  countryBox: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.lg,
  },
  countryText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  phoneInput: { flex: 1 },
  verifyButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  verifyButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  noticeBox: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  infoIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  bullet: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: 2,
    lineHeight: 18,
  },
  privacyFooter: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.smmd,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  primaryButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
  },
  // ─── Result view ───
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  resultCount: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  resultRecheck: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.error,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  resultOrderNo: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray[500],
  },
  resultDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray[500],
    marginLeft: SPACING.sm,
  },
  resultBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
  },
  resultMeta: {
    flex: 1,
    minWidth: 0,
  },
  resultSubject: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  resultPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.error,
  },
  resultStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  resultStatus: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 0.5,
  },
});

export default GuestOrderInquiryScreen;
