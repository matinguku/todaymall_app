import React, { useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from '../../../../../components/Icon';
import { RootStackParamList } from '../../../../../types';
import { COLORS } from '../../../../../constants';
import { useTranslation } from '../../../../../hooks/useTranslation';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList, 'SellerPage'>;

type Seller = {
  sellerId: string;
  name: string;
  amount: number;
  count: number;
  rebate: number;
  isActive: boolean;
};

type ChartItem = {
  label: string;
  value: number;
  color: string;
};

const donutData: ChartItem[] = [
  { label: 'so ul', value: 25, color: '#4A6CF7' },
  { label: 'gyong gi do', value: 30, color: '#FF7A00' },
  { label: 'bu san', value: 25, color: '#00C48C' },
  { label: 'dae jon', value: 5, color: '#FF5DA2' },
  { label: 'other', value: 15, color: '#A66CFF' },
];

const barData1: ChartItem[] = [
  { label: 'PC', value: 40, color: '#4A6CF7' },
  { label: 'APP', value: 30, color: '#FF5DA2' },
  { label: 'Mobile', value: 30, color: '#00C48C' },
];

const barData2: ChartItem[] = [
  { label: 'Link', value: 35, color: '#4A6CF7' },
  { label: 'out search', value: 40, color: '#FF5DA2' },
  { label: 'flate homme', value: 25, color: '#00C48C' },
];

const SellerPage: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [sellerInfos, setSellerInfos] = useState<Seller[]>([
    { sellerId: 'S001', name: 'John Kim', amount: 120000, count: 12, rebate: 5000, isActive: false },
    { sellerId: 'S002', name: 'Alice Lee', amount: 80000, count: 8, rebate: 3000, isActive: false },
    { sellerId: 'S003', name: 'David Park', amount: 150000, count: 15, rebate: 7000, isActive: false },
    { sellerId: 'S004', name: 'Emma Choi', amount: 50000, count: 5, rebate: 2000, isActive: false },
  ]);

  const cards = [
    { title: t('sellerInfo.cards.salesAmount'), value: '0', text: t('sellerInfo.cards.salesAmountText') },
    { title: t('sellerInfo.cards.orderCount'), value: '0', text: t('sellerInfo.cards.orderCountText') },
    { title: t('sellerInfo.cards.rebateAmount'), value: '0', text: t('sellerInfo.cards.rebateAmountText') },
    { title: t('sellerInfo.cards.pendingSettlement'), value: '0', text: t('sellerInfo.cards.pendingSettlementText') },
    { title: t('sellerInfo.cards.monthlySales'), value: '0', text: t('sellerInfo.cards.monthlySalesText') },
    { title: t('sellerInfo.cards.monthlyOrders'), value: '0', text: t('sellerInfo.cards.monthlyOrdersText') },
    { title: t('sellerInfo.cards.monthlyRebate'), value: '0', text: t('sellerInfo.cards.monthlyRebateText') },
    { title: t('sellerInfo.cards.averageOrderValue'), value: '0', text: t('sellerInfo.cards.averageOrderValueText') },
    { title: t('sellerInfo.cards.activeSellers'), value: '0', text: t('sellerInfo.cards.activeSellersText') },
    { title: t('sellerInfo.cards.rebateRate'), value: '0%', text: t('sellerInfo.cards.rebateRateText') },
  ];

  const getCardColor = (i: number) => {
    if (i === 0) return '#1e90ff';
    if (i === 1) return '#28a745';
    if (i === 2) return '#1e90ff';
    if (i === 3) return '#28a745';
    if (i === 4) return '#1e90ff';
    if (i === 5) return '#28a745';
    if (i === 6) return '#1e90ff';
    if (i === 7) return '#28a745';
    if (i === 8) return '#1e90ff';
    return '#28a745';
  };

  const handleToggleSeller = (sellerId: string) => {
    setSellerInfos((prev) =>
      prev.map((item) =>
        item.sellerId === sellerId
          ? { ...item, isActive: !item.isActive }
          : { ...item, isActive: false }
      )
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('sellerInfo.dashboardTitle')}</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const DonutChart: React.FC<{ data: ChartItem[] }> = ({ data }) => {
    const size = 130;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    return (
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const dash = (item.value / 100) * circumference;
          const strokeDasharray = `${dash} ${circumference}`;
          const strokeDashoffset = -cumulative * circumference;
          cumulative += item.value / 100;

          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={item.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth / 2}
          fill="#fff"
        />
      </Svg>
    );
  };

  const LegendList: React.FC<{ data: ChartItem[] }> = ({ data }) => (
    <View style={styles.legendContainer}>
      {data.map((item, index) => (
        <View key={index} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
          <Text style={styles.legendValue}>{item.value}%</Text>
        </View>
      ))}
    </View>
  );

  const StackedBar: React.FC<{ data: ChartItem[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <View style={styles.barContainer}>
        {data.map((item, index) => (
          <View key={index} style={{ flex: item.value / total, backgroundColor: item.color }} />
        ))}
      </View>
    );
  };

  const renderCards = () => (
    <View style={styles.cardContainer}>
      {cards.map((card, index) => (
        <View key={index} style={[styles.card, { backgroundColor: getCardColor(index) }]}>
          <Text style={styles.cardValue}>{card.value}</Text>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.cardText}>{card.text}</Text>
        </View>
      ))}
    </View>
  );

  const renderSellerList = () => (
    <View style={styles.listContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('sellerInfo.team.sectionTitle')}</Text>
        <TouchableOpacity
          style={styles.sectionButton}
          onPress={() => navigation.navigate('SellerTeamInfo')}
        >
          <Text style={styles.sectionButtonText}>Seller Team Info</Text>
        </TouchableOpacity>
      </View>
      {sellerInfos.map((seller) => (
        <TouchableOpacity key={seller.sellerId} onPress={() => handleToggleSeller(seller.sellerId)}>
          <View style={styles.sellerRow}>
            <Text style={styles.sellerLabel}>{t('sellerInfo.sellerIdLabel')}</Text>
            <Text style={styles.sellerValue}>{seller.sellerId}</Text>
          </View>
          {seller.isActive && (
            <View style={styles.sellerDetails}>
              <Text style={styles.detailRow}>{t('sellerInfo.sellerDetails.name')}: {seller.name}</Text>
              <Text style={styles.detailRow}>{t('sellerInfo.sellerDetails.amount')}: {seller.amount.toLocaleString()}</Text>
              <Text style={styles.detailRow}>{t('sellerInfo.sellerDetails.count')}: {seller.count}</Text>
              <Text style={styles.detailRow}>{t('sellerInfo.sellerDetails.rebate')}: {seller.rebate.toLocaleString()}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
       <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderCards()}
        {renderSellerList()}
       <View>
        <Text>{t('sellerInfo.performanceTitle')}</Text>
       </View>
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>{t('sellerInfo.chartSubtitle')}</Text>
          <View style={styles.topRow}>
            <View style={styles.chartBox}>
              <DonutChart data={donutData} />
            </View>
            <LegendList data={donutData} />
          </View>
          <Text style={styles.sectionSubtitle}>{t('sellerInfo.performanceTitle')}</Text>
          <LegendList data={barData1} />
          <StackedBar data={barData1} />
          <LegendList data={barData2} />
          <StackedBar data={barData2} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f9',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dashboardSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartBox: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1e90ff',
  },
  sectionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 10,
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 0,
  },
  card: {
    width: (width - 48) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    marginTop: 8,
  },
  cardText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
  },
  cardValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sellerLabel: {
    fontWeight: '700',
  },
  sellerValue: {
    color: '#111827',
    fontWeight: '600',
  },
  sellerDetails: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 10,
    marginTop: 8,
  },
  detailRow: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  legendContainer: {
    flex: 1,
    marginLeft: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  legendValue: {
    fontSize: 13,
    color: '#6B7280',
  },
  barContainer: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
});

export default SellerPage;
