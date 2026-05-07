import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from '../../../../../components/Icon';
import { BackNavTouchableOpacity } from '../../../../../components/BackNavTouchable';
import type { SellerStackParamList } from '../../../../../types';
import { COLORS } from '../../../../../constants';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { API_BASE_URL } from '../../../../../constants';
import { getStoredToken } from '../../../../../services/authApi';
import { buildSignatureHeaders } from '../../../../../services/signature';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<SellerStackParamList, 'SellerTeamInfo'>;

type Seller = {
  sellerId: string;
  name: string;
  amount: number;
  count: number;
  rebate: number;
};

type SellerTeamInfoProps = {
  embedded?: boolean;
  onEmbeddedBack?: () => void;
};

const SellerTeamInfo: React.FC<SellerTeamInfoProps> = ({ embedded = false, onEmbeddedBack }) => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sellerData, setSellerData] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDirectTeam = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getStoredToken();
        if (!token) {
          throw new Error('Please sign in again.');
        }

        const url = `${API_BASE_URL}/users/seller/direct-team`;
        const signatureHeaders = await buildSignatureHeaders('GET', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...signatureHeaders,
          },
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        const members = Array.isArray(payload?.data?.directTeam) ? payload.data.directTeam : [];
        const normalizedMembers: Seller[] = members.map((member: any, index: number) => ({
          sellerId: String(member?.sellerId || member?.userUniqueId || member?.id || `TEAM-${index + 1}`),
          name: String(member?.userName || member?.name || '-'),
          amount: Number(member?.teamSalesAmountKrw || 0),
          count: Number(member?.teamSalesQuantity || 0),
          rebate: Number(member?.teamRebateNetKrw || 0),
        }));
        setSellerData(normalizedMembers);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load direct team.';
        setError(message);
        setSellerData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirectTeam();
  }, []);

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
  }, [sellerData]);

  const cards = [
    { title: t('sellerInfo.cards.salesAmount'), value: `₩${totals.amount.toLocaleString()}`, text: t('sellerInfo.cards.salesAmountText') },
    { title: t('sellerInfo.cards.orderCount'), value: totals.count.toString(), text: t('sellerInfo.cards.orderCountText') },
    { title: t('sellerInfo.cards.rebateAmount'), value: `₩${totals.rebate.toLocaleString()}`, text: t('sellerInfo.cards.rebateAmountText') },
  ];

  const renderHeader = () => (
    <View style={styles.header}>
      {!embedded || onEmbeddedBack ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (embedded && onEmbeddedBack) {
              onEmbeddedBack();
              return;
            }
            navigation.goBack();
          }}
        >
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
          {isLoading ? <Text style={styles.infoText}>{t('sellerInfo.loadingSummary') || 'Loading summary...'}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!isLoading && !error && sellerData.length === 0 ? (
            <Text style={styles.infoText}>{t('sellerInfo.noData') || 'No direct team data.'}</Text>
          ) : null}

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
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 10,
  },
});

export default SellerTeamInfo;
