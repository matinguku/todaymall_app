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

import { COLORS, FONTS, SPACING, BORDER_RADIUS, BACK_NAVIGATION_HIT_SLOP } from '../../../../../constants';
import { RootStackParamList } from '../../../../../types';
import { useAppSelector } from '../../../../../store/hooks';
import { translations } from '../../../../../i18n/translations';

type HelpArticleScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpArticle'>;
type HelpArticleScreenRouteProp = RouteProp<RootStackParamList, 'HelpArticle'>;

type HelpArticleScreenProps = {
  embedded?: boolean;
  articleId?: string;
  title?: string;
  content?: string;
  onBack?: () => void;
};

const HelpArticleScreen: React.FC<HelpArticleScreenProps> = ({
  embedded = false,
  articleId: articleIdProp,
  title: titleProp,
  content: contentProp,
  onBack,
}) => {
  const navigation = useNavigation<HelpArticleScreenNavigationProp>();
  const route = useRoute<HelpArticleScreenRouteProp>();
  const articleId = embedded ? (articleIdProp ?? '') : route.params?.articleId;
  const title = embedded ? (titleProp ?? '') : route.params?.title;
  const locale = useAppSelector((state) => state.i18n.locale);
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  // Strip HTML tags and convert to plain text
  const stripHtml = (html: string) => {
    if (!html) return '';
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, '');
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '');
    // Clean up multiple newlines
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    return text.trim();
  };

  const localeTag = locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : 'en-US';
  const formatDate = (date: Date) =>
    date.toLocaleDateString(localeTag, { year: 'numeric', month: 'long', day: 'numeric' });

  // Get article content
  const getArticleContent = () => {
    const rawContent = embedded ? contentProp : route.params?.content;
    if (rawContent) {
      return {
        title: title,
        content: stripHtml(rawContent),
        lastUpdated: `${t('helpCenter.lastUpdated')}: ${formatDate(new Date())}`,
      };
    }

    // Fallback to translation keys for backward compatibility
    const articleContentMap: { [key: string]: string } = {
      '1': 'helpCenter.articles.termsOfUseContent',
      '2': 'helpCenter.articles.serviceIntroductionContent',
      '3': 'helpCenter.articles.privacyPolicyContent',
      '4': 'helpCenter.articles.returnRefundPolicyContent',
    };

    const contentKey = articleContentMap[articleId] || 'helpCenter.articles.defaultContent';

    return {
      title: title,
      content: t(contentKey),
      lastUpdated: `${t('helpCenter.lastUpdated')}: ${formatDate(new Date('2024-12-15'))}`,
    };
  };

  const article = getArticleContent();

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP}
        style={styles.backButton}
        onPress={() => embedded && onBack ? onBack() : navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{t('helpArticle.title')}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderContent = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.articleTitle}>{article.title}</Text>
      <Text style={styles.lastUpdated}>{article.lastUpdated}</Text>
      
      <View style={styles.contentSection}>
        <Text style={styles.contentText}>{article.content}</Text>
      </View>
      
      <View style={styles.helpfulSection}>
        <Text style={styles.helpfulTitle}>{t('helpCenter.wasHelpful')}</Text>
        <View style={styles.helpfulButtons}>
          <TouchableOpacity style={[styles.helpfulButton, styles.yesButton]}>
            <Icon name="thumbs-up" size={16} color={COLORS.white} />
            <Text style={styles.yesButtonText}>{t('helpCenter.yes')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.helpfulButton, styles.noButton]}>
            <Icon name="thumbs-down" size={16} color={COLORS.gray[600]} />
            <Text style={styles.noButtonText}>{t('helpCenter.no')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderContent()}
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
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  articleTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    lineHeight: 28,
  },
  lastUpdated: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[500],
    marginBottom: SPACING.xl,
  },
  contentSection: {
    marginBottom: SPACING.xl,
  },
  contentText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    lineHeight: 24,
    textAlign: 'justify',
  },
  helpfulSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  helpfulTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  helpfulButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  yesButton: {
    backgroundColor: COLORS.primary,
  },
  noButton: {
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  yesButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  noButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
});

export default HelpArticleScreen;