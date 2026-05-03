import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../../components/Icon';
import { BackNavTouchableOpacity } from '../../../../components/BackNavTouchable';
import { useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { COLORS, FONTS, SPACING, SERVER_BASE_URL, IMAGE_CONFIG } from '../../../../constants';
import { useAuth } from '../../../../context/AuthContext';
import { useAppSelector } from '../../../../store/hooks';
import { translations } from '../../../../i18n/translations';
import ShareCardIcon from '../../../../assets/icons/ShareCardIcon';
import QRCodeIcon from '../../../../assets/icons/QRCodeIcon';
import AttachmantIcon from '../../../../assets/icons/AttachmantIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AffiliateMarketingScreenProps = {
  embedded?: boolean;
  onEmbeddedBack?: () => void;
};

const AffiliateMarketingScreen: React.FC<AffiliateMarketingScreenProps> = ({ embedded = false, onEmbeddedBack }) => {
  const navigation = useNavigation();
  const locale = useAppSelector((state) => state.i18n.locale) as 'en' | 'ko' | 'zh';
  const { user } = useAuth();
  const qrRef = useRef<any>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const t = (key: string, params?: { [key: string]: string }) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    if (params && typeof value === 'string') {
      Object.keys(params).forEach(paramKey => {
        value = value.replace(`{${paramKey}}`, params[paramKey]);
      });
    }
    return value || key;
  };

  const affiliateCode = user?.referralCode || user?.userUniqueId || 'TM1';
  const relatedUsers = user?.referredCount || 0;
  const income = '0.00';
  const referralLink = `https://todaymall.co.kr/ko/register?promo_code=${affiliateCode}`;
  const userName = user?.userName || user?.name || 'User';

  const handleCopyCode = async () => {
    try {
      Clipboard.setString(affiliateCode);
      Alert.alert(t('shareApp.success'), t('profile.invitationCodeCopied'));
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToCopyCode'));
    }
  };

  const handleCopyLink = async () => {
    try {
      Clipboard.setString(referralLink);
      Alert.alert(t('shareApp.success'), t('profile.linkCopied'));
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToCopyCode'));
    }
  };

  const handleShareQR = async () => {
    try {
      await Share.share({
        message: t('profile.joinTodayMall', { code: affiliateCode }) + '\n' + referralLink,
        title: t('profile.shareInvitationCode'),
      });
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToShare'));
    }
  };

  const requestSavePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const sdkInt = Platform.Version;
    if (typeof sdkInt === 'number' && sdkInt >= 29) return true; // Scoped storage, no permission needed
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: t('profile.saveImage'),
        message: t('profile.photoLibraryPermissionRequired'),
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleDownloadQR = async () => {
    try {
      const hasPermission = await requestSavePermission();
      if (!hasPermission) {
        Alert.alert(t('common.error'), t('profile.cameraPermissionRequired'));
        return;
      }
      if (!viewShotRef.current?.capture) {
        Alert.alert(t('common.error'), t('profile.failedToSaveImage'));
        return;
      }
      const uri = await viewShotRef.current.capture();
      await CameraRoll.saveAsset(uri, { type: 'photo' });
      Alert.alert(t('shareApp.success'), t('profile.saveImage') + ' ✓');
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToSaveImage'));
    }
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: t('profile.joinTodayMall', { code: affiliateCode }) + '\n' + referralLink,
        title: t('profile.shareInvitationCode'),
      });
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToShare'));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
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
            <Icon name="arrow-back" size={16} color={COLORS.text.primary} />
          </BackNavTouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        <Text style={styles.headerTitle}>{t('profile.affiliateMarketing')}</Text>
        {/* <TouchableOpacity style={styles.eventRuleButton}>
          <Text style={styles.eventRuleText}>{t('profile.eventRule')}</Text>
        </TouchableOpacity> */}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileLeft}>
            <Image
              source={
                user?.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== ''
                  ? { uri: user.avatar }
                  : require('../../../../assets/images/avatar.png')
              }
              style={styles.profileAvatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName}</Text>
              <View style={styles.profileMeta}>
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeText}>
                    {t('profile.memberId')}: {affiliateCode}
                  </Text>
                </View>
                <View style={styles.metaBadge}>
                  <Icon name="people-outline" size={12} color={COLORS.red} />
                  <Text style={styles.metaBadgeText}>
                    {t('profile.myReferrals')}: {relatedUsers}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.incomeSection}>
            <Text style={styles.incomeLabel}>{t('profile.totalIncome')}:</Text>
            <Text style={styles.incomeValue}>{income}</Text>
            <Text style={styles.incomeApprox}>(≈0)</Text>
          </View>
        </View>

        {/* Revenue Calculation Info Box */}
        <View style={styles.revenueBox}>
          <View style={styles.revenueHeader}>
            {/* <Icon name="calculator" size={20} color="#FF6B00" /> */}
            <Text style={styles.revenueTitle}>{t('profile.revenueCalculation')}</Text>
          </View>
          <Text style={styles.revenueDesc}>{t('profile.revenueDesc')}</Text>
        </View>

        {/* Invite Now Section */}
        <View style={styles.inviteSection}>
          <Text style={styles.inviteSectionTitle}>{t('profile.inviteNow')}</Text>
          <Text style={styles.inviteSectionDesc}>{t('profile.inviteNowDesc')}</Text>
        </View>

        {/* Three Invite Method Cards */}
        <View style={styles.cardsRow}>
          {/* Card 1: Share Member ID */}
          <View style={styles.inviteCard}>
            <View style={styles.cardIconContainer}>
              <ShareCardIcon width={28} color={COLORS.red} />
            </View>
            <Text style={styles.cardTitle}>{t('profile.shareMemberId')}</Text>
            <Text style={styles.cardDesc}>{t('profile.shareMemberIdDesc')}</Text>
            <View style={styles.codeDisplayBox}>
              <Text style={styles.codeDisplayText}>{affiliateCode}</Text>
            </View>
            <TouchableOpacity style={styles.primaryActionBtn} onPress={handleCopyCode}>
              {/* <Icon name="copy-outline" size={16} color={COLORS.white} /> */}
              <Text style={styles.primaryActionText}>{t('profile.copyCode')}</Text>
            </TouchableOpacity>
          </View>

          {/* Card 2: Share QR Code */}
          <View style={styles.inviteCard}>
            <View style={styles.cardIconContainer}>
              <QRCodeIcon width={28} color={COLORS.red} />
            </View>
            <Text style={styles.cardTitle}>{t('profile.shareQrCode')}</Text>
            <Text style={styles.cardDesc}>{t('profile.shareQrCodeDesc')}</Text>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: IMAGE_CONFIG.QUALITY }}
            >
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={referralLink}
                  size={120}
                  backgroundColor={COLORS.white}
                  color={COLORS.text.primary}
                  getRef={(ref: any) => (qrRef.current = ref)}
                />
              </View>
            </ViewShot>
            <View style={styles.qrButtonRow}>
              <TouchableOpacity style={styles.qrActionBtn} onPress={handleShareQR}>
                <Icon name="share-social-outline" size={14} color={COLORS.white} />
                <Text style={styles.qrActionText}>{t('profile.share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.qrActionBtnOutline} onPress={handleDownloadQR}>
                <Icon name="download-outline" size={14} color={COLORS.red} />
                <Text style={styles.qrActionTextOutline}>{t('profile.download')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card 3: Share Referral Link */}
          <View style={styles.inviteCard}>
            <View style={styles.cardIconContainer}>
              <AttachmantIcon width={28} color={COLORS.red} />
            </View>
            <Text style={styles.cardTitle}>{t('profile.shareReferralLink')}</Text>
            <Text style={styles.cardDesc}>{t('profile.shareReferralLinkDesc')}</Text>
            <View style={styles.linkDisplayBox}>
              <Text style={styles.linkDisplayText} numberOfLines={2}>
                {referralLink}
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryActionBtn} onPress={handleCopyLink}>
              {/* <Icon name="copy-outline" size={16} color={COLORS.white} /> */}
              <Text style={styles.primaryActionText}>{t('profile.copyLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 24,
    height: 24,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  eventRuleButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  eventRuleText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING['3xl'],
  },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.red,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  profileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightRed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  metaBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.red,
    fontWeight: '500',
  },
  incomeSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  incomeLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  incomeValue: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  incomeApprox: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
  },

  // Revenue Info Box
  revenueBox: {
    backgroundColor: COLORS.lightRed,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  revenueTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.red,
  },
  revenueDesc: {
    fontSize: FONTS.sizes.xs,
    color: '#8B5E3C',
    lineHeight: 18,
  },

  // Invite Section
  inviteSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  inviteSectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  inviteSectionDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },

  // Invite Cards
  cardsRow: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  inviteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  cardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.lightRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },

  // Code Display
  codeDisplayBox: {
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.red,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderStyle: 'dashed',
  },
  codeDisplayText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: COLORS.text.primary,
    letterSpacing: 1,
  },

  // Link Display
  linkDisplayBox: {
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.red,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderStyle: 'dashed',
  },
  linkDisplayText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    textAlign: 'center',
  },

  // QR Code
  qrCodeWrapper: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    marginBottom: SPACING.md,
  },
  qrButtonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  qrActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.red,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  qrActionText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  qrActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    gap: 5,
  },
  qrActionTextOutline: {
    color: COLORS.red,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },

  // Action Buttons
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.red,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 6,
    width: '100%',
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
});

export default AffiliateMarketingScreen;
