import React, { useMemo, useState } from 'react';
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
import type { SellerStackParamList } from '../../../../../types';
import { COLORS } from '../../../../../constants';
import { useTranslation } from '../../../../../hooks/useTranslation';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<SellerStackParamList, 'SellerTeamInfo'>;

type Seller = {
  sellerId: string;
  name: string;
  amount: number;
  count: number;
  rebate: number;
};

const sellerData: Seller[] = [
  { sellerId: 'S001', name: 'John Kim', amount: 120000, count: 12, rebate: 5000 },
  { sellerId: 'S002', name: 'Alice Lee', amount: 80000, count: 8, rebate: 3000 },
  { sellerId: 'S003', name: 'David Park', amount: 150000, count: 15, rebate: 37000 },
  { sellerId: 'S004', name: 'Emma Choi', amount: 50000, count: 5, rebate: 22000 },
  { sellerId: 'S005', name: 'ri song il', amount: 20000, count: 25, rebate: 12000 },
  { sellerId: 'S006', name: 'gum hyok', amount: 30000, count: 35, rebate: 3000 },
  { sellerId: 'S007', name: 'rim jong hyok', amount: 40000, count: 2, rebate: 4000 },
  { sellerId: 'S008', name: 'kim jin song', amount: 70000, count: 4, rebate: 5000 },
  { sellerId: 'S009', name: 'ri sin hyok', amount: 60000, count: 6, rebate: 6000 },
  { sellerId: 'S010', name: 'jang sung hyok', amount: 90000, count: 7, rebate: 6000 },
  { sellerId: 'S011', name: 'o ryong bom', amount: 10000, count: 8, rebate: 7000 },
  { sellerId: 'S012', name: 'kim ju song', amount: 250000, count: 9, rebate: 8000 },
  { sellerId: 'S013', name: 'hyon rim il', amount: 20000, count: 33, rebate: 9000 },
];

type SellerTeamInfoProps = {
  embedded?: boolean;
};

const SellerTeamInfo: React.FC<SellerTeamInfoProps> = ({ embedded = false }) => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totals = useMemo(() => {
    return sellerData.reduce(
      (acc, s) => {
        acc.amount += s.amount;
        acc.count += s.count;
        acc.rebate += s.rebate;
        return acc;
      },
      { amount: 0, count: 0, rebate: 0 }
    );
  }, []);

  const cards = [
    { title: t('sellerInfo.cards.salesAmount'), value: `₩${totals.amount.toLocaleString()}`, text: t('sellerInfo.cards.salesAmountText') },
    { title: t('sellerInfo.cards.orderCount'), value: totals.count.toString(), text: t('sellerInfo.cards.orderCountText') },
    { title: t('sellerInfo.cards.rebateAmount'), value: `₩${totals.rebate.toLocaleString()}`, text: t('sellerInfo.cards.rebateAmountText') },
  ];

  const renderHeader = () => (
    <View style={styles.header}>
      {!embedded ? (
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerPlaceholder} />
      )}
      <Text style={styles.headerTitle}>{t('sellerInfo.dashboardTitle')}</Text>
      <View style={styles.headerPlaceholder} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.cardContainer}>
          {cards.map((card, index) => (
            <View key={index} style={[styles.card, { backgroundColor: getCardColor(index) }]}>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardText}>{card.text}</Text>
            </View>
          ))}
        </View>

        {/* Seller List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>{t('sellerInfo.team.sectionTitle')}</Text>

          {sellerData.map((seller) => {
            const isOpen = selectedId === seller.sellerId;

            return (
              <TouchableOpacity
                key={seller.sellerId}
                activeOpacity={0.8}
                onPress={() =>
                  setSelectedId((prev) =>
                    prev === seller.sellerId ? null : seller.sellerId
                  )
                }
              >
                <View style={[styles.sellerCard, isOpen && styles.activeCard]}>
                  <View style={styles.sellerHeader}>
                    <View>
                      <Text style={styles.sellerName}>{seller.name}</Text>
                      <Text style={styles.sellerSubText}>
                        {t('sellerInfo.sellerIdLabel')}: {seller.sellerId} | {t('sellerInfo.sellerDetails.count')}: {seller.count}
                      </Text>
                    </View>
                    <Icon
                      name={isOpen ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color="#1e90ff"
                    />
                  </View>

                  {isOpen && (
                    <View style={styles.detailsContainer}>
                      <View style={styles.row}>
                        <Text style={styles.label}>{t('sellerInfo.sellerDetails.amount')}</Text>
                        <Text style={styles.value}>₩{seller.amount.toLocaleString()}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>{t('sellerInfo.sellerDetails.count')}</Text>
                        <Text style={styles.value}>{seller.count}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>{t('sellerInfo.sellerDetails.rebate')}</Text>
                        <Text style={styles.value}>₩{seller.rebate.toLocaleString()}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getCardColor = (i: number) => {
  if (i === 0) return '#1e90ff';
  if (i === 1) return '#28a745';
  return '#00bcd4';
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: 32,
    height: 32,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
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
    fontSize: 13,
    marginTop: 8,
  },

  cardValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },

  listContainer: {
    paddingHorizontal: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  sellerCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    
  },

  activeCard: {
    borderColor: '#1e90ff',
    borderWidth: 1,
  },

  sellerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sellerName: {
    fontWeight: 'bold',
    fontSize: 16,
  },

  sellerSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  detailsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  label: {
    color: COLORS.red,
  },

  value: {
    fontWeight: 'bold',
  },
});

export default SellerTeamInfo;
