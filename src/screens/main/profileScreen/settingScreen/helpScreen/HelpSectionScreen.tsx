import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from '../../../../../components/Icon';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../../constants';
import { RootStackParamList } from '../../../../../types';
import { useAppSelector } from '../../../../../store/hooks';
import { translations } from '../../../../../i18n/translations';

type HelpSectionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpSection'>;
type HelpSectionScreenRouteProp = RouteProp<RootStackParamList, 'HelpSection'>;

interface Article {
  id: string;
  title: string;
  description: string;
}

const HelpSectionScreen: React.FC = () => {
  const navigation = useNavigation<HelpSectionScreenNavigationProp>();
  const route = useRoute<HelpSectionScreenRouteProp>();
  const { section, title } = route.params;
  const locale = useAppSelector((state) => state.i18n.locale);
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  // Mock articles for each section
  const getArticles = (sectionType: string): Article[] => {
    switch (sectionType) {
      case 'must-read':
        return [
          { id: '1', title: t('helpCenter.articles.termsOfUse'), description: t('helpCenter.articles.termsOfUseDesc') },
          { id: '2', title: t('helpCenter.articles.serviceIntroduction'), description: t('helpCenter.articles.serviceIntroductionDesc') },
          { id: '3', title: t('helpCenter.articles.privacyPolicy'), description: t('helpCenter.articles.privacyPolicyDesc') },
          { id: '4', title: t('helpCenter.articles.returnRefundPolicy'), description: t('helpCenter.articles.returnRefundPolicyDesc') },
        ];
      case 'user-guide':
        return [
          { id: '5', title: t('helpCenter.userGuideItems.memberGrade'), description: t('helpCenter.userGuideItems.memberGradeDesc') },
          { id: '6', title: t('helpCenter.userGuideItems.affiliateMarketing'), description: t('helpCenter.userGuideItems.affiliateMarketingDesc') },
          { id: '7', title: t('helpCenter.userGuideItems.sizeGuide'), description: t('helpCenter.userGuideItems.sizeGuideDesc') },
          { id: '8', title: t('helpCenter.userGuideItems.customerProtection'), description: t('helpCenter.userGuideItems.customerProtectionDesc') },
          { id: '9', title: t('helpCenter.userGuideItems.freeMembership'), description: t('helpCenter.userGuideItems.freeMembershipDesc') },
          { id: '10', title: t('helpCenter.userGuideItems.marketingConsent'), description: t('helpCenter.userGuideItems.marketingConsentDesc') },
          { id: '11', title: t('helpCenter.userGuideItems.prepurchaseTerms'), description: t('helpCenter.userGuideItems.prepurchaseTermsDesc') },
          { id: '12', title: t('helpCenter.userGuideItems.registrationProtocol'), description: t('helpCenter.userGuideItems.registrationProtocolDesc') },
          { id: '13', title: t('helpCenter.userGuideItems.disclaimer'), description: t('helpCenter.userGuideItems.disclaimerDesc') },
          { id: '14', title: t('helpCenter.userGuideItems.gettingHelp'), description: t('helpCenter.userGuideItems.gettingHelpDesc') },
          { id: '15', title: t('helpCenter.userGuideItems.beginnerTutorial'), description: t('helpCenter.userGuideItems.beginnerTutorialDesc') },
          { id: '16', title: t('helpCenter.userGuideItems.aftersalesService'), description: t('helpCenter.userGuideItems.aftersalesServiceDesc') },
          { id: '17', title: t('helpCenter.userGuideItems.departurePoints'), description: t('helpCenter.userGuideItems.departurePointsDesc') },
          { id: '18', title: t('helpCenter.userGuideItems.dailyTax'), description: t('helpCenter.userGuideItems.dailyTaxDesc') },
          { id: '19', title: t('helpCenter.userGuideItems.dailyLogistics'), description: t('helpCenter.userGuideItems.dailyLogisticsDesc') },
          { id: '20', title: t('helpCenter.userGuideItems.serviceTerms'), description: t('helpCenter.userGuideItems.serviceTermsDesc') },
          { id: '21', title: t('helpCenter.userGuideItems.returnExchange'), description: t('helpCenter.userGuideItems.returnExchangeDesc') },
          { id: '22', title: t('helpCenter.userGuideItems.disclaimerStatement'), description: t('helpCenter.userGuideItems.disclaimerStatementDesc') },
          { id: '23', title: t('helpCenter.userGuideItems.memberGradeGuide'), description: t('helpCenter.userGuideItems.memberGradeGuideDesc') },
          // New items from image
          { id: '24', title: t('helpCenter.userGuideItems.affiliateMarketingGuide'), description: t('helpCenter.userGuideItems.affiliateMarketingGuideDesc') },
          { id: '25', title: t('helpCenter.userGuideItems.prepurchaseSizeGuide'), description: t('helpCenter.userGuideItems.prepurchaseSizeGuideDesc') },
          { id: '26', title: t('helpCenter.userGuideItems.customerServiceProtection'), description: t('helpCenter.userGuideItems.customerServiceProtectionDesc') },
          { id: '27', title: t('helpCenter.userGuideItems.todaymallFreeMembership'), description: t('helpCenter.userGuideItems.todaymallFreeMembershipDesc') },
          { id: '28', title: t('helpCenter.userGuideItems.personalInfoMarketingConsent'), description: t('helpCenter.userGuideItems.personalInfoMarketingConsentDesc') },
        ];
      case 'other-guide':
        return [
          { id: '9', title: 'Seller Guidelines', description: 'Information for sellers on our platform' },
          { id: '10', title: 'Product Quality Standards', description: 'Our standards for product quality and authenticity' },
          { id: '11', title: 'Community Guidelines', description: 'Rules and guidelines for community interaction' },
          { id: '12', title: 'Safety Tips', description: 'Tips for safe and secure shopping' },
        ];
      case 'faq':
        return [
          { id: '29', title: t('helpCenter.faqItems.purchaseRelated'), description: t('helpCenter.faqItems.purchaseRelatedDesc') },
          { id: '30', title: t('helpCenter.faqItems.timeRelated'), description: t('helpCenter.faqItems.timeRelatedDesc') },
          { id: '31', title: t('helpCenter.faqItems.shippingRelated'), description: t('helpCenter.faqItems.shippingRelatedDesc') },
          { id: '32', title: t('helpCenter.faqItems.paymentRelated'), description: t('helpCenter.faqItems.paymentRelatedDesc') },
        ];
      default:
        return [];
    }
  };

  const articles = getArticles(section);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderArticles = () => (
    <View style={styles.articlesContainer}>
      {articles.map((article) => (
        <TouchableOpacity
          key={article.id}
          style={styles.articleItem}
          onPress={() => navigation.navigate('HelpArticle', { 
            articleId: article.id, 
            title: article.title 
          })}
        >
          <View style={styles.articleContent}>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleDescription}>{article.description}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderArticles()}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingTop: SPACING['2xl'],
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes['xl'],
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  articlesContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  articleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  articleDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[600],
    lineHeight: 20,
  },
});

export default HelpSectionScreen;