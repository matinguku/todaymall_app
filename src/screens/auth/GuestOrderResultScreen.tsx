import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from '../../components/Icon';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, BACK_NAVIGATION_HIT_SLOP } from '../../constants';
import { AuthStackParamList } from '../../types';
import { useAppSelector } from '../../store/hooks';

type Nav = StackNavigationProp<AuthStackParamList, 'GuestOrderResult'>;
type Rt = RouteProp<AuthStackParamList, 'GuestOrderResult'>;

const formatKrw = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return '-';
  return `${Math.round(Number(n)).toLocaleString('ko-KR')}₩`;
};

const formatDate = (iso: string | undefined): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const STATUS_LABEL: Record<string, string> = {
  BUY_PAY_WAIT: 'Awaiting Payment',
  PAID: 'Paid',
  pending: 'Pending',
  not_warehoused: 'Not Warehoused',
  not_shipped: 'Not Shipped',
};

const prettyStatus = (s: string | undefined) => (s ? STATUS_LABEL[s] || s : '-');

const GuestOrderResultScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';

  const order = route.params?.response?.data?.order;
  const orderAccessToken = route.params?.response?.data?.orderAccessToken as string | undefined;
  const billgate = route.params?.response?.data?.billgatePaymentData;

  const items: any[] = useMemo(() => {
    return Array.isArray(order?.items) ? order.items : [];
  }, [order]);

  const localized = (val: any): string => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    return val[locale] || val.en || val.ko || val.zh || '';
  };

  const handleBack = () => {
    // Per spec: top-left button returns to login.
    navigation.navigate('Login');
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            hitSlop={BACK_NAVIGATION_HIT_SLOP}
            style={styles.backButton}
            onPress={handleBack}
          >
            <Icon name="arrow-back" size={22} color={COLORS.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyWrap}>
          <Icon name="alert-circle-outline" size={36} color={COLORS.text.secondary} />
          <Text style={styles.emptyText}>No order data to display.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ship = order.shippingAddress || {};
  const cost = order.firstTierCost || {};
  const payments: any[] = Array.isArray(order.orderPayments) ? order.orderPayments : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button (top-left → returns to Login) */}
      <View style={styles.header}>
        <TouchableOpacity
          hitSlop={BACK_NAVIGATION_HIT_SLOP}
          style={styles.backButton}
          onPress={handleBack}
        >
          <Icon name="arrow-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero card: order number + status + total */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Order Number</Text>
          <Text style={styles.heroOrderNumber}>{order.orderNumber || order._id}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroRow}>
            <View style={styles.heroCell}>
              <Text style={styles.heroCellLabel}>Status</Text>
              <Text style={styles.heroCellValue}>{prettyStatus(order.progressStatus)}</Text>
            </View>
            <View style={styles.heroCell}>
              <Text style={styles.heroCellLabel}>Payment</Text>
              <Text style={styles.heroCellValue}>{prettyStatus(order.paymentStatus)}</Text>
            </View>
          </View>
          <View style={styles.heroRow}>
            <View style={styles.heroCell}>
              <Text style={styles.heroCellLabel}>Created</Text>
              <Text style={styles.heroCellValue}>{formatDate(order.createdAt)}</Text>
            </View>
            <View style={styles.heroCell}>
              <Text style={styles.heroCellLabel}>Total</Text>
              <Text style={[styles.heroCellValue, styles.heroTotal]}>
                {formatKrw(cost.totalKRW)}
              </Text>
            </View>
          </View>
        </View>

        {/* Shipping address */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Icon name="location-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Shipping Address</Text>
          </View>
          <Text style={styles.shipName}>{ship.recipient || '-'}</Text>
          <Text style={styles.shipLine}>{ship.contact || ''}</Text>
          <Text style={styles.shipLine}>
            {[ship.country, ship.province, ship.city, ship.district].filter(Boolean).join(', ')}
          </Text>
          <Text style={styles.shipLine}>{ship.addressLine1 || ''}</Text>
          {ship.detailedAddress ? (
            <Text style={styles.shipLine}>{ship.detailedAddress}</Text>
          ) : null}
          {ship.zipCode ? (
            <Text style={styles.shipMuted}>Zip: {ship.zipCode}</Text>
          ) : null}
          {ship.personalCustomsCode ? (
            <Text style={styles.shipMuted}>Customs: {ship.personalCustomsCode}</Text>
          ) : null}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Icon name="cube-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Items ({items.length})</Text>
          </View>
          {items.map((it: any, idx: number) => {
            const subject = typeof it.subject === 'object' ? localized(it.subject) : it.subject;
            const company =
              typeof it.companyName === 'object' ? localized(it.companyName) : it.companyName;
            const attrs: any[] = Array.isArray(it.skuAttributes) ? it.skuAttributes : [];
            return (
              <View
                key={`item-${it._id || idx}`}
                style={[styles.itemRow, idx > 0 && styles.itemRowDivider]}
              >
                {it.imageUrl ? (
                  <Image source={{ uri: it.imageUrl }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                    <Icon name="image-outline" size={20} color={COLORS.gray[400]} />
                  </View>
                )}
                <View style={styles.itemBody}>
                  <Text style={styles.itemSubject} numberOfLines={2}>
                    {subject || '-'}
                  </Text>
                  {company ? (
                    <Text style={styles.itemCompany} numberOfLines={1}>
                      {company}
                    </Text>
                  ) : null}
                  {attrs.length > 0 ? (
                    <Text style={styles.itemAttrs} numberOfLines={1}>
                      {attrs
                        .map((a: any) => a.valueTrans || a.value)
                        .filter(Boolean)
                        .join(' / ')}
                    </Text>
                  ) : null}
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemPrice}>{formatKrw(it.userPrice ?? it.salePriceKrw)}</Text>
                    <Text style={styles.itemQty}>× {it.quantity ?? '-'}</Text>
                  </View>
                  {it.trackingNumber ? (
                    <Text style={styles.itemTracking}>Tracking: {it.trackingNumber}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Cost breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Icon name="receipt-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Cost</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Product Total</Text>
            <Text style={styles.costValue}>{formatKrw(cost.productTotalKRW)}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>China Shipping</Text>
            <Text style={styles.costValue}>{formatKrw(cost.chinaShippingKRW)}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Intl. Shipping</Text>
            <Text style={styles.costValue}>{formatKrw(cost.baseInternationalShippingKRW)}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>
              Service Fee {cost.serviceFee ? `(${cost.serviceFee}%)` : ''}
            </Text>
            <Text style={styles.costValue}>{formatKrw(cost.serviceFeeAmountKRW)}</Text>
          </View>
          <View style={styles.costDivider} />
          <View style={styles.costRow}>
            <Text style={styles.costTotalLabel}>Total</Text>
            <Text style={styles.costTotalValue}>{formatKrw(cost.totalKRW)}</Text>
          </View>
        </View>

        {/* Payments */}
        {payments.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Icon name="card-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Payments</Text>
            </View>
            {payments.map((p: any, idx: number) => (
              <View
                key={`pay-${p._id || idx}`}
                style={[styles.payRow, idx > 0 && styles.itemRowDivider]}
              >
                <View style={styles.payLeft}>
                  <Text style={styles.payTier}>{(p.tier || '').toUpperCase()} TIER</Text>
                  <Text style={styles.payMeta}>
                    {(p.paymentMethod || '-')} · {prettyStatus(p.status)}
                  </Text>
                </View>
                <Text style={styles.payAmount}>{formatKrw(p.amountKRW)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Token / Billgate (debug-ish, but visible so the user can verify) */}
        {orderAccessToken ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Icon name="key-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Access</Text>
            </View>
            <Text style={styles.tokenLabel}>Order Access Token</Text>
            <Text style={styles.tokenValue} numberOfLines={3}>
              {orderAccessToken}
            </Text>
            {billgate?.AMOUNT ? (
              <Text style={styles.shipMuted}>
                Billgate amount: {formatKrw(Number(billgate.AMOUNT))}
              </Text>
            ) : null}
          </View>
        ) : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
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
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  heroLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  heroOrderNumber: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  heroDivider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: SPACING.md,
  },
  heroRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heroCell: {
    flex: 1,
  },
  heroCellLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  heroCellValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  heroTotal: {
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  shipName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  shipLine: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  shipMuted: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  itemRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[200],
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemSubject: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  itemCompany: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  itemAttrs: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  itemPrice: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemQty: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  itemTracking: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  costLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  costValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  costDivider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: SPACING.sm,
  },
  costTotalLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  costTotalValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  payLeft: {
    flex: 1,
    minWidth: 0,
  },
  payTier: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  payMeta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    marginTop: 2,
  },
  payAmount: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  tokenLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  tokenValue: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.primary,
    fontFamily: 'monospace',
  },
});

export default GuestOrderResultScreen;
