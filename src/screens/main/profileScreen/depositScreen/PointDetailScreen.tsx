import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../../components/Icon';
// import { BackNavTouchableOpacity } from '../../../../components/BackNavTouchable';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING } from '../../../../constants';
import { useAppSelector } from '../../../../store/hooks';
import { getTranslation } from '../../../../utils/i18nHelpers';
import { voucherApi } from '../../../../services/voucherApi';
import { useToast } from '../../../../context/ToastContext';

type CouponMainTab = 'coupon' | 'point';

interface PointDetailScreenProps {
  embedded?: boolean;
  onMainTabChange?: (tab: CouponMainTab) => void;
  onEmbeddedBack?: () => void;
}

const PointDetailScreen: React.FC<PointDetailScreenProps> = ({ embedded = false, onMainTabChange, onEmbeddedBack }) => {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const locale = useAppSelector((state) => state.i18n.locale) as 'en' | 'ko' | 'zh';
  const [loading, setLoading] = useState(true);
  const [pointBalance, setPointBalance] = useState(0);

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => {
      let text = getTranslation(key, locale);
      if (typeof text === 'string' && params) {
        Object.entries(params).forEach(([pk, pv]) => {
          text = text.replace(`{${pk}}`, String(pv));
        });
      }
      return text;
    },
    [locale],
  );

  useEffect(() => {
    fetchVoucherWallet();
  }, []);

  const fetchVoucherWallet = async () => {
    try {
      setLoading(true);
      const response = await voucherApi.getVoucherWallet();
      
      if (response.success && response.data) {
        setPointBalance(response.data.points.balance);
      } else {
        showToast(response.message || t('home.failedToLoadPoints'), 'error');
      }
    } catch (error) {
      showToast(t('home.failedToLoadPoints'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const Container = embedded ? View : SafeAreaView;

  return (
    <Container style={styles.container}>
      {(!embedded || onEmbeddedBack) && (
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  if (embedded && onEmbeddedBack) {
                    onEmbeddedBack();
                    return;
                  }
                  (navigation as any).goBack();
                }}
              >
                <Icon name="arrow-back" size={20} color={COLORS.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t('home.voucherWallet')}</Text>
            </View>
            {/* <TouchableOpacity style={styles.menuButton}>
              <Icon name="ellipsis-horizontal" size={24} color={COLORS.text.primary} />
            </TouchableOpacity> */}
          </View>
        </>
      )}

      {/* Tab Navigation - Coupon/Point */}
      <View style={styles.mainTabContainer}>
        <TouchableOpacity 
          style={styles.mainTab}
          onPress={() => {
            if (embedded && onMainTabChange) {
              onMainTabChange('coupon');
              return;
            }
            (navigation as any).navigate('Coupon');
          }}
        >
          <Text style={styles.mainTabText}>{t('home.coupon')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainTab}>
          <Text style={styles.mainTabTextActive}>{t('home.points')}</Text>
          <View style={styles.mainTabIndicator} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Status Tabs */}
          <View style={styles.statusTabContainer}>
            <TouchableOpacity style={[styles.statusTab, styles.statusTabActive]}>
              <Text style={[styles.statusTabText, styles.statusTabTextActive]}>
                {t('home.unused')} (0)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statusTab}>
              <Text style={styles.statusTabText}>
                {t('home.used')} (0)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statusTab}>
              <Text style={styles.statusTabText}>
                {t('home.expired')} (0)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF5500" />
            </View>
          ) : pointBalance > 0 ? (
            /* Point Voucher Card */
            <View style={styles.voucherCard}>
              <View style={styles.voucherTop}>
                <Text style={styles.voucherAmount}>¥{pointBalance}</Text>
                <Text style={styles.voucherCondition}>{t('home.validOnOrdersOver').replace('{amount}', pointBalance.toString())}</Text>
                <Text style={styles.voucherTitle}>{t('home.curatedNewYearVouchers')}</Text>
              </View>
              
              <View style={styles.voucherBottom}>
                {/* <Text style={styles.voucherExpiry}>Valid until 00:00 on January 26, 2026.</Text> */}
                <Text style={styles.voucherValidity}>{t('home.validForEligibleGoods')}</Text>
                <TouchableOpacity>
                  <Text style={styles.viewRulesLink}>{t('home.viewRules').replace('{arrow}', '>')}</Text>
                </TouchableOpacity>
                
              </View>
                <TouchableOpacity style={styles.useNowButton}>
                  <Text style={styles.useNowButtonText}>{t('home.useNow')}</Text>
                </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="wallet-outline" size={80} color="#CCC" />
              <Text style={styles.emptyText}>{t('home.noPointsAvailable')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  mainTab: {
    paddingVertical: SPACING.sm,
    marginRight: SPACING.xl,
    position: 'relative',
  },
  mainTabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '400',
    color: COLORS.text.primary,
  },
  mainTabTextActive: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: '#FF5500',
  },
  mainTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FF5500',
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  statusTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statusTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#0000000D',
    backgroundColor: COLORS.white,
  },
  statusTabActive: {
    borderColor: '#FF5500',
  },
  statusTabText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  statusTabTextActive: {
    color: '#FF5500',
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl * 2,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    marginHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    marginTop: SPACING.lg,
  },
  voucherCard: {
    marginHorizontal: SPACING['3xl'],
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 10,
    borderColor: '#FF0000',
    backgroundColor: '#FF0000'
  },
  voucherTop: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  voucherAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FF0000',
    marginBottom: SPACING.xs,
  },
  voucherCondition: {
    fontSize: FONTS.sizes.sm,
    color: '#FF5500',
    marginBottom: SPACING.sm,
  },
  voucherTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: '#FF0000',
    textAlign: 'center',
  },
  voucherBottom: {
    backgroundColor: '#FF0000',
    paddingTop: SPACING.sm,
    alignItems: 'center',
  },
  voucherExpiry: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  voucherValidity: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  viewRulesLink: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    marginBottom: SPACING.lg,
    textDecorationLine: 'underline',
  },
  useNowButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: SPACING.xl * 2,
    paddingVertical: SPACING.sm,
    // borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#FFFFFF59',
  },
  useNowButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default PointDetailScreen;
