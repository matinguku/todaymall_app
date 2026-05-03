import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../../../components/Icon';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, FONTS, SPACING, BACK_NAVIGATION_HIT_SLOP } from '../../../../../constants';
import { RootStackParamList } from '../../../../../types';
import { useAppSelector } from '../../../../../store/hooks';
import { translations } from '../../../../../i18n/translations';

type HelpFAQCategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpFAQCategories'>;
type HelpFAQCategoriesScreenRouteProp = RouteProp<RootStackParamList, 'HelpFAQCategories'>;

type HelpFAQCategoriesScreenProps = {
  embedded?: boolean;
  faqsByCategory?: any[];
  onBack?: () => void;
  onCategoryPress?: (category: any, faqs: any[]) => void;
};

const HelpFAQCategoriesScreen: React.FC<HelpFAQCategoriesScreenProps> = ({ embedded = false, faqsByCategory: faqsProp, onBack, onCategoryPress }) => {
  const navigation = useNavigation<HelpFAQCategoriesScreenNavigationProp>();
  const route = useRoute<HelpFAQCategoriesScreenRouteProp>();
  const faqsByCategory = embedded ? faqsProp : route.params?.faqsByCategory;
  const locale = useAppSelector((state) => state.i18n.locale);
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  const getLocalizedText = (obj: any) => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[locale] || obj.en || obj.ko || obj.zh || '';
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP}
        style={styles.backButton}
        onPress={() => embedded && onBack ? onBack() : navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('helpCenter.faq')}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderCategories = () => {
    if (!faqsByCategory || faqsByCategory.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('helpCenter.noCategories')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.categoriesContainer}>
        {faqsByCategory.map((category: any, index: number) => (
          <TouchableOpacity
            key={category._id || index}
            style={styles.categoryItem}
            onPress={() => {
              if (embedded && onCategoryPress) {
                onCategoryPress(category, category.faqs || []);
              } else {
                navigation.navigate('HelpFAQQuestions', {
                  category,
                  faqs: category.faqs || [],
                });
              }
            }}
          >
            <View style={styles.categoryContent}>
              <Text style={styles.categoryTitle}>
                {getLocalizedText(category.name)}
              </Text>
              {category.faqs && category.faqs.length > 0 && (
                <Text style={styles.categoryCount}>
                  {category.faqs.length} {t('helpCenter.questions')}
                </Text>
              )}
            </View>
            <Icon name="chevron-forward" size={20} color={COLORS.gray[400]} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderCategories()}
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
  categoriesContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  categoryCount: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[600],
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray[600],
  },
});

export default HelpFAQCategoriesScreen;

