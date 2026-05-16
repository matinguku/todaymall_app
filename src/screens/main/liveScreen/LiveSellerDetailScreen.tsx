import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  ActivityIndicator,
  FlatList,
  Modal,
  Linking,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../components/Text';
import Icon from '../../../components/Icon';
import KakaoTalkFloatingButton from '../../../components/KakaoTalkFloatingButton';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, SCREEN_WIDTH, IMAGE_CONFIG, BACK_NAVIGATION_HIT_SLOP } from '../../../constants';
import ArrowBackIcon from '../../../assets/icons/ArrowBackIcon';
import { productsApi } from '../../../services/productsApi';
import { useToast } from '../../../context/ToastContext';
import { useAppSelector } from '../../../store/hooks';
import { useWishlistStatus } from '../../../hooks/useWishlistStatus';
import { useAddToWishlistMutation } from '../../../hooks/useAddToWishlistMutation';
import { useDeleteFromWishlistMutation } from '../../../hooks/useDeleteFromWishlistMutation';
import { useAuth } from '../../../context/AuthContext';
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

const { width } = Dimensions.get('window');
/** Horizontal + vertical gutter between product cards (2-column grid). */
const PRODUCT_GAP = 10;
const PRODUCT_COLUMN_COUNT = 2;
const PRODUCT_CARD_WIDTH = (width - SPACING.md * 2 - PRODUCT_GAP * (PRODUCT_COLUMN_COUNT - 1)) / PRODUCT_COLUMN_COUNT;
/** Image height vs card width — slightly shorter than 3-up so two-column cards stay balanced. */
const PRODUCT_IMAGE_ASPECT = 1.28;

type FilterTab = 'bestMatch' | 'sales' | 'newArrivals';

const getLiveCommerceItemTitle = (item: any, locale: 'en' | 'ko' | 'zh') => {
  const product = item?.product || {};
  if (locale === 'ko') return product.titleKo || product.titleEn || product.titleZh || item?.liveTitle || '';
  if (locale === 'zh') return product.titleZh || product.titleEn || product.titleKo || item?.liveTitle || '';
  return product.titleEn || product.titleKo || product.titleZh || item?.liveTitle || '';
};

const LiveSellerDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { sellerId, sellerName, source = 'ownmall', country = 'en' } = route.params || {};
  const { showToast } = useToast();
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const { isProductLiked, refreshExternalIds, addExternalId, removeExternalId } = useWishlistStatus();

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('bestMatch');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced copy of the search keyword. The filter pipeline reads this
  // instead of `searchQuery` so that rapid typing doesn't re-walk the full
  // product list on every keystroke.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);
  // Date filter (YYYY-MM-DD). 'all' shows every product regardless of
  // broadcast date. The trigger in the list header opens a Modal that
  // lets the user pick a different date.
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>({
    id: sellerId,
    name: sellerName || 'TM SUNSHINE',
    avatar: 'https://via.placeholder.com/80.png?text=S',
    onlineViewers: 0,
    isLive: false,
    totalViews: 0,
    totalItemsSold: 0,
  });

  // Scroll to top
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const isFetchingProductsRef = useRef(false);

  // Window-relative position of the date dropdown trigger. Measured via
  // measureInWindow() when the user taps the trigger — used to absolutely
  // place the dropdown menu (rendered in a Modal) directly below it,
  // avoiding z-stacking conflicts with the FlatList below the header.
  const dateTriggerRef = useRef<View | null>(null);
  const [dateAnchor, setDateAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // ─── Wishlist mutations ───────────────────────────────────
  const { mutate: addToWishlist } = useAddToWishlistMutation({
    onSuccess: async () => {
      showToast(t('product.productAddedToWishlist') || 'Product added to wishlist', 'success');
      await refreshExternalIds();
    },
    onError: (error) => {
      showToast(error || t('product.failedToAddToWishlist'), 'error');
    },
  });

  const { mutate: deleteFromWishlist } = useDeleteFromWishlistMutation({
    onSuccess: async () => {
      showToast(t('product.productRemovedFromWishlist'), 'success');
      await refreshExternalIds();
    },
    onError: (error) => {
      showToast(error || t('product.failedToRemoveFromWishlist'), 'error');
    },
  });

  const toggleWishlist = async (product: any) => {
    if (!user || !isAuthenticated) {
      showToast(t('home.pleaseLogin') || 'Please login first', 'warning');
      return;
    }

    const externalId = product.externalId?.toString() || product.id?.toString() || '';
    if (!externalId) {
      showToast(t('product.invalidProductId'), 'error');
      return;
    }

    const isLiked = isProductLiked(product);
    const productSource = product.source || source || 'ownmall';

    if (isLiked) {
      await removeExternalId(externalId);
      deleteFromWishlist(externalId);
    } else {
      const imageUrl = product.image || product.main_image_url || '';
      const price = parseFloat(product.price || 0);
      const title = product.name || product.title || '';

      if (!imageUrl || !title || price <= 0) {
        showToast(t('product.invalidProductData'), 'error');
        return;
      }

      await addExternalId(externalId);
      addToWishlist({ offerId: externalId, platform: productSource });
    }
  };

  // ─── Follow / Unfollow ────────────────────────────────────
  const handleToggleFollow = async () => {
    if (!user || !isAuthenticated) {
      showToast(t('home.pleaseLogin') || 'Please login first', 'warning');
      return;
    }

    if (isFollowing) {
      setShowUnfollowModal(true);
    } else {
      await performToggleFollow('follow');
    }
  };

  const performToggleFollow = async (action: 'follow' | 'unfollow') => {
    setIsTogglingFollow(true);
    try {
      const platform = '1688';

      if (action === 'follow') {
        const productsToSend = allProducts.slice(0, 2).map((product: any) => ({
          offerId: product.externalId || product.id || '',
          title: product.name || product.title || '',
          imageUrl: product.image || '',
          price: product.price?.toString() || '0',
        }));

        const response = await productsApi.followStoreWithProducts(
          sellerId,
          sellerName || 'Store',
          productsToSend,
          platform
        );

        if (response.success) {
          setIsFollowing(true);
          showToast(t('live.storeFollowedSuccessfully'), 'success');
        } else {
          showToast(response.message || t('live.failedToFollowStore'), 'error');
        }
      } else {
        const response = await productsApi.toggleFollowStore(sellerId, platform, 'unfollow');

        if (response.success) {
          setIsFollowing(false);
          showToast(t('live.storeUnfollowedSuccessfully'), 'success');
        } else {
          showToast(response.message || t('live.failedToUnfollowStore'), 'error');
        }
      }
    } catch (error) {
      showToast(`Failed to ${action} store`, 'error');
    } finally {
      setIsTogglingFollow(false);
      setShowUnfollowModal(false);
    }
  };

  // ─── Fetch products ───────────────────────────────────────
  const fetchProducts = async (page: number = 1, append: boolean = false) => {
    if (isFetchingProductsRef.current) return;
    isFetchingProductsRef.current = true;
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await productsApi.getLiveCommerceSellerDetail(sellerId, {
        page,
        pageSize: 20,
      });

      if (response.success && response.data) {
        const liveSeller = response.data.liveSeller || {};
        const items = response.data.items || [];

        // TEMP DEBUG: dump the first item so we can see exactly which
        // field carries the live code in the API response. Remove once
        // the live-order tagging is confirmed end-to-end.
        if (items[0]) {
          console.log('[liveCode][LiveSellerDetail] first item keys:', Object.keys(items[0]));
          console.log('[liveCode][LiveSellerDetail] first item:', JSON.stringify(items[0]).slice(0, 1500));
        }

        const mappedProducts = items.map((item: any) => {
          const parseNumberish = (value: any): number | null => {
            if (typeof value === 'number' && !isNaN(value)) return value;
            if (typeof value === 'string') {
              const parsed = parseInt(value, 10);
              return isNaN(parsed) ? null : parsed;
            }
            return null;
          };

          const skuInfos =
            (Array.isArray(item?.product?.productSkuInfos) ? item.product.productSkuInfos : null) ||
            (Array.isArray(item?.product?.productData?.productSkuInfos) ? item.product.productData.productSkuInfos : null) ||
            (Array.isArray(item?.productData?.productSkuInfos) ? item.productData.productSkuInfos : null) ||
            [];

          const stockFromSkus =
            skuInfos.length > 0
              ? skuInfos.reduce((sum: number, s: any) => {
                  const v = parseNumberish(s?.amountOnSale);
                  return sum + (v != null ? v : 0);
                }, 0)
              : null;
          // Try every reasonable field name the backend might use for
          // the live-broadcast code. Falls back to scanning the product
          // sub-object too. The order goes from most-specific to most-
          // generic so a real liveCode field wins over generic codes.
          const liveCodeStr = pickLiveSellerRawLiveCode(item) || undefined;

          // Pull a date out of whichever field the API exposes; we
          // store it as `YYYY-MM-DD` so products from the same broadcast
          // day group together regardless of their exact timestamps.
          const liveDateRaw: string | number | null =
            item.liveDate ||
            item.live_date ||
            item.broadcastDate ||
            item.broadcast_date ||
            item.liveStartTime ||
            item.startedAt ||
            item.startAt ||
            item.date ||
            item.createdAt ||
            null;
          const liveDateKey = (() => {
            if (!liveDateRaw) return '';
            const d = new Date(liveDateRaw as any);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })();

          const { listProductCode, listProductItemNumber, listProductCost } =
            getLiveSellerListingProductMeta(item);

          return {
            id: item.productId || item.product?.id || item.id || '',
            externalId: item.productId || item.product?.id || item.id || '',
            name: getLiveCommerceItemTitle(item, locale),
            title: getLiveCommerceItemTitle(item, locale),
            image: item.product?.imageUrl || item.imageUrl || item.mediaUrl || '',
            price: parseFloat(String(item.product?.price ?? 0)),
            originalPrice: parseFloat(String(item.product?.price ?? item.product?.promotionPrice ?? 0)),
            // Tag this product as live-origin so ProductDetail's
            // resolveLiveCode() picks it up. ProductDetail maps this
            // back to 'ownmall' internally for API routing.
            source: 'live-commerce',
            liveCode: liveCodeStr,
            label: item.isHotProduct ? t('live.hotProduct') : (item.status || t('live.live')),
            soldCount: item.itemsSold || 0,
            reviewCount: item.reviewNumbers || 0,
            rating: item.reviewScore || 0,
            category: item.product?.categoryName?.[locale] || item.product?.categoryName?.en || '',
            liveTitle: item.liveTitle || '',
            status: item.status || '',
            // stockCount: total units across every SKU on the product.
            // The live API mirrors the detail API's structure — each
            // SKU under product.productSkuInfos[] carries an
            // `amountOnSale` count. Sum them so a product with one
            // sold-out color and one in-stock color isn't falsely
            // dimmed. Direct fallback paths cover backends that
            // pre-aggregate the value.
            stockCount: (() => {
              if (typeof item.stockCount === 'number') return item.stockCount;
              if (stockFromSkus != null) return stockFromSkus;
              const amountOnSaleCandidates = [
                item.amountOnSale,
                item.product?.amountOnSale,
                item.productData?.amountOnSale,
                item.product?.productData?.amountOnSale,
                item.product?.productSaleInfo?.amountOnSale,
                item.productData?.productSaleInfo?.amountOnSale,
              ];
              for (const c of amountOnSaleCandidates) {
                const parsed = parseNumberish(c);
                if (parsed != null) return parsed;
              }
              return 0;
            })(),
            // inStock: derived from the same SKU sum so the two fields
            // can't drift apart. `true` when at least one SKU has
            // amountOnSale > 0; `false` when every SKU is 0.
            // Defaults to `true` when no stock data is available so
            // cards without stock info aren't falsely dimmed.
            inStock: (() => {
              if (typeof item.inStock === 'boolean') return item.inStock;
              if (stockFromSkus != null) return stockFromSkus > 0;
              return true;
            })(),
           
            // Date classification: empty string when the API didn't ship
            // a date — those products end up in their own bucket.
            liveDate: liveDateKey,
            liveDateRaw: liveDateRaw ? String(liveDateRaw) : '',
            raw: item,
            offerId: getLiveSellerOfferId(item),
            listProductCode,
            listProductItemNumber,
            listProductCost,
          };
         
            
        });
        

        if (append) {
          // Dedup by id when appending — the live API can return the same
          // listing across pages and duplicates would crash the list with
          // "two children with the same key".
          const productKey = (p: any): string =>
            (p?.offerId?.toString?.()) || (p?.externalId?.toString?.()) || (p?.id?.toString?.()) || '';
          setAllProducts(prev => {
            const seen = new Set(prev.map(productKey).filter(Boolean));
            const fresh = mappedProducts.filter((p: any) => {
              const k = productKey(p);
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            return [...prev, ...fresh];
          });
          setCurrentPage(page);
        } else {
          setAllProducts(mappedProducts);
          setCurrentPage(1);
        }

        const totalOnlineViewers = items.reduce(
          (sum: number, item: any) => sum + (item.onlineViews || 0),
          0,
        );

        const liveItem = items.find((item: any) => (item.status || '').toLowerCase() === 'live');
        setSellerProfile({
          id: liveSeller._id || sellerId,
          name: liveSeller.nickname || liveSeller.userName || sellerName || 'Seller',
          avatar: liveSeller.picUrl || 'https://via.placeholder.com/80.png?text=S',
          onlineViewers: totalOnlineViewers,
          isLive: !!liveItem,
          liveLink: liveItem?.liveLink || null,
          totalViews: liveSeller.totalViews || 0,
          totalItemsSold: liveSeller.totalItemsSold || 0,
          tao10Rank: liveSeller.tao10Rank || 0,
          isPopular: !!liveSeller.isPopular,
          isPoint: !!liveSeller.isPoint,
        });

        const pagination = response.data.pagination;
        if (
          pagination &&
          typeof pagination.page === 'number' &&
          typeof pagination.pageSize === 'number' &&
          typeof pagination.total === 'number'
        ) {
          setHasMore((pagination.page * pagination.pageSize) < pagination.total);
        } else {
          // Some live endpoints return items without pagination metadata.
          // Fallback: if we received a full page, assume more may exist.
          const requestedPageSize = 20;
          setHasMore(items.length >= requestedPageSize);
        }
      } else if (append) {
        // Avoid infinite onEndReached retries when load-more fails.
        setHasMore(false);
      }
    } catch (error) {
      if (append) {
        // Avoid infinite onEndReached retries when load-more throws.
        setHasMore(false);
      }
      showToast(t('live.failedToLoadProducts'), 'error');
      console.error('[LiveSellerDetail] Failed to load products:', error);
    } finally {
      isFetchingProductsRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (sellerId) {
      fetchProducts(1, false);
    }
  }, [sellerId, locale]);

  // Extract unique categories from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [allProducts]);

  // Unique broadcast dates derived from the loaded products. Sorted
  // descending so the most recent broadcast leads the chip row, with
  // 'all' first as a reset option. Only built when there's at least
  // one dated product — otherwise the row stays hidden.
  const dateGroups = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => {
      if (p.liveDate) set.add(p.liveDate);
    });
    return ['all', ...Array.from(set).sort((a, b) => b.localeCompare(a))];
  }, [allProducts]);

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
    let result = [...allProducts];

    const keyword = debouncedSearchQuery.trim().toLowerCase();
    if (keyword) {
      result = result.filter((p) => {
        const title = String(p.title || p.name || '').toLowerCase();
        const liveCode = String(p.liveCode || '').toLowerCase();
        return title.includes(keyword) || liveCode.includes(keyword);
      });
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Filter by broadcast date
    if (selectedDate !== 'all') {
      result = result.filter((p) => p.liveDate === selectedDate);
    }

    // Sort
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
  }, [allProducts, activeFilter, selectedCategory, selectedDate, debouncedSearchQuery]);

  const handleLoadMore = useCallback(() => {
    // Stop paginating while the user has typed a search keyword or applied a
    // local filter — the filtered list is shorter than the viewport, which
    // makes FlatList fire onEndReached over and over, walking the server
    // pages even though the active keyword may never match more results.
    const isFilteringLocally =
      debouncedSearchQuery.trim().length > 0 ||
      selectedCategory !== 'all' ||
      selectedDate !== 'all';
    if (isFilteringLocally) return;
    if (!loadingMore && hasMore) {
      const nextPage = currentPage + 1;
      fetchProducts(nextPage, true);
    }
  }, [currentPage, hasMore, loadingMore, debouncedSearchQuery, selectedCategory, selectedDate]);

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.y;

    if (scrollPosition > 300 && !showScrollToTop) {
      setShowScrollToTop(true);
      Animated.timing(scrollToTopOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (scrollPosition <= 300 && showScrollToTop) {
      Animated.timing(scrollToTopOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowScrollToTop(false));
    }
  };

  // ─── List Header (Seller profile + filters) ──────────────
  const renderListHeader = () => (
    <View>
      {/* Seller Profile Section */}
      <View style={styles.sellerProfileSection}>
        <View style={styles.sellerProfileRow}>
          {/* Seller name on left */}
          <Text style={styles.sellerName} numberOfLines={1}>{sellerProfile.name}</Text>

          {/* Avatar center */}
          <View style={styles.sellerAvatarContainer}>
            <View style={styles.sellerAvatarRing}>
              <Image
                source={{ uri: sellerProfile.avatar }}
                style={styles.sellerAvatar}
              />
            </View>
            {sellerProfile.isLive && (
              <TouchableOpacity
                style={styles.sellerLiveBadge}
                onPress={() => {
                  if (sellerProfile.liveLink) {
                    Linking.openURL(sellerProfile.liveLink).catch(() => {});
                  } else {
                    navigation.navigate('Live' as never);
                  }
                }}
              >
                <Text style={styles.sellerLiveBadgeText}>{t('live.live')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Viewers + Watch on right */}
          <View style={styles.sellerRightInfo}>
            <Text style={styles.sellerViewersText}>{t('live.onlineViewers')} {sellerProfile.onlineViewers}</Text>
            <TouchableOpacity
              style={styles.watchLink}
              onPress={() => {
                if (sellerProfile.liveLink) {
                  Linking.openURL(sellerProfile.liveLink).catch(() => {});
                } else {
                  navigation.navigate('Live' as never);
                }
              }}
            >
              <Text style={styles.watchLinkDot}>{'👉 '}</Text>
              <Text style={styles.watchLinkText}>{`${t('live.watch')} >`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Category + Search Row */}
      <View style={styles.searchRow}>
        <View style={styles.categoryDropdownContainer}>
          <TouchableOpacity
            style={styles.categoryDropdown}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <Text style={styles.categoryDropdownText} numberOfLines={1}>
              {selectedCategory === 'all' ? t('live.allItems') : selectedCategory}
            </Text>
            <ArrowDropDownIcon width={16} height={16} color={COLORS.text.primary} />
          </TouchableOpacity>
          {showCategoryDropdown && (
            <View style={styles.categoryDropdownMenuInline}>
              {categories.map((cat) => (
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
                    {cat === 'all' ? t('live.allItems') : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.searchInputWrap}>
          <SearchIcon width={16} height={16} color={COLORS.text.secondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('live.searchNow')}
            placeholderTextColor={COLORS.text.secondary}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Date classifier — directly under search row; toggles a dropdown
          anchored below the button. Hidden when no product carries a date. */}
      {dateGroups.length > 1 && (
        <View
          ref={(r) => { dateTriggerRef.current = r; }}
          style={styles.dateDropdownContainer}
          collapsable={false}
        >
          <TouchableOpacity
            style={[
              styles.dateDropdown,
              showDateDropdown && styles.dateDropdownOpen,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (showDateDropdown) {
                setShowDateDropdown(false);
                return;
              }
              dateTriggerRef.current?.measureInWindow((x, y, width, height) => {
                setDateAnchor({ x, y, width, height });
                setShowDateDropdown(true);
              });
            }}
          >
            <Text style={styles.dateDropdownText}>
              {formatDateLabel(selectedDate)}
            </Text>
            <ArrowDropDownIcon width={18} height={18} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>
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
    </View>
  );

  // ─── Product Card ─────────────────────────────────────────
  const renderProduct = useCallback(({ item }: { item: any }) => {
    const imageUri = item.image || '';
    const price = item.price || 0;
    const originalPrice = item.originalPrice || 0;
    const title = item.title || item.name || '';
    const reviewCount = item.reviewCount || 0;
    const soldCount = item.soldCount || 0;
    // Dim the card image at 50% opacity when the product is out of
    // stock. `stockCount === 0` is the canonical signal — it's the
    // sum of `amountOnSale` across every SKU (see the mapping above).
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
            // Always use 'live-commerce' since we're inside the live-seller
            // page, regardless of what item.source happens to be.
            source: 'live-commerce',
            // Forward resolved live numeric (explicit liveCode, title tail,
            // or offerId) so ProductDetail matches cart / order behavior.
            ...(codeForNav ? { liveCode: codeForNav } : {}),
            country: country,
          });
        }}
      >
        <Image
          source={{ uri: imageUri || `https://via.placeholder.com/${IMAGE_CONFIG.PRODUCT_DISPLAY_PIXEL}.png?text=Product` }}
          style={[styles.productImage, { height: PRODUCT_CARD_WIDTH * PRODUCT_IMAGE_ASPECT }, dimImage && { opacity: 0.5 }]}
          resizeMode="cover"
        />
        <View style={styles.productInfoContainer}>
          <Text style={styles.productPrice}>
            {formatPriceKRW(price)}
          </Text>
          {originalPrice > 0 && originalPrice > price && (
            <Text style={styles.productOriginalPrice}>
              {formatPriceKRW(originalPrice)}
            </Text>
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
          <Text style={styles.productMeta}>
            {reviewCount > 0 ? t('product.reviewsCount').replace('{count}', reviewCount.toString()) : ''}
            {reviewCount > 0 && soldCount > 0 ? ' · ' : ''}
            {soldCount > 0 ? t('product.soldCount').replace('{count}', soldCount.toLocaleString()) : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [country, navigation, t]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingMoreText}>{t('home.loadingMore')}</Text>
      </View>
    );
  }, [loadingMore, t]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('live.noProductsFound')}</Text>
      </View>
    );
  }, [loading]);

  const productKeyExtractor = useCallback((item: any, index: number) => `${item.id}-${index}`, []);

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
        {/* Header - back button + LIVE/CHANNEL chip */}
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
          {/* <TouchableOpacity style={styles.headerSearchBtn}>
            <SearchIcon width={24} height={24} color={COLORS.white} />
          </TouchableOpacity> */}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingMoreText}>{t('home.loading')}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={productKeyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.productsRow}
          ListHeaderComponent={renderListHeader()}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={12}
          windowSize={7}
          initialNumToRender={12}
          updateCellsBatchingPeriod={50}
        />
      )}

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <Animated.View style={[styles.scrollToTopButton, { opacity: scrollToTopOpacity }]}>
          <TouchableOpacity
            onPress={scrollToTop}
            style={styles.scrollToTopTouchable}
            activeOpacity={0.8}
          >
            <Icon name="chevron-up" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Date Dropdown — rendered in a transparent Modal so it always
          paints above the FlatList (which on Android wins z-stacking
          against any sibling overlay). Anchored at the trigger's measured
          window position so visually it sits flush below the button. */}
      <Modal
        visible={showDateDropdown && !!dateAnchor}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateDropdown(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowDateDropdown(false)}
        >
          {dateAnchor && (
            <View
              style={[
                styles.dateDropdownAnchoredMenu,
                {
                  top: dateAnchor.y + dateAnchor.height,
                  left: dateAnchor.x,
                  width: dateAnchor.width,
                },
              ]}
            >
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
          )}
        </TouchableOpacity>
      </Modal>

      {/* Unfollow Confirmation Modal */}
      <Modal
        visible={showUnfollowModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnfollowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('live.unfollow')}</Text>
            <Text style={styles.modalMessage}>{t('live.unfollowConfirmation')}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowUnfollowModal(false)}
                disabled={isTogglingFollow}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => performToggleFollow('unfollow')}
                disabled={isTogglingFollow}
              >
                {isTogglingFollow ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <KakaoTalkFloatingButton />
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
  },
  // Back button + LIVE/CHANNEL chip share a horizontal row on the left.
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  // Date classifier dropdown trigger — full-width row that opens the
  // Inline date dropdown. The container holds both the trigger and the
  // dropdown menu so the menu can position itself directly below the
  // trigger via absolute positioning + zIndex.
  dateDropdownContainer: {
    position: 'relative',
    marginHorizontal: SPACING.md,
    // Reduce vertical gap between the search row and "All dates".
    marginTop: SPACING.xs,
    // Increase gap between the date trigger and the filter tabs.
    marginBottom: SPACING.smmd,
    zIndex: 20,
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
  },
  // When the dropdown is open, drop the trigger's bottom rounding and
  // bottom border so the menu visually merges with it (no gap, no double
  // border between the two pieces).
  dateDropdownOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  dateDropdownText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  // Anchored dropdown menu rendered inside a Modal. `top`/`left`/`width`
  // come from the trigger's measureInWindow() so the menu sits flush
  // below the date button. Bottom corners stay rounded; the top is
  // squared so it visually merges with the open trigger.
  dateDropdownAnchoredMenu: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  broadcastIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.white,
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

  // ─── Seller Profile ─────────────────────────────────────
  sellerProfileSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  sellerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    width: 120,
    textAlign: 'right',
  },
  sellerAvatarContainer: {
    alignItems: 'center',
    marginHorizontal: SPACING.smmd,
    backgroundColor: 'COLORS.white',
    overflow: 'hidden',
  },
  sellerAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 8,
    borderColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sellerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  sellerLiveBadge: {
    position: 'absolute',
    top: 1,
    alignSelf: 'center',
    backgroundColor: '#FF0000',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 1,
  },
  sellerLiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
  },
  sellerRightInfo: {
    alignItems: 'flex-start',
    width: 120,
  },
  sellerViewersText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
  watchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  watchLinkDot: {
    fontSize: FONTS.sizes.md,
  },
  watchLinkText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.black,
  },

  // ─── Category Dropdown ──────────────────────────────────
  categoryDropdownContainer: {
    position: 'relative',
    width: '25%',
    minWidth: 60,
    zIndex: 10,
  },
  categoryDropdownContainerExpanded: {
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
  dropdownModalOverlay: {
    top: 0,
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
  categoryDropdownText: {
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 2,
  },
  categoryDropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
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

  // ─── Filter Tabs ────────────────────────────────────────
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.smmd,
    gap: SPACING.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    // Slightly tighter to balance with the date trigger row.
    marginBottom: SPACING.sm,
    zIndex: 10,
  },
  searchInputWrap: {
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
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    padding: 0,
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

  // ─── Product Grid ───────────────────────────────────────
  productsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: PRODUCT_GAP,
    marginBottom: PRODUCT_GAP + 2,
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0000000A',
  },
  productImage: {
    width: '100%',
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
  },
  productInfoContainer: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  productPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '800',
    color: COLORS.red,
  },
  productOriginalPrice: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    textDecorationLine: 'line-through' as const,
  },
  productTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: SPACING.xs / 2,
    lineHeight: 18,
  },
  productListingDetail: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  productMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs / 2,
  },

  // ─── Footer / Empty / Loading ───────────────────────────
  listContent: {
    paddingBottom: 100,
    backgroundColor: '#FFFFFFA1',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingMore: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingMoreText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
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
    fontWeight: '400',
  },

  // ─── Scroll to Top ─────────────────────────────────────
  scrollToTopButton: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: 100,
    zIndex: 999,
  },
  scrollToTopTouchable: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.red,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
    elevation: 8,
  },

  // ─── Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.xl,
    paddingVertical: SPACING.md,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalMessage: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontWeight: '400',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.red,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  confirmButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default LiveSellerDetailScreen;
