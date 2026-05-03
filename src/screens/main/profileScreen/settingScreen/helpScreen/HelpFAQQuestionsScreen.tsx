import React, { useState } from 'react';
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

type HelpFAQQuestionsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpFAQQuestions'>;
type HelpFAQQuestionsScreenRouteProp = RouteProp<RootStackParamList, 'HelpFAQQuestions'>;

type HelpFAQQuestionsScreenProps = {
  embedded?: boolean;
  category?: any;
  faqs?: any[];
  onBack?: () => void;
};

const HelpFAQQuestionsScreen: React.FC<HelpFAQQuestionsScreenProps> = ({
  embedded = false,
  category: categoryProp,
  faqs: faqsProp,
  onBack,
}) => {
  const navigation = useNavigation<HelpFAQQuestionsScreenNavigationProp>();
  const route = useRoute<HelpFAQQuestionsScreenRouteProp>();
  const category = embedded ? categoryProp : route.params?.category;
  const faqs = embedded ? faqsProp : route.params?.faqs;
  const locale = useAppSelector((state) => state.i18n.locale);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  
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
      <Text style={styles.headerTitle} numberOfLines={1}>
        {getLocalizedText(category?.name)}
      </Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderFAQs = () => {
    if (!faqs || faqs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('helpCenter.noFAQs')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.faqsContainer}>
        {faqs.map((faq: any, index: number) => {
          const isExpanded = expandedFAQ === (faq._id || index.toString());
          const question = getLocalizedText(faq.question);
          const answer = getLocalizedText(faq.answer);

          return (
            <View key={faq._id || index} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => {
                  setExpandedFAQ(isExpanded ? null : (faq._id || index.toString()));
                }}
              >
                <Text style={styles.faqQuestionText}>{question}</Text>
                <Icon
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.gray[600]}
                />
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{answer}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderFAQs()}
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
  faqsContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginRight: SPACING.md,
  },
  faqAnswer: {
    paddingBottom: SPACING.lg,
    paddingLeft: 0,
  },
  faqAnswerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[700],
    lineHeight: 22,
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

export default HelpFAQQuestionsScreen;

