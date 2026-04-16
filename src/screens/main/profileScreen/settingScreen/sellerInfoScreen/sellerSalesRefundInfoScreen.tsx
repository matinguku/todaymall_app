import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from '../../../../../components/Icon';
import { RootStackParamList } from '../../../../../types';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useSellerDashboardMutation } from '../../../../../hooks/useSellerDashboardMutation';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../../../../constants';

type NavigationProp = StackNavigationProp<RootStackParamList, 'SellerSalesRefundInfo'>;

type SellerDashboardMode = 'profit' | 'refund';

type SellerDashboardItem = {
  firstTierPaidAt: string;
  orderNumber: string;
  orderId: string;
  productNumber: string;
  quantity: number;
  recipient: string;
  paidAmountKrw: number;
  rebateKrw: number;
  trackingNumber: string | null;
  liveCodeSnapshot: string;
};

const SellerSalesRefundInfoScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const revenueTab = t('sellerInfo.orderData.revenueTab');
  const refundTab = t('sellerInfo.orderData.refundTab');
  const [activeTab, setActiveTab] = useState<'revenue' | 'refund'>('revenue');
  const [searchText, setSearchText] = useState<string>('');
  const [pageSize] = useState<number>(20);
  const [startDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate] = useState<Date>(new Date());

  const {
    mutate: fetchDashboard,
    items,
    total,
    page: currentPage,
    pageSize: currentPageSize,
    isLoading,
    isLoadingMore,
    isError,
    error,
  } = useSellerDashboardMutation();

  const formatDate = (date: Date) => date.toLocaleDateString('en-US');
  const formatApiDate = (date: Date) => date.toISOString().split('T')[0];

  const loadDashboard = useCallback(
    async (nextPage: number = 1) => {
      await fetchDashboard({
        search: searchText.trim() || undefined,
        from: formatApiDate(startDate),
        to: formatApiDate(endDate),
        mode: activeTab === 'revenue' ? 'profit' : 'refund',
        page: nextPage,
        pageSize,
      });
    },
    [activeTab, fetchDashboard, pageSize, searchText, startDate, endDate]
  );

  useEffect(() => {
    loadDashboard(1);
  }, [activeTab, loadDashboard]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('sellerInfo.SellerSalesRefundInfo')}</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderTabs = () => (
    <View style={styles.switchRow}>
      <TouchableOpacity
        style={[styles.switchButton, activeTab === 'revenue' && styles.switchButtonActive]}
        onPress={() => setActiveTab('revenue')}
      >
        <Text style={[styles.switchText, activeTab === 'revenue' && styles.switchTextActive]}>
          {revenueTab}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.switchButton, activeTab === 'refund' && styles.switchButtonActive]}
        onPress={() => setActiveTab('refund')}
      >
        <Text style={[styles.switchText, activeTab === 'refund' && styles.switchTextActive]}>
          {refundTab}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchRow = () => (
    <View style={styles.searchRow}>
      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder={t('sellerInfo.orderData.searchPlaceholder')}
        placeholderTextColor={COLORS.text.secondary}
        style={styles.searchInput}
      />
      <TouchableOpacity style={styles.searchBtn} onPress={() => {
        loadDashboard(1);
      }}>
        <Text style={styles.searchBtnText}>{t('sellerInfo.orderData.searchButton')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDateRow = () => (
    <View style={styles.dateRow}>
      <View style={styles.dateGroup}>
        <Text style={styles.dateLabel}>{t('sellerInfo.orderData.dateRangeLabel')}</Text>
        <View style={styles.dateInputs}>
          <TouchableOpacity style={styles.dateInput}>
            <Text style={styles.dateText}>{formatDate(startDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateDivider}>-</Text>
          <TouchableOpacity style={styles.dateInput}>
            <Text style={styles.dateText}>{formatDate(endDate)}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={styles.dateSearchBtn}
        onPress={() => {
          loadDashboard(1);
        }}
      >
        <Text style={styles.dateSearchBtnText}>{t('sellerInfo.orderData.dateSearchButton')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTable = () => (
    <View style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.tableHeaderCell]}>
          {t('sellerInfo.orderData.table.paymentDate')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell]}>
          {t('sellerInfo.orderData.table.orderNumber')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell]}>
          {t('sellerInfo.orderData.table.productName')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell]}>
          {t('sellerInfo.orderData.table.quantity')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell]}>
          {t('sellerInfo.orderData.table.recipient')}
        </Text>
      </View>

      {isLoading && !isLoadingMore ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : isError ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{error || 'Failed to load seller data.'}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('sellerInfo.orderData.table.noData')}</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.orderId} style={styles.tableRow}>
            <Text style={styles.tableCell}>{formatDate(new Date(item.firstTierPaidAt))}</Text>
            <Text style={styles.tableCell}>{item.orderNumber}</Text>
            <Text style={styles.tableCell}>{item.productNumber}</Text>
            <Text style={styles.tableCell}>{item.quantity}</Text>
            <Text style={styles.tableCell}>{item.recipient}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('sellerInfo.orderData.table.paymentAmount')}:</Text>
              <Text style={styles.detailValue}>₩{item.paidAmountKrw.toLocaleString()}</Text>
              <Text style={styles.detailLabel}>{t('sellerInfo.orderData.table.rebate')}:</Text>
              <Text style={styles.detailValue}>₩{item.rebateKrw.toLocaleString()}</Text>
              <Text style={styles.detailLabel}>{t('sellerInfo.orderData.table.tracking')}:</Text>
              <Text style={styles.detailValue}>{item.trackingNumber || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Live Code:</Text>
              <Text style={styles.detailValue}>{item.liveCodeSnapshot || '-'}</Text>
            </View>
          </View>
        ))
      )}

      {items.length > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{`Total ${total} items`}</Text>
          {currentPage * currentPageSize < total && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => {
                const nextPage = currentPage + 1;
                loadDashboard(nextPage);
              }}
            >
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>{t('sellerInfo.Seller.title')}</Text>
            <Text style={styles.subTitle}>{t('sellerInfo.orderData.subtitle')}</Text>
          </View>
          {renderTabs()}
        </View>
        {renderSearchRow()}
        {renderDateRow()}
        {renderTable()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SellerSalesRefundInfoScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  headerTop: {
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  subTitle: {
    color: COLORS.text.secondary,
    fontSize: FONTS.sizes.sm,
  },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.xl,
    padding: 4,
  },
  switchButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
  },
  switchButtonActive: {
    backgroundColor: COLORS.primary,
  },
  switchText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  switchTextActive: {
    color: COLORS.white,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  searchBtn: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  dateGroup: {
    flex: 1,
  },
  dateLabel: {
    color: COLORS.text.secondary,
    marginBottom: SPACING.xssm,
    fontSize: FONTS.sizes.sm,
  },
  dateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    minWidth: 110,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  dateText: {
    color: COLORS.text.primary,
    fontSize: FONTS.sizes.sm,
  },
  dateDivider: {
    marginHorizontal: SPACING.sm,
    color: COLORS.text.secondary,
  },
  dateSearchBtn: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSearchBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONTS.sizes.sm,
  },
  tableCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  tableHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.sm,
  },
  tableCell: {
    width: '50%',
    marginBottom: SPACING.xssm,
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
  },
  tableHeaderCell: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  summaryText: {
    color: COLORS.text.secondary,
    fontSize: FONTS.sizes.sm,
  },
  loadMoreBtn: {
    paddingVertical: SPACING.xssm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  loadMoreText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.xssm,
    alignItems: 'center',
  },
  detailLabel: {
    color: COLORS.text.secondary,
    marginRight: SPACING.xssm,
    fontSize: FONTS.sizes.xs,
  },
  detailValue: {
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
});