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

import { COLORS, FONTS, SPACING } from '../../../../../constants';
import { RootStackParamList } from '../../../../../types';
import { useAppSelector } from '../../../../../store/hooks';
import { translations } from '../../../../../i18n/translations';

type HelpChapterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpChapter'>;
type HelpChapterScreenRouteProp = RouteProp<RootStackParamList, 'HelpChapter'>;

type HelpChapterScreenProps = {
  embedded?: boolean;
  guide?: any;
  onBack?: () => void;
  onSubchapterPress?: (subchapter: { articleId: string; title: string; content: string }) => void;
};

const HelpChapterScreen: React.FC<HelpChapterScreenProps> = ({ embedded = false, guide: guideProp, onBack, onSubchapterPress }) => {
  const navigation = useNavigation<HelpChapterScreenNavigationProp>();
  const route = useRoute<HelpChapterScreenRouteProp>();
  const guide = embedded ? guideProp : route.params?.guide;
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
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => embedded && onBack ? onBack() : navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {getLocalizedText(guide?.chapterTitle)}
      </Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderSubchapters = () => {
    if (!guide?.subchapters || guide.subchapters.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('helpCenter.noSubchapters')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.subchaptersContainer}>
        {guide.subchapters.map((subchapter: any, index: number) => (
          <TouchableOpacity
            key={subchapter._id || index}
            style={styles.subchapterItem}
            onPress={() => {
              const articleData = {
                articleId: subchapter._id || index.toString(),
                title: getLocalizedText(subchapter.subchapterTitle),
                content: getLocalizedText(subchapter.subchapterContent),
              };
              if (embedded && onSubchapterPress) {
                onSubchapterPress(articleData);
              } else {
                navigation.navigate('HelpArticle', articleData);
              }
            }}
          >
            <View style={styles.subchapterContent}>
              <Text style={styles.subchapterTitle}>
                {getLocalizedText(subchapter.subchapterTitle)}
              </Text>
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
        {renderSubchapters()}
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
  subchaptersContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  subchapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  subchapterContent: {
    flex: 1,
  },
  subchapterTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
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

export default HelpChapterScreen;

