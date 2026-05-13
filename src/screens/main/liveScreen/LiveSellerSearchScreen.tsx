import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import Text from '../../../components/Text';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SCREEN_WIDTH, BACK_NAVIGATION_HIT_SLOP, IMAGE_CONFIG } from '../../../constants';
import ArrowBackIcon from '../../../assets/icons/ArrowBackIcon';
import { useAppSelector } from '../../../store/hooks';
import { productsApi } from '../../../services/productsApi';
import { useLiveCommerceMutation } from '../../../hooks/useLiveCommerceMutation';
import { useTranslation } from '../../../hooks/useTranslation';
import SearchIcon from '../../../assets/icons/SearchIcon';
import SensorsIcon from '../../../assets/icons/SensorsIcon';
import ArrowDropDownIcon from '../../../assets/icons/ArrowDropDownIcon';
import { formatPriceKRW } from '../../../utils/i18nHelpers';
import {
  getLiveSellerListingProductMeta,
  pickLiveSellerRawLiveCode,
  getLiveSellerOfferId,
  getLiveSellerProductCodeRowDisplayValue,
  getLiveSellerProductItemNumberRowDisplayValue,
} from '../../../utils/liveSellerProductListingMeta';

const CARD_GAP = SPACING.smmd;
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.md * 2 - CARD_GAP) / 2;

const PRODUCT_GAP = 6;
const PRODUCT_COLUMN_COUNT = 3;
const PRODUCT_CARD_WIDTH =
  (SCREEN_WIDTH - SPACING.md * 2 - PRODUCT_GAP * (PRODUCT_COLUMN_COUNT - 1)) / PRODUCT_COLUMN_COUNT;

type SortOption = 'bestMatch' | 'viewers' | 'newest';
type FilterTab = 'bestMatch' | 'sales' | 'newArrivals';
const asArray = (value: any): any[] => (Array.isArray(value) ? value : []);

// ─── Seller Card ──────────────────────────────────────────
const SellerCard: React.FC<{
  seller: any;
  isLive?: boolean;
  onPress?: () => void;
  locale?: 'en' | 'ko' | 'zh';
}> = ({ seller, isLive, onPress, locale = 'en' }) => {
  const { t } = useTranslation();
  const name = seller.userName || seller.nickname || seller.sellerName || 'TM SUNSHINE';
  const avatar = seller.picUrl || seller.sellerAvatar || 'https://via.placeholder.com/80.png?text=S';
  const viewers = seller.onlineViewers ?? seller.viewerCount ?? seller.watchingCount ?? 90;

  // Map currentLiveStatuses from search API to product rows
  const liveStatuses = seller.currentLiveStatuses || [];
  const products = liveStatuses.length > 0
    ? liveStatuses.map((s: any) => ({
        imageUrl: s.productImageUrl || '',
        title: s.productTitle?.[locale] || s.productTitle?.en || '',
        status: s.status || '',
      }))
    : seller.products || [];

  return (
    <TouchableOpacity style={styles.sellerCard} activeOpacity={0.8} onPress={onPress}>
      {/* Avatar with LIVE ring */}
      <View style={styles.sellerAvatarWrapper}>
        <View style={[styles.sellerAvatarRing, isLive && styles.sellerAvatarRingLive]}>
          <Image source={{ uri: avatar }} style={styles.sellerAvatar} />
        </View>
        {isLive && (
          <View style={styles.sellerLiveBadge}>
            <Text style={styles.sellerLiveBadgeText}>{t('live.live')}</Text>
          </View>
        )}
      </View>

      {/* Name and viewers */}
      <Text style={styles.sellerName} numberOfLines={1}>{name}</Text>
      <Text style={styles.sellerViewers}>{t('live.onlineViewers')} {viewers}</Text>

      {/* Products list */}
      {products.slice(0, 2).map((prod: any, idx: number) => (
        <View key={idx} style={styles.sellerProductRow}>
          <Image
            source={{ uri: prod.imageUrl || prod.productImageUrl || prod.image || 'https://via.placeholder.com/30x30.png?text=P' }}
            style={styles.sellerProductImage}
          />
          <View style={styles.sellerProductInfo}>
            <Text style={styles.sellerProductTitle} numberOfLines={1}>
              {prod.title || prod.name || `Product ${idx + 1}`}
            </Text>
            <Text style={styles.sellerProductShopNow}>{t('live.shopNow').replace('{arrow}', '>')}</Text>
          </View>
        </View>
      ))}
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────
const LiveSellerSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialQuery = route.params?.query || '';
  // Default to 'products' per spec; can be overridden by the calling
  // screen via the `searchMode` route param.
  type LiveSearchMode = 'sellers' | 'products';
  const initialMode: LiveSearchMode =
    (route.params?.searchMode as LiveSearchMode) || 'products';
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<LiveSearchMode>(initialMode);
  const [searchModeDropdownOpen, setSearchModeDropdownOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('bestMatch');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Products-mode state — mirrors LiveSellerDetailScreen so the UI/UX is
  // identical (search input, '전체 상품' category dropdown, filter tabs,
  // date dropdown).
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('bestMatch');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Fallback: load from live commerce main data when no search query
  const {
    mutate: fetchLiveCommerce,
    data: liveCommerceData,
    isLoading: isLoadingFallback,
  } = useLiveCommerceMutation();

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    } else {
      fetchLiveCommerce();
    }
  }, []);

  const performSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setHasSearched(false);
      fetchLiveCommerce();
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const response = await productsApi.searchLiveCommerceSellers(q, { page: 1, pageSize: 20 });
      if (response.success && response.data) {
        const mapped = response.data.results.map((seller: any) => {
          const statuses = seller.currentLiveStatuses || [];
          const hasLive = statuses.some((s: any) => s.status === 'live');
          return {
            ...seller,
            isLive: hasLive,
            onlineViewers: seller.totalViews || 0,
          };
        });
        setSearchResults(mapped);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Build fallback seller list from live commerce data
  const fallbackSellers = useMemo(() => {
    if (!liveCommerceData) return [];

    const sellers: any[] = [];
    const seenIds = new Set<string>();

    const partnerSellers = asArray(liveCommerceData.pointSellers).length > 0
      ? asArray(liveCommerceData.pointSellers)
      : asArray(liveCommerceData.pointPartnerSellers);
    partnerSellers.forEach((s: any) => {
      const id = s._id || s.id || s.userName;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        sellers.push({ ...s, isLive: (s.currentLiveStatus || '').toLowerCase() === 'live' || !!s.isLive });
      }
    });

    const topSellers = asArray(liveCommerceData.topSellers).length > 0
      ? asArray(liveCommerceData.topSellers)
      : asArray(liveCommerceData.top10Sellers);
    topSellers.forEach((s: any) => {
      const id = s._id || s.id || s.userName;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        sellers.push({ ...s, isLive: false });
      }
    });

    const schedule = asArray(liveCommerceData.liveStreamSchedule).length > 0
      ? asArray(liveCommerceData.liveStreamSchedule)
      : asArray(liveCommerceData.schedule);
    schedule.forEach((item: any) => {
      const s = item.seller || item;
      const id = s._id || s.id || s.userName || item.sellerId;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        sellers.push({
          ...s,
          isLive: (item.status || item.currentLiveStatus || '').toLowerCase() === 'live',
          onlineViewers: item.viewerCount || item.watchingCount || 0,
        });
      }
    });

    return sellers;
  }, [liveCommerceData]);

  // Use search results when searched, fallback otherwise
  const displaySellers = useMemo(() => {
    const source = hasSearched ? searchResults : fallbackSellers;
    let result = [...source];

    switch (sortOption) {
      case 'viewers':
        result.sort((a, b) => (b.onlineViewers || 0) - (a.onlineViewers || 0));
        break;
      case 'newest':
        result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      default:
        result.sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          return (b.onlineViewers || 0) - (a.onlineViewers || 0);
        });
        break;
    }

    return result;
  }, [searchResults, fallbackSellers, hasSearched, sortOption]);

  // Flatten the live products carried by each seller's `currentLiveStatuses`
  // (or any compatible `products` array) so products mode can render them
  // as a single grid like LiveSellerDetailScreen does for one seller.
  const allLiveProducts = useMemo(() => {
    const out: any[] = [];
    displaySellers.forEach((seller: any) => {
      const sellerId = seller._id || seller.id || seller.sellerId || '';
      const sellerName = seller.userName || seller.nickname || seller.sellerName || '';
      const statuses = Array.isArray(seller.currentLiveStatuses) ? seller.currentLiveStatuses : [];
      const items = statuses.length > 0
        ? statuses
        : Array.isArray(seller.products) ? seller.products : [];
      items.forEach((it: any, idx: number) => {
        const id = it.productId || it.id || it._id || `${sellerId}-${idx}`;
        const title =
          it.productTitle?.[locale] ||
          it.productTitle?.en ||
          it.title ||
          it.name ||
          '';
        const image = it.productImageUrl || it.imageUrl || it.image || '';
        const price = parseFloat(String(it.price ?? it.salePrice ?? 0));
        const originalPrice = parseFloat(String(it.originalPrice ?? it.tagPrice ?? 0));
        const liveDateRaw =
          it.liveDate || it.broadcastDate || it.startedAt || it.createdAt || null;
        const liveDate = (() => {
          if (!liveDateRaw) return '';
          const d = new Date(liveDateRaw as any);
          if (isNaN(d.getTime())) return '';
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        const { listProductCode, listProductItemNumber, listProductCost } =
          getLiveSellerListingProductMeta(it);
        out.push({
          id: String(id),
          externalId: String(id),
          image,
          price,
          originalPrice,
          title,
          name: title,
          category: it.category || it.categoryName || '',
          liveDate,
          soldCount: it.itemsSold || it.soldCount || 0,
          reviewCount: it.reviewNumbers || it.reviewCount || 0,
          createdAt: it.createdAt ? new Date(it.createdAt).getTime() : 0,
          inStock: it.inStock !== false,
          liveCode: pickLiveSellerRawLiveCode(it) || undefined,
          offerId: getLiveSellerOfferId(it),
          raw: it,
          sellerId,
          sellerName,
          source: 'live-commerce',
          listProductCode,
          listProductItemNumber,
          listProductCost,
        });
      });
    });
    return out;
  }, [displaySellers, locale]);

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    allLiveProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [allLiveProducts]);

  const dateGroups = useMemo(() => {
    const set = new Set<string>();
    allLiveProducts.forEach((p) => {
      if (p.liveDate) set.add(p.liveDate);
    });
    return ['all', ...Array.from(set).sort((a, b) => b.localeCompare(a))];
  }, [allLiveProducts]);

  const formatDateLabel = useCallback(
    (key: string) => {
      if (key === 'all') return t('live.allDates') || 'All dates';
      const d = new Date(`${key}T00:00:00`);
      if (isNaN(d.getTime())) return key;
      return d.toLocaleDateString();
    },
    [t],
  );

  const filteredProducts = useMemo(() => {
    let result = [...allLiveProducts];

    const keyword = productSearchQuery.trim().toLowerCase();
    if (keyword) {
      result = result.filter((p) =>
        String(p.title || p.name || '').toLowerCase().includes(keyword),
      );
    }
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }
    if (selectedDate !== 'all') {
      result = result.filter((p) => p.liveDate === selectedDate);
    }
    switch (activeFilter) {
      case 'sales':
        result.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
        break;
      case 'newArrivals':
        result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      default:
        break;
    }
    return result;
  }, [allLiveProducts, productSearchQuery, selectedCategory, selectedDate, activeFilter]);

  const isLoading = isSearching || isLoadingFallback;

  const handleSellerPress = useCallback((seller: any) => {
    const sellerId = seller._id || seller.id || seller.sellerId || '';
    const sellerName = seller.userName || seller.nickname || seller.sellerName || '';
    navigation.navigate('LiveSellerDetail', {
      sellerId,
      sellerName,
      source: 'ownmall',
    });
  }, [navigation]);

  const handleSearch = useCallback(() => {
    performSearch(searchText);
  }, [searchText, performSearch]);

  const sortLabels: Record<SortOption, string> = {
    bestMatch: t('live.bestMatch'),
    viewers: t('live.mostViewers'),
    newest: t('live.newest'),
  };

  const renderProduct = useCallback(({ item }: { item: any }) => {
    const imageUri = item.image || '';
    const price = item.price || 0;
    const originalPrice = item.originalPrice || 0;
    const title = item.title || item.name || '';
    const dimImage = item.inStock === false;

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.8}
        onPress={() => {
          const codeForNav = getLiveSellerProductCodeRowDisplayValue(item);
          navigation.navigate('ProductDetail', {
            productId: item.id,
            offerId: item.externalId,
            source: 'live-commerce',
            ...(codeForNav ? { liveCode: codeForNav } : {}),
          });
        }}
      >
        <Image
          source={{ uri: imageUri || `https://via.placeholder.com/${IMAGE_CONFIG.PRODUCT_DISPLAY_PIXEL}.png?text=Product` }}
          style={[styles.productImage, dimImage && { opacity: 0.5 }]}
          resizeMode="cover"
        />
        <View style={styles.productInfoContainer}>
          <Text style={styles.productPrice}>{formatPriceKRW(price)}</Text>
          {originalPrice > 0 && originalPrice > price && (
            <Text style={styles.productOriginalPrice}>{formatPriceKRW(originalPrice)}</Text>
          )}
          <Text style={styles.productTitle} numberOfLines={2}>{title}</Text>
          {(() => {
            const codeVal = getLiveSellerProductCodeRowDisplayValue(item);
            return codeVal ? (
            <Text style={styles.productListingDetail} numberOfLines={1}>
              {t('product.productCode')}: {codeVal}
            </Text>
            ) : null;
          })()}
          {(() => {
            const numVal = getLiveSellerProductItemNumberRowDisplayValue(item);
            return numVal ? (
            <Text style={styles.productListingDetail} numberOfLines={1}>
              {t('product.productItemNumber')}: {numVal}
            </Text>
            ) : null;
          })()}
          {item.listProductCost != null && (
            <Text style={styles.productListingDetail} numberOfLines={1}>
              {t('product.productCost')}: {formatPriceKRW(item.listProductCost)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [navigation, t]);

  const productKeyExtractor = useCallback((item: any, index: number) =>
    item.id || item.externalId || `live-product-${index}`, []);

  const renderSellerItem = useCallback(({ item }: { item: any }) => (
    <SellerCard
      seller={item}
      isLive={item.isLive}
      locale={locale}
      onPress={() => handleSellerPress(item)}
    />
  ), [handleSellerPress]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('live.noSellersFound')}</Text>
      </View>
    );
  }, [isLoading]);

  const keyExtractor = useCallback((item: any, index: number) =>
    item._id || item.id || `seller-${index}`, []);

  return (
    <View style={styles.container}>
      {/* Gradient background - same as homepage */}
      <LinearGradient
        colors={['#FF0000', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBackground}
        pointerEvents="none"
      />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header - back button + LIVE / CHANNEL chip */}
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={BACK_NAVIGATION_HIT_SLOP}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Main', { screen: 'Live' });
                }
              }}
            >
              <ArrowBackIcon width={20} height={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerLeft}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Main', { screen: 'Live' })}
            >
              <View style={styles.broadcastIconContainer}>
                <SensorsIcon width={24} height={24} />
              </View>
              <View>
                <Text style={styles.headerTitle}>{t('live.live')}</Text>
                <Text style={styles.headerSubtitle}>{t('live.channel')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={styles.sellerDropdown}
              onPress={() => setSearchModeDropdownOpen((o) => !o)}
              activeOpacity={0.8}
            >
              <Text style={styles.sellerDropdownText}>
                {searchMode === 'sellers'
                  ? t('live.searchModeSeller') || 'Seller Search'
                  : t('live.searchModeProduct') || 'Product Search'}
              </Text>
              <ArrowDropDownIcon width={8} height={8} color={COLORS.white} />
            </TouchableOpacity>

            {/* Two-item menu — same UX as the LiveScreen dropdown. Picking
                a mode just switches state; user must press Search (or hit
                Enter) to actually re-fetch. */}
            {searchModeDropdownOpen && (
              <View style={styles.searchModeMenu}>
                <TouchableOpacity
                  style={[
                    styles.searchModeMenuItem,
                    searchMode === 'sellers' && styles.searchModeMenuItemActive,
                  ]}
                  onPress={() => {
                    setSearchMode('sellers');
                    setSearchModeDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.searchModeMenuItemText}>
                    {t('live.searchModeSeller') || 'Seller Search'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.searchModeMenuItem,
                    searchMode === 'products' && styles.searchModeMenuItemActive,
                  ]}
                  onPress={() => {
                    setSearchMode('products');
                    setSearchModeDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.searchModeMenuItemText}>
                    {t('live.searchModeProduct') || 'Product Search'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('live.searchNow')}
              placeholderTextColor={COLORS.white}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>{t('common.search')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Sort bar - outside FlatList so dropdown renders on top */}
      <View style={{backgroundColor: '#FFFFFFA1', paddingBottom: SPACING.sm, flex: 1}}>
        {searchMode === 'products' ? (
          <>
            {/* Category pill + product search input */}
            <View style={styles.productSearchRow}>
              <View style={styles.categoryDropdownContainer}>
                <TouchableOpacity
                  style={styles.categoryDropdown}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={styles.categoryDropdownText} numberOfLines={1}>
                    {selectedCategory === 'all' ? (t('live.allItems') || '전체 상품') : selectedCategory}
                  </Text>
                  <ArrowDropDownIcon width={16} height={16} color={COLORS.text.primary} />
                </TouchableOpacity>
                {showCategoryDropdown && (
                  <View style={styles.categoryDropdownMenuInline}>
                    {productCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryDropdownItem,
                          selectedCategory === cat && styles.categoryDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSelectedCategory(cat);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryDropdownItemText,
                            selectedCategory === cat && styles.categoryDropdownItemTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {cat === 'all' ? (t('live.allItems') || '전체 상품') : cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.productSearchInputWrap}>
                <SearchIcon width={16} height={16} color={COLORS.text.secondary} />
                <TextInput
                  style={styles.productSearchInput}
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  placeholder={t('live.searchNow')}
                  placeholderTextColor={COLORS.text.secondary}
                  returnKeyType="search"
                />
              </View>
            </View>

            {/* Date dropdown — below search row; opens modal. Hidden when no dates. */}
            {dateGroups.length > 1 && (
              <TouchableOpacity
                style={styles.dateDropdown}
                activeOpacity={0.8}
                onPress={() => setShowDateDropdown(true)}
              >
                <Text style={styles.dateDropdownText}>{formatDateLabel(selectedDate)}</Text>
                <ArrowDropDownIcon width={18} height={18} color={COLORS.text.primary} />
              </TouchableOpacity>
            )}

            {/* Filter Tabs */}
            <View style={styles.filterTabsContainer}>
              <TouchableOpacity
                style={[styles.filterTab, activeFilter === 'bestMatch' && styles.filterTabActive]}
                onPress={() => setActiveFilter('bestMatch')}
              >
                <Text style={[styles.filterTabText, activeFilter === 'bestMatch' && styles.filterTabTextActive]}>
                  {t('live.bestMatch')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, activeFilter === 'sales' && styles.filterTabActive]}
                onPress={() => setActiveFilter('sales')}
              >
                <Text style={[styles.filterTabText, activeFilter === 'sales' && styles.filterTabTextActive]}>
                  {t('live.sales')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, activeFilter === 'newArrivals' && styles.filterTabActive]}
                onPress={() => setActiveFilter('newArrivals')}
              >
                <Text style={[styles.filterTabText, activeFilter === 'newArrivals' && styles.filterTabTextActive]}>
                  {t('live.newArrivals')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Product grid */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={filteredProducts}
                renderItem={renderProduct}
                keyExtractor={productKeyExtractor}
                numColumns={3}
                columnWrapperStyle={styles.productsRow}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={isLoading} onRefresh={() => fetchLiveCommerce()} />
                }
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.sortContainer}>
              <Text style={styles.sortLabel}>{t('live.sortBy')}</Text>
              <TouchableOpacity
                style={styles.sortDropdown}
                onPress={() => setShowSortDropdown(!showSortDropdown)}
              >
                <Text style={styles.sortDropdownText}>{sortLabels[sortOption]}</Text>
                <ArrowDropDownIcon width={12} height={12} color={COLORS.text.primary} />
              </TouchableOpacity>

              {showSortDropdown && (
                <View style={styles.sortDropdownMenu}>
                  {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.sortDropdownItem,
                        sortOption === key && styles.sortDropdownItemActive,
                      ]}
                      onPress={() => {
                        setSortOption(key);
                        setShowSortDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.sortDropdownItemText,
                          sortOption === key && styles.sortDropdownItemTextActive,
                        ]}
                      >
                        {sortLabels[key]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {/* Seller grid */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={displaySellers}
                renderItem={renderSellerItem}
                keyExtractor={keyExtractor}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={isLoading} onRefresh={() => fetchLiveCommerce()} />
                }
              />
            )}
          </>
        )}
      </View>

      {/* Date Dropdown Modal — products mode */}
      <Modal
        visible={showDateDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateDropdown(false)}
        >
          <View style={styles.dropdownModalContent}>
            {dateGroups.map((d) => (
              <TouchableOpacity
                key={`date-${d}`}
                style={[
                  styles.categoryDropdownItem,
                  selectedDate === d && styles.categoryDropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedDate(d);
                  setShowDateDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryDropdownItemText,
                    selectedDate === d && styles.categoryDropdownItemTextActive,
                  ]}
                >
                  {formatDateLabel(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 350,
    zIndex: 0,
  },
  safeArea: {
    zIndex: 1,
  },

  // ─── Header ─────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.smmd,
    zIndex: 1,
    alignItems: 'flex-end',
  },
  // Wraps the back button + the LIVE/CHANNEL chip on the left side of
  // the header so they stay together while the right side is free for
  // future actions (e.g. share, bookmark).
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  broadcastIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '900',
    color: COLORS.white,
    fontFamily: FONTS.families.black,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: FONTS.families.bold,
  },
  headerSearchBtn: {
    padding: SPACING.xs,
  },

  // ─── Search Bar (matches LiveScreen) ─────────────────────
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.smmd,
  },
  sellerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00000044',
    borderTopLeftRadius: BORDER_RADIUS.full,
    borderBottomLeftRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    height: 40,
    gap: SPACING.xs,
  },
  sellerDropdownText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.white,
    marginRight: 2,
  },
  // Two-item mode menu opened by tapping the seller dropdown. Absolute
  // positioning keeps it from disturbing the search-bar layout; elevation
  // / shadow / zIndex put it above the input on both platforms.
  searchModeMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 140,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.xs,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 50,
  },
  searchModeMenuItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchModeMenuItemActive: {
    backgroundColor: COLORS.gray[100],
  },
  searchModeMenuItemText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  searchInputWrapper: {
    flex: 1,
    height: 40,
    backgroundColor: '#00000033',
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    paddingHorizontal: SPACING.sm,
    fontWeight: '400',
    height: 40,
    padding: 0,
  },
  searchButton: {
    backgroundColor: '#00000033',
    borderTopRightRadius: BORDER_RADIUS.full,
    borderBottomRightRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ─── Sort ───────────────────────────────────────────────
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.smmd,
    position: 'relative',
    zIndex: 10,
  },
  sortLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingHorizontal: SPACING.smmd,
    paddingVertical: SPACING.xs,
  },
  sortDropdownText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginRight: SPACING.xs,
  },
  sortDropdownMenu: {
    position: 'absolute',
    top: 48,
    left: SPACING.md + 60,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 20,
    minWidth: 140,
  },
  sortDropdownItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.smmd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  sortDropdownItemActive: {
    backgroundColor: COLORS.gray[50],
  },
  sortDropdownItemText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
  },
  sortDropdownItemTextActive: {
    fontWeight: '700',
    color: COLORS.red,
  },

  // ─── Grid ───────────────────────────────────────────────
  listContent: {
    paddingBottom: 100,
  },
  gridRow: {
    paddingHorizontal: SPACING.md,
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },

  // ─── Seller Card ────────────────────────────────────────
  sellerCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.smmd,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  sellerAvatarWrapper: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sellerAvatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sellerAvatarRingLive: {
    borderColor: '#FF0000',
  },
  sellerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  sellerLiveBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: '#FF0000',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sellerLiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
  },
  sellerName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  sellerViewers: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  sellerProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: SPACING.xssm,
  },
  sellerProductImage: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.gray[200],
  },
  sellerProductInfo: {
    flex: 1,
  },
  sellerProductTitle: {
    fontSize: 11,
    color: COLORS.text.primary,
  },
  sellerProductShopNow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF0000',
  },

  // ─── Empty / Loading ────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    width: '100%',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
  },

  // ─── Products mode (mirrors LiveSellerDetailScreen) ────────
  productSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.smmd,
    zIndex: 10,
  },
  categoryDropdownContainer: {
    position: 'relative',
    width: '25%',
    minWidth: 60,
    zIndex: 10,
  },
  categoryDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.sm,
    minHeight: 40,
  },
  categoryDropdownText: {
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 2,
  },
  categoryDropdownMenuInline: {
    position: 'absolute',
    top: '110%',
    left: 0,
    minWidth: '100%',
    maxHeight: '150%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 30,
  },
  categoryDropdownItem: {
    paddingHorizontal: SPACING.smmd,
    paddingVertical: SPACING.smmd,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  categoryDropdownItemActive: {
    backgroundColor: COLORS.gray[50],
  },
  categoryDropdownItemText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
  },
  categoryDropdownItemTextActive: {
    fontWeight: '700',
    color: COLORS.red,
  },
  productSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.smmd,
    paddingVertical: SPACING.sm,
  },
  productSearchInput: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    padding: 0,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.smmd,
    gap: SPACING.md,
  },
  filterTab: {
    paddingBottom: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: COLORS.red,
  },
  filterTabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  filterTabTextActive: {
    fontWeight: '700',
    color: COLORS.red,
  },
  dateDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.smmd,
  },
  dateDropdownText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  dropdownModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  productsRow: {
    paddingHorizontal: SPACING.md,
    gap: PRODUCT_GAP,
    marginBottom: PRODUCT_GAP,
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: PRODUCT_CARD_WIDTH * 1.5,
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
  },
  productInfoContainer: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  productPrice: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '800',
    color: COLORS.red,
  },
  productOriginalPrice: {
    fontSize: 11,
    color: COLORS.text.secondary,
    textDecorationLine: 'line-through' as const,
  },
  productTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginTop: 2,
  },
  productListingDetail: {
    fontSize: 10,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
});

export default LiveSellerSearchScreen;
