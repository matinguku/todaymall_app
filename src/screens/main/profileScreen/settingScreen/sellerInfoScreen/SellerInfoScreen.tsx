import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from '../../../../../components/Icon';
import { RootStackParamList } from '../../../../../types';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, BACK_NAVIGATION_HIT_SLOP } from '../../../../../constants';
import { useTranslation } from '../../../../../hooks/useTranslation';

type SellerInfoNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const SellerInfoScreen: React.FC = () => {
  const navigation = useNavigation<SellerInfoNavigationProp>();
  const { t } = useTranslation();

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('sellerInfoScreen.title')}</Text>
      <View style={styles.headerRight} />
    </View>
  );

  const links: {
    labelKey: string;
    route: 'SellerPage' | 'SellerSalesRefundInfo' | 'SellerTeamInfo';
  }[] = [
    { labelKey: 'sellerInfoScreen.linkDashboard', route: 'SellerPage' },
    { labelKey: 'sellerInfoScreen.linkOrdersRefunds', route: 'SellerSalesRefundInfo' },
    { labelKey: 'sellerInfoScreen.linkTeam', route: 'SellerTeamInfo' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('sellerInfoScreen.intro')}</Text>

        <View style={styles.links}>
          {links.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              style={[
                styles.linkRow,
                index === links.length - 1 && styles.linkRowLast,
              ]}
              onPress={() => navigation.navigate(item.route as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>{t(item.labelKey)}</Text>
              <Icon name="chevron-forward" size={20} color={COLORS.text.secondary} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerRight: {
    width: 32,
    height: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  intro: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  links: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
});

export default SellerInfoScreen;
