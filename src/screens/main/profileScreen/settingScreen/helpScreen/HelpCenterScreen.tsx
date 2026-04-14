import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from '../../../../../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../../../../constants';
import { RootStackParamList } from '../../../../../types';
import { useAppSelector } from '../../../../../store/hooks';
import { translations } from '../../../../../i18n/translations';
import { useHelpCenterMutation } from '../../../../../hooks/useHelpCenterMutation';

type HelpCenterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpCenter'>;

const HelpCenterScreen: React.FC = () => {
  const navigation = useNavigation<HelpCenterScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const locale = useAppSelector((state) => state.i18n.locale);
  
  const { mutate: fetchHelpCenter, data: helpCenterData, isLoading, error } = useHelpCenterMutation();

  useEffect(() => {
    fetchHelpCenter();
  }, [fetchHelpCenter]);
  
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

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate('HelpSearch', { query: searchQuery.trim() });
    }
  };

  const handleSubmitEditing = () => {
    handleSearch();
  };

  const handleGuidePress = (guide: any) => {
    navigation.navigate('HelpChapter', { guide });
  };

  const handleFAQPress = () => {
    navigation.navigate('HelpFAQCategories', { faqsByCategory: helpCenterData?.faqsByCategory || [] });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('helpCenter.title')}</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderSearchSection = () => (
    <View style={styles.searchSection}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('helpCenter.popularSearch')}
          placeholderTextColor={COLORS.gray[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSubmitEditing}
          returnKeyType="search"
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

  const renderGuides = () => {
    if (!helpCenterData?.guides || helpCenterData.guides.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('helpCenter.guides')}</Text>
        {helpCenterData.guides.map((guide: any, index: number) => (
          <TouchableOpacity
            key={guide._id || index}
            style={styles.menuItem}
            onPress={() => handleGuidePress(guide)}
          >
            <Text style={styles.menuItemText}>{getLocalizedText(guide.chapterTitle)}</Text>
            <Icon name="chevron-forward" size={20} color={COLORS.gray[400]} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFAQ = () => {
    if (!helpCenterData?.faqsByCategory || helpCenterData.faqsByCategory.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('helpCenter.faq')}</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleFAQPress}
        >
          <Text style={styles.menuItemText}>{t('helpCenter.viewAllFAQ')}</Text>
          <Icon name="chevron-forward" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('helpCenter.loading')}</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('helpCenter.error')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchHelpCenter()}>
            <Text style={styles.retryButtonText}>{t('helpCenter.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        {renderGuides()}
        {renderFAQ()}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderSearchSection()}
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
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
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
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  menuItemText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray[600],
  },
  errorContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});

export default HelpCenterScreen;