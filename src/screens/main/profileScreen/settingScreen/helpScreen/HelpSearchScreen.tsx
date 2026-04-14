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
}

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

  // Mock search results - replace with actual search API
  const mockResults: SearchResult[] = [
    {
      id: '1',
      title: 'How to place an order',
      description: 'Learn how to browse products and place your first order on our platform.',
      category: 'User Guide',
    },
    {
      id: '2',
      title: 'Payment methods',
      description: 'Information about accepted payment methods and how to add payment cards.',
      category: 'FAQ',
    },
    {
      id: '3',
      title: 'Shipping and delivery',
      description: 'Everything you need to know about shipping options and delivery times.',
      category: 'Must Read',
    },
    {
      id: '4',
      title: 'Return policy',
      description: 'Our return and refund policy for damaged or unsatisfactory items.',
      category: 'Other Guide',
    },
    {
      id: '5',
      title: 'Account security',
      description: 'Tips to keep your account secure and protect your personal information.',
      category: 'Must Read',
    },
  ];

  useEffect(() => {
    // Simulate search - replace with actual search logic
    if (searchQuery.trim()) {
      const filtered = mockResults.filter(
        result =>
          result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults(mockResults);
    }
  }, [searchQuery]);

  const handleSearch = () => {
    // Trigger search with current query
    const filtered = mockResults.filter(
      result =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(filtered);
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
            title: result.title 
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