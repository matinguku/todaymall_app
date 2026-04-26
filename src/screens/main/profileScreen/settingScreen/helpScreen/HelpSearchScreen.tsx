import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import Icon from '../../../../../components/Icon';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../../constants';
import { RootStackParamList } from '../../../../../types';
import { useAppSelector } from '../../../../../store/hooks';
import { translations } from '../../../../../i18n/translations';

type HelpSearchScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpSearch'>;
type HelpSearchScreenRouteProp = RouteProp<RootStackParamList, 'HelpSearch'>;

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  body?: string;
  // Fields used when navigating to HelpArticle
  articleContent?: string;
}

// Strip HTML tags and collapse whitespace for searching / preview.
const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|th)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const HelpSearchScreen: React.FC = () => {
  const navigation = useNavigation<HelpSearchScreenNavigationProp>();
  const route = useRoute<HelpSearchScreenRouteProp>();
  const [searchQuery, setSearchQuery] = useState(route.params?.query || '');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const locale = useAppSelector((state) => state.i18n.locale);
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  const helpCenterData = route.params?.helpCenterData;

  const getLocalizedText = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[locale] || obj.en || obj.ko || obj.zh || '';
  };

  // Flatten guides + FAQs from the real backend data into searchable items.
  // Each item keeps its full `body` so searching reaches the article content,
  // not just titles and descriptions.
  const buildResultsFromBackend = (): SearchResult[] => {
    if (!helpCenterData) return [];
    const results: SearchResult[] = [];

    // Guides → subchapters
    const guides = Array.isArray(helpCenterData.guides) ? helpCenterData.guides : [];
    guides.forEach((guide: any, gi: number) => {
      const chapterTitle = getLocalizedText(guide.chapterTitle);
      const subchapters = Array.isArray(guide.subchapters) ? guide.subchapters : [];
      subchapters.forEach((sub: any, si: number) => {
        const title = getLocalizedText(sub.subchapterTitle);
        const rawContent = getLocalizedText(sub.subchapterContent);
        const body = stripHtml(rawContent);
        if (!title && !body) return;
        results.push({
          id: sub._id || `guide-${gi}-${si}`,
          title: title || chapterTitle,
          description: body.slice(0, 140),
          category: chapterTitle || t('helpCenter.guides'),
          body,
          articleContent: rawContent,
        });
      });
    });

    // FAQs
    const categories = Array.isArray(helpCenterData.faqsByCategory) ? helpCenterData.faqsByCategory : [];
    categories.forEach((cat: any, ci: number) => {
      const categoryName = getLocalizedText(cat.name);
      const faqs = Array.isArray(cat.faqs) ? cat.faqs : [];
      faqs.forEach((faq: any, fi: number) => {
        const question = getLocalizedText(faq.question);
        const rawAnswer = getLocalizedText(faq.answer);
        const answer = stripHtml(rawAnswer);
        if (!question && !answer) return;
        results.push({
          id: faq._id || `faq-${ci}-${fi}`,
          title: question,
          description: answer.slice(0, 140),
          category: categoryName || t('helpCenter.faq'),
          body: answer,
          articleContent: rawAnswer,
        });
      });
    });

    return results;
  };

  // Mock search results per language - used as fallback when backend data is unavailable
  const mockResultsByLocale: Record<'en' | 'ko' | 'zh', SearchResult[]> = {
    en: [
      { id: '1', title: 'How to place an order', description: 'Learn how to browse products and place your first order on our platform.', category: 'User Guide' },
      { id: '2', title: 'Payment methods', description: 'Information about accepted payment methods and how to add payment cards.', category: 'FAQ' },
      { id: '3', title: 'Shipping and delivery', description: 'Everything you need to know about shipping options and delivery times.', category: 'Must Read' },
      { id: '4', title: 'Return policy', description: 'Our return and refund policy for damaged or unsatisfactory items.', category: 'Other Guide' },
      { id: '5', title: 'Account security', description: 'Tips to keep your account secure and protect your personal information.', category: 'Must Read' },
    ],
    ko: [
      { id: '1', title: '주문하는 방법', description: '상품을 둘러보고 첫 주문을 완료하는 방법을 알아보세요.', category: '사용 가이드' },
      { id: '2', title: '결제 수단', description: '이용 가능한 결제 수단과 카드 등록 방법에 대한 안내입니다.', category: '자주 묻는 질문' },
      { id: '3', title: '배송 안내', description: '배송 옵션과 배송 기간에 대한 모든 정보입니다.', category: '필독' },
      { id: '4', title: '반품 정책', description: '손상되거나 만족스럽지 않은 상품에 대한 반품·환불 정책입니다.', category: '기타 가이드' },
      { id: '5', title: '계정 보안', description: '계정을 안전하게 지키고 개인정보를 보호하는 팁입니다.', category: '필독' },
    ],
    zh: [
      { id: '1', title: '如何下单', description: '了解如何浏览商品并在我们的平台上完成首次下单。', category: '用户指南' },
      { id: '2', title: '支付方式', description: '关于支持的支付方式以及如何添加支付卡的信息。', category: '常见问题' },
      { id: '3', title: '配送与物流', description: '关于配送选项和配送时间的所有须知。', category: '必读' },
      { id: '4', title: '退货政策', description: '关于损坏或不满意商品的退货与退款政策。', category: '其他指南' },
      { id: '5', title: '账户安全', description: '保护账户安全和个人信息的小贴士。', category: '必读' },
    ],
  };

  // Results always follow the app locale, regardless of what language the user types.
  const resultsLocale: 'en' | 'ko' | 'zh' =
    (locale === 'ko' || locale === 'zh' || locale === 'en' ? locale : 'en');

  // Prefer real backend data; fall back to the locale-specific mock list.
  const backendResults = buildResultsFromBackend();
  const activeResults: SearchResult[] =
    backendResults.length > 0 ? backendResults : mockResultsByLocale[resultsLocale];

  const filterResults = (query: string): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (!q) return activeResults;
    return activeResults.filter((r) => {
      const haystack = `${r.title} ${r.description} ${r.body || ''} ${r.category}`.toLowerCase();
      return haystack.includes(q);
    });
  };

  useEffect(() => {
    setSearchResults(filterResults(searchQuery));
    // activeResults is derived from helpCenterData + locale, so those are the real deps
  }, [searchQuery, resultsLocale, helpCenterData]);

  const handleSearch = () => {
    setSearchResults(filterResults(searchQuery));
  };

  const handleSubmitEditing = () => {
    handleSearch();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('helpCenter.helpSearch')}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderSearchSection = () => (
    <View style={styles.searchSection}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('helpCenter.searchPlaceholder')}
          placeholderTextColor={COLORS.gray[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSubmitEditing}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <Icon name="search" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResults = () => (
    <View style={styles.resultsContainer}>
      <Text style={styles.resultsHeader}>
        {searchResults.length} {t('helpCenter.searchResults')}
      </Text>
      
      {searchResults.map((result) => (
        <TouchableOpacity
          key={result.id}
          style={styles.resultItem}
          onPress={() => navigation.navigate('HelpArticle', {
            articleId: result.id,
            title: result.title,
            content: result.articleContent,
          })}
        >
          <View style={styles.resultContent}>
            <Text style={styles.resultCategory}>{result.category}</Text>
            <Text style={styles.resultTitle}>{result.title}</Text>
            <Text style={styles.resultDescription}>{result.description}</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity>
      ))}
      
      {searchResults.length === 0 && searchQuery.trim() && (
        <View style={styles.noResults}>
          <Icon name="search" size={48} color={COLORS.gray[300]} />
          <Text style={styles.noResultsTitle}>{t('helpCenter.noResults')}</Text>
          <Text style={styles.noResultsText}>
            {t('helpCenter.noResultsText')}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderSearchSection()}
        {renderSearchResults()}
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
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
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
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    paddingVertical: SPACING.md,
  },
  searchButton: {
    backgroundColor: COLORS.black,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: SPACING.sm,
  },
  resultsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  resultsHeader: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.lg,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  resultContent: {
    flex: 1,
  },
  resultCategory: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  resultTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  resultDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[600],
    lineHeight: 20,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
  },
  noResultsTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  noResultsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HelpSearchScreen;