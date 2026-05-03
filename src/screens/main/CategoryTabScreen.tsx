import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { launchCamera, launchImageLibrary, MediaType, ImagePickerResponse, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { requestCameraPermission, requestPhotoLibraryPermission } from '../../utils/permissions';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, IMAGE_CONFIG, BACK_NAVIGATION_HIT_SLOP } from '../../constants';
import { RootStackParamList } from '../../types';
import { SearchButton, NotificationBadge, ImagePickerModal } from '../../components';
import NotificationIcon from '../../assets/icons/NotificationIcon';

import { useToast } from '../../context/ToastContext';
import { usePlatformStore } from '../../store/platformStore';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';
import { useTopCategoriesMutation } from '../../hooks/useTopCategoriesMutation';
import { productsApi } from '../../services/productsApi';

type CategoryTabScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Category'>;

const COMPANY_TABS = ['All', '1688', 'Taobao'] as const;

const CategoryTabScreen: React.FC = () => {
  const navigation = useNavigation<CategoryTabScreenNavigationProp>();
  // Zustand store
  const { 
    selectedCategory,
    setSelectedPlatform, 
    setSelectedCategory,
  } = usePlatformStore();
  
  // i18n
  const locale = useAppSelector((s) => s.i18n.locale);
  const { showToast } = useToast();

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  const getCategoryImage = useCallback((category: any): string => {
    if (!category) return '';
    return (
      category.imageUrl ||
      category.image ||
      category.mainImage ||
      category.main_image_url ||
      category.thumbnail ||
      category.thumbnailUrl ||
      category.thumbUrl ||
      category.iconUrl ||
      category.icon ||
      ''
    );
  }, []);

  // Map company name to platform/source parameter
  const getPlatformFromCompany = (company: string): string => {
    if (company === 'All') {
      return '1688';
    }
    // Convert company name to lowercase for API (e.g., "Taobao" -> "taobao")
    return company.toLowerCase();
  };
  
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(25);
  const [imagePickerModalVisible, setImagePickerModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [topCategories, setTopCategories] = useState<any[]>([]);
  // L2 categories grouped by parent L1 id; the right column reads from this
  // to render every L1's L2 list as one continuous SectionList.
  const [allL2ByL1, setAllL2ByL1] = useState<Record<string, any[]>>({});
  const [isLoadingAllL2, setIsLoadingAllL2] = useState(false);

  const hasFetchedRef = useRef<string | null>(null);
  // Cache keyed by `${platform}-${locale}` → { l1Id → l2 tree }.
  const allL2CacheRef = useRef<Record<string, Record<string, any[]>>>({});
  // Bumped to invalidate in-flight batch fetches (company/locale switch, refresh).
  const fetchTokenRef = useRef(0);
  const sectionListRef = useRef<SectionList<any> | null>(null);
  // True while we are programmatically scrolling the right column in response
  // to an L1 tap; prevents the resulting onViewableItemsChanged from echoing
  // the highlight back and fighting the user's tap.
  const programmaticScrollRef = useRef(false);

  // Top categories mutation
  const { mutate: fetchTopCategories, isLoading: isLoadingTopCategories } = useTopCategoriesMutation({
    onSuccess: (data) => {
      // console.log('Top categories fetched successfully:', data);
      const categories = data.categories || [];
      setTopCategories(categories);
      // Auto-select first category
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]._id);
      }
      // Mark this platform as fetched
      hasFetchedRef.current = data.platform;
    },
    onError: (error) => {
      // console.error('Failed to fetch top categories:', error);
      setTopCategories([]);
      // Reset ref on error so we can retry
      hasFetchedRef.current = null;
      showToast(error || t('category.failedToLoadCategories'), 'error');
    },
  });

  // Fetch top categories when selected company changes.
  // Platform parameter is determined by selected company (All = 1688).
  useEffect(() => {
    if (selectedCompany) {
      const platformForCompany = getPlatformFromCompany(selectedCompany);
      const alreadyFetched = hasFetchedRef.current === platformForCompany;
      if (!alreadyFetched && !isLoadingTopCategories) {
        hasFetchedRef.current = platformForCompany;
        fetchTopCategories(platformForCompany);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  // Batch-fetch L2 for every L1 once topCategories are known. The right
  // column shows a single continuous SectionList grouped by L1, so we need
  // every L1's L2 data — fetched sequentially so the list paints
  // progressively as each L1 resolves, and to be gentle on the API.
  useEffect(() => {
    if (topCategories.length === 0 || !selectedCompany) {
      setAllL2ByL1({});
      setIsLoadingAllL2(false);
      return;
    }
    const platform = getPlatformFromCompany(selectedCompany);
    const cacheKey = `${platform}-${locale || 'en'}`;

    const cached = allL2CacheRef.current[cacheKey];
    const fullyCached =
      cached &&
      topCategories.every((l1: any) => Array.isArray(cached[l1._id]));
    if (fullyCached) {
      setAllL2ByL1(cached);
      setIsLoadingAllL2(false);
      return;
    }

    const token = ++fetchTokenRef.current;
    setIsLoadingAllL2(true);
    setAllL2ByL1(cached || {});

    (async () => {
      const results: Record<string, any[]> = { ...(cached || {}) };
      for (const l1 of topCategories) {
        if (token !== fetchTokenRef.current) return;
        if (Array.isArray(results[l1._id])) continue;
        try {
          const resp = await productsApi.getChildCategories(platform, l1._id);
          if (token !== fetchTokenRef.current) return;
          const tree = (resp?.success && resp?.data?.tree) || [];
          results[l1._id] = tree;
          setAllL2ByL1((prev) => ({ ...prev, [l1._id]: tree }));
        } catch {
          if (token !== fetchTokenRef.current) return;
          results[l1._id] = [];
          setAllL2ByL1((prev) => ({ ...prev, [l1._id]: [] }));
        }
      }
      if (token !== fetchTokenRef.current) return;
      allL2CacheRef.current[cacheKey] = results;
      setIsLoadingAllL2(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topCategories, selectedCompany, locale]);

  // Top categories for the left column.
  const categoriesToDisplay = useMemo(() => topCategories.map((cat: any) => ({
    id: cat._id,
    name: typeof cat.name === 'object'
      ? (cat.name[locale] || cat.name.en || cat.name.zh || 'Category')
      : cat.name,
    image: cat.imageUrl || '',
  })), [topCategories, locale]);

  /**
   * Sectioned right-column data: one section per L1, each containing its L2
   * rows. Empty sections are kept so scrollToLocation indices stay aligned
   * with the L1 list on the left even before all batches resolve.
   */
  const sections = useMemo(() => {
    return topCategories.map((l1: any) => {
      const l1Name = typeof l1.name === 'object'
        ? (l1.name[locale] || l1.name.en || l1.name.zh || 'Category')
        : (l1.name || 'Category');
      const tree = allL2ByL1[l1._id] || [];
      const data = tree.map((level2: any) => {
        const level3Children = Array.isArray(level2.children) ? level2.children : [];
        const level2Name = typeof level2.name === 'object'
          ? (level2.name[locale] || level2.name.en || level2.name.zh || '')
          : (level2.name || '');
        return {
          id: level2._id,
          name: level2Name,
          l1Id: l1._id,
          l1Name,
          subsubcategories: level3Children.map((level3: any) => ({
            id: level3._id,
            name: typeof level3.name === 'object'
              ? (level3.name[locale] || level3.name.en || level3.name.zh || '')
              : (level3.name || ''),
            externalId: level3.externalId,
            image: getCategoryImage(level3) || '',
          })),
        };
      }).filter((item: any) => item.name);
      return { l1Id: l1._id, title: l1Name, data };
    });
  }, [topCategories, allL2ByL1, locale, getCategoryImage]);

  const openProductDiscoveryForL2 = useCallback(
    (l2Item: any, initialL3Id?: string) => {
      const platform = getPlatformFromCompany(selectedCompany);
      const localizedSubSubs = (l2Item.subsubcategories || []).map((subSubCat: any) => {
        if (subSubCat.name && typeof subSubCat.name === 'object') {
          return {
            ...subSubCat,
            name: subSubCat.name[locale] || subSubCat.name.en || subSubCat.name,
          };
        }
        return subSubCat;
      });
      navigation.navigate('ProductDiscovery', {
        subCategoryName: l2Item.name,
        // Each L2 carries the parent L1 it actually belongs to (set in the
        // sections memo). Don't fall back to selectedCategory — that tracks
        // the visible section and may differ from the tapped row's parent
        // during scroll.
        categoryId: l2Item.l1Id,
        categoryName: l2Item.l1Name,
        subcategoryId: l2Item.id,
        subsubcategories: localizedSubSubs,
        source: platform,
        ...(initialL3Id ? { initialSubSubCategoryId: initialL3Id } : {}),
      });
    },
    [selectedCompany, locale, navigation],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedCompany) {
      const platform = getPlatformFromCompany(selectedCompany);
      const cacheKey = `${platform}-${locale || 'en'}`;
      delete allL2CacheRef.current[cacheKey];
      setAllL2ByL1({});
      // Re-trigger the top-categories fetch which in turn re-runs the
      // batch L2 effect (its dependency on `topCategories` reference fires).
      hasFetchedRef.current = null;
      fetchTopCategories(platform);
    }
    setRefreshing(false);
  };

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const sectionIndex = sections.findIndex((s) => s.l1Id === categoryId);
    if (sectionIndex < 0 || !sectionListRef.current) return;
    programmaticScrollRef.current = true;
    try {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    } catch {
      // ignore — scrollToLocation can throw if the target isn't laid out
    }
    // Clear the guard slightly after the scroll animation completes so any
    // viewability events fired during the animation don't re-trigger us.
    setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
  };

  // Map the topmost viewable section back to selectedCategory so the left
  // column highlight follows scrolling on the right.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (programmaticScrollRef.current) return;
    if (!viewableItems || viewableItems.length === 0) return;
    const top = viewableItems[0];
    const l1Id = top?.section?.l1Id;
    if (l1Id) {
      // Avoid loop: only update if it's actually different.
      const currentSelected = usePlatformStore.getState().selectedCategory;
      if (currentSelected !== l1Id) {
        usePlatformStore.getState().setSelectedCategory(l1Id);
      }
    }
  }).current;

  // Helper function to convert image URI to base64
  const convertUriToBase64 = async (uri: string): Promise<string | null> => {
    try {
      // Remove file:// prefix if present
      const fileUri = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
      const base64 = await RNFS.readFile(fileUri, 'base64');
      return base64;
    } catch (error) {
      // console.error('Error converting URI to base64:', error);
      return null;
    }
  };

  const handleImageSearch = async () => {
    // Navigate to camera screen
    navigation.navigate('ImageSearchCamera' as never);
  };

  const handleTakePhoto = async () => {
    // Request camera permission
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert(t('home.permissionRequired'), t('home.grantCameraPermission'));
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo' as MediaType,
      quality: IMAGE_CONFIG.QUALITY,
      saveToPhotos: false,
      includeBase64: true,
    };

    launchCamera(options, async (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert(t('common.error'), response.errorMessage || t('home.failedToTakePhoto'));
        return;
      }
      if (response.assets && response.assets[0]) {
        setImagePickerModalVisible(false);
        let base64Data = response.assets[0].base64;
        
        // Then compressImageForSearch uses IMAGE_CONFIG.QUALITY (may step down for size)
        // Only compress if base64 is not available (fallback case)
        if (!base64Data && response.assets[0].uri) {
          const { compressImageForSearch } = require('../../utils/imageCompression');
          const compressedBase64 = await compressImageForSearch(response.assets[0].uri);
          if (compressedBase64) {
            base64Data = compressedBase64;
          } else {
            const convertedBase64 = await convertUriToBase64(response.assets[0].uri);
            base64Data = convertedBase64 || undefined;
          }
        }
        
        if (!base64Data) {
          showToast(t('home.imageDataUnavailable'), 'error');
          return;
        }
        
        navigation.navigate('ImageSearch', { 
          imageUri: response.assets[0].uri || '',
          imageBase64: base64Data,
        });
      }
    });
  };

  const handleChooseFromGallery = async () => {
    // Request media library permission
    const granted = await requestPhotoLibraryPermission();
    if (!granted) {
      Alert.alert(t('home.permissionRequired'), t('home.grantPhotoLibraryPermission'));
      return;
    }

    const options: ImageLibraryOptions = {
      mediaType: 'photo' as MediaType,
      quality: IMAGE_CONFIG.QUALITY,
      selectionLimit: 1,
      includeBase64: true,
    };

    launchImageLibrary(options, async (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert(t('common.error'), response.errorMessage || t('home.failedToPickImage'));
        return;
      }
      if (response.assets && response.assets[0]) {
        setImagePickerModalVisible(false);
        let base64Data = response.assets[0].base64;
        
        // Then compressImageForSearch uses IMAGE_CONFIG.QUALITY (may step down for size)
        // Only compress if base64 is not available (fallback case)
        if (!base64Data && response.assets[0].uri) {
          const { compressImageForSearch } = require('../../utils/imageCompression');
          const compressedBase64 = await compressImageForSearch(response.assets[0].uri);
          if (compressedBase64) {
            base64Data = compressedBase64;
          } else {
            const convertedBase64 = await convertUriToBase64(response.assets[0].uri);
            base64Data = convertedBase64 || undefined;
          }
        }
        
        if (!base64Data) {
          showToast(t('home.imageDataUnavailable'), 'error');
          return;
        }
        
        navigation.navigate('ImageSearch', { 
          imageUri: response.assets[0].uri || '',
          imageBase64: base64Data,
        });
      }
    });
  };

  // Render company filter tabs
  const renderCompanyTabs = () => {
    return (
      <View style={styles.companyTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.companyTabs}
        >
          {COMPANY_TABS.map((company, index) => {
            const isSelected = selectedCompany === company;
            
            return (
              <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP}
                key={`company-${company}-${index}`}
                style={[
                  styles.companyTab,
                  index === COMPANY_TABS.length - 1 && { marginRight: SPACING.md },
                  index === 0 && { marginLeft: SPACING.md }
                ]}
                onPress={() => {
                  setSelectedCompany(company);
                  // Update selectedPlatform in store based on selected company
                  const platform = getPlatformFromCompany(company);
                  setSelectedPlatform(platform);
                  // Reset fetch refs to allow refetch with new company
                  hasFetchedRef.current = null;
                  setTopCategories([]);
                  setAllL2ByL1({});
                  // Reset selected category so useTopCategoriesMutation.onSuccess auto-selects the first category of the new company
                  setSelectedCategory('');
                }}
              >
                <Text style={[
                  styles.companyTabText,
                  isSelected && styles.companyTabTextSelected
                ]}>
                  {company}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.headerRow}>
        <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP}
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>

        <SearchButton
          placeholder={t('category.searchPlaceholder')}
          onPress={() => navigation.navigate('Search' as never)}
          onCameraPress={handleImageSearch}
          style={styles.searchButton}
          isHomepage={false}
        />

        <NotificationBadge
          customIcon={<NotificationIcon width={28} height={28} color={COLORS.text.primary} />}
          count={unreadCount}
          onPress={() => {
            navigation.navigate('Message' as never);
          }}
        />
      </View>
      {renderCompanyTabs()}
    </View>
  );

  
  const renderLevel1CategoryItem = ({ item }: { item: any }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          isSelected && styles.categoryItemActive
        ]}
        onPress={() => handleCategoryPress(item.id)}
      >
        <Text style={[
          styles.categoryName,
          isSelected && styles.categoryNameActive
        ]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderL2Row = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.browseSubcatRow}
      activeOpacity={0.75}
      onPress={() => openProductDiscoveryForL2(item)}
    >
      <Text
        style={styles.browseSubcatName}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {item.name}
      </Text>
      <Icon name="chevron-forward" size={20} color={COLORS.text.secondary} />
    </TouchableOpacity>
  );

  const renderL1SectionHeader = ({ section }: { section: any }) => (
    <View style={styles.browseSectionHeader}>
      <Text
        style={styles.browseSectionHeaderText}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {section.title}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <View style={styles.mainContent}>
        <View style={styles.leftColumn}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {isLoadingTopCategories && categoriesToDisplay.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={categoriesToDisplay}
                renderItem={renderLevel1CategoryItem}
                keyExtractor={(item) => `category-${item.id || item.name}`}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                style={{minHeight: '100%'}}
              />
            )}
          </ScrollView>
        </View>

        <View style={styles.rightColumn}>
          {sections.length === 0 && isLoadingAllL2 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <SectionList
              ref={sectionListRef}
              sections={sections}
              keyExtractor={(item: any, index: number) => `l2-${item.id}-${index}`}
              renderItem={renderL2Row}
              renderSectionHeader={renderL1SectionHeader}
              stickySectionHeadersEnabled
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onScrollToIndexFailed={(info) => {
                // SectionList may not have laid out the target section yet
                // when handleCategoryPress fires (e.g., right after L1
                // changed). Retry once on the next frame.
                setTimeout(() => {
                  sectionListRef.current?.scrollToLocation({
                    sectionIndex: info.index,
                    itemIndex: 0,
                    animated: false,
                    viewOffset: 0,
                  });
                }, 100);
              }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={styles.browseSectionListContent}
              ListHeaderComponent={
                <View style={styles.browseSubcatHeader}>
                  <Text style={styles.browseSubcatTitle}>
                    {t('category.browseSubcategories')}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
      
      <ImagePickerModal
        visible={imagePickerModalVisible}
        onClose={() => setImagePickerModalVisible(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingTop: SPACING.xl,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gray[200],
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  searchButton: {
    borderRadius: BORDER_RADIUS.full,
    flex: 1,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    paddingBottom: SPACING.lg,
  },
  leftColumn: {
    width: 140,
    backgroundColor: COLORS.gray[100],
  },
  rightColumn: {
    flex: 1,
    minHeight: 0,
  },
  categoryItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  categoryItemActive: {
    backgroundColor: COLORS.white,
  },
  categoryName: {
    fontSize: FONTS.sizes.sm * 1.2,
    color: COLORS.text.primary,
    textAlign: 'left',
    fontWeight: '500',
  },
  categoryNameActive: {
    fontWeight: '600',
    color: COLORS.red,
  },
  browseSubcatSection: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    minHeight: 0,
  },
  browseListHeaderOuter: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  browseSubcatHeader: {
    marginBottom: SPACING.sm,
  },
  browseSubcatTitle: {
    fontSize: FONTS.sizes.lg * 1.5,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  browseSubcatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  browseSubcatName: {
    flex: 1,
    fontSize: FONTS.sizes.md * 1.2,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  browseSubcatSkelText: {
    flex: 1,
    height: 14,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
  },
  browseQuickJumpWrap: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  browseQuickJumpTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  browseQuickJumpHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  browseQuickJumpScroll: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.xs,
    paddingRight: SPACING.md,
  },
  browseQuickJumpChip: {
    maxWidth: 200,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  browseQuickJumpChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  browseSectionListContent: {
    paddingBottom: SPACING.xl,
  },
  browseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.gray[50],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
    gap: SPACING.sm,
  },
  browseSectionHeaderText: {
    flex: 1,
    fontSize: FONTS.sizes.md * 1.5,
    fontWeight: '600',
    color: COLORS.text.red,
  },
  browseLevel3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
  },
  browseLevel3RowText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
  browseSectionSeparator: {
    height: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyTabsContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
  },
  companyTabs: {
    alignItems: 'center',
  },
  companyTab: {
    paddingHorizontal: SPACING.smmd,
    paddingVertical: SPACING.xs,
  },
  companyTabText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.black,
    fontWeight: '700',
  },
  companyTabTextSelected: {
    color: COLORS.text.red,
    fontWeight: '600',
  },
});

export default CategoryTabScreen;