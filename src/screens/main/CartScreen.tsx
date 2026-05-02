import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, IMAGE_CONFIG, PAGINATION, BACK_NAVIGATION_HIT_SLOP } from '../../constants';
import { RootStackParamList } from '../../types';
import { usePlatformStore } from '../../store/platformStore';
import { useTranslation } from '../../hooks/useTranslation';
import { ProductCard } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useGetCartMutation } from '../../hooks/useGetCartMutation';
import { useUpdateCartItemMutation } from '../../hooks/useUpdateCartItemMutation';
import { useDeleteCartItemMutation } from '../../hooks/useDeleteCartItemMutation';
import { useClearCartMutation } from '../../hooks/useClearCartMutation';
import { useDeleteCartBatchMutation } from '../../hooks/useDeleteCartBatchMutation';
import { useCheckoutCartMutation } from '../../hooks/useCheckoutCartMutation';
import { useWishlistStatus } from '../../hooks/useWishlistStatus';
import { useAddToWishlistMutation } from '../../hooks/useAddToWishlistMutation';
import { useDeleteFromWishlistMutation } from '../../hooks/useDeleteFromWishlistMutation';
import { useRecommendationsMutation } from '../../hooks/useRecommendationsMutation';
import { Product } from '../../types';
import { formatPriceKRW, getLocalizedText } from '../../utils/i18nHelpers';
import { FlatList } from 'react-native';
import PrivacyIcon from '../../assets/icons/PrivacyIcon';
import PackageIcon from '../../assets/icons/PackageIcon';
import ThickCheckIcon from '../../assets/icons/ThickCheckIcon';
import HeartIcon from '../../assets/icons/HeartIcon';
import DeleteIcon from '../../assets/icons/DeleteIcon';
import PlusIcon from '../../assets/icons/PlusIcon';
import MinusIcon from '../../assets/icons/MinusIcon';
import { useResponsive } from '../../hooks/useResponsive';

const { width } = Dimensions.get('window');
const PRODUCT_IMG_PX = IMAGE_CONFIG.PRODUCT_DISPLAY_PIXEL;

// Mock cart data
const mockCartData = [
  {
    id: '1',
    sellerId: 'seller_123',
    sellerName: 'bbbxffvwo083i5cyz7jxtprkg',
    items: [
      {
        id: 'cart_item_1',
        productId: 'shoes_001',
        name: 'Shoes',
        color: 'space',
        size: 'M',
        price: 5.99,
        originalPrice: 7.00,
        quantity: 1,
        image: `https://picsum.photos/seed/shoes1/${PRODUCT_IMG_PX}/${PRODUCT_IMG_PX}`,
        selected: true,
      }
    ]
  }
];


type CartScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const CartScreen: React.FC = () => {
  const navigation = useNavigation<CartScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { screenWidth: dynScreenWidth, moreToLoveColumns } = useResponsive();

  // Layout-first paint: defer the "More to Love" recommendations grid to the
  // next frame so the cart layout (header, items, bottom bar) appears first
  // and images stream in afterwards. requestAnimationFrame is used instead of
  // InteractionManager to avoid the dropped-fetch issue documented in
  // ProductDetailScreen.
  const [showHeavyContent, setShowHeavyContent] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShowHeavyContent(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Compute cardWidth locally to match the actual MoreToLove grid layout in
  // this screen (moreToLoveSection horizontal padding + productsGridRow gap).
  // The default useResponsive.gridCardWidth assumes smaller padding/gap, which
  // made the 3rd column overflow on tablets.
  const MORE_TO_LOVE_H_PADDING = SPACING.lg; // per side
  const MORE_TO_LOVE_COL_GAP = SPACING.lg; // between columns
  const dynGridCardWidth = Math.floor(
    (dynScreenWidth - MORE_TO_LOVE_H_PADDING * 2 - MORE_TO_LOVE_COL_GAP * (moreToLoveColumns - 1)) /
      moreToLoveColumns,
  );
  const { isAuthenticated, user } = useAuth();
  // Use wishlist status hook to check if products are liked based on external IDs
  const { isProductLiked, refreshExternalIds, addExternalId, removeExternalId } = useWishlistStatus();
  const selectedPlatform = usePlatformStore((state) => state.selectedPlatform);
  
  // Add to wishlist mutation
  const { mutate: addToWishlist } = useAddToWishlistMutation({
    onSuccess: async (data) => {
      showToast(t('product.productAddedToWishlist'), 'success');
      // Immediately refresh external IDs to update heart icon color
      await refreshExternalIds();
    },
    onError: (error) => {
      showToast(error || t('product.failedToAddToWishlist'), 'error');
    },
  });

  // Delete from wishlist mutation
  const { mutate: deleteFromWishlist } = useDeleteFromWishlistMutation({
    onSuccess: async (data) => {
      showToast(t('product.productRemovedFromWishlist'), 'success');
      // Immediately refresh external IDs to update heart icon color
      await refreshExternalIds();
    },
    onError: (error) => {
      showToast(error || t('product.failedToRemoveFromWishlist'), 'error');
    },
  });
  
  // Toggle wishlist function
  const toggleWishlist = async (product: any) => {
    if (!isAuthenticated || !user) {
      showToast(t('home.pleaseLogin'), 'warning');
      return;
    }

    // Get product external ID - prioritize externalId, never use MongoDB _id
    const externalId = 
      (product as any).externalId?.toString() ||
      (product as any).offerId?.toString() ||
      '';

    if (!externalId) {
      showToast(t('product.invalidProductId'), 'error');
      return;
    }

    const isLiked = isProductLiked(product);
    const source = (product as any).source || selectedPlatform || '1688';
    const country = locale || 'en';

    if (isLiked) {
      // Remove from wishlist - optimistic update (removes from state and AsyncStorage immediately)
      await removeExternalId(externalId);
      deleteFromWishlist(externalId);
    } else {
      // Add to wishlist - extract required fields from product
      const imageUrl = product.image || product.images?.[0] || '';
      const price = product.price || 0;
      const title = product.name || product.title || '';

      if (!imageUrl || !title || price <= 0) {
        showToast(t('product.invalidProductData'), 'error');
        return;
      }

      // Optimistic update - add to state and AsyncStorage immediately
      await addExternalId(externalId);
      addToWishlist({ offerId: externalId, platform: source });
    }
  };
  // Cart context removed - using local state (matches GET cart API: items, totals, estimatedShippingCost)
  const [cart, setCart] = useState<{
    items: any[];
    totalAmount: number;
    totalItems: number;
    currency: string;
    estimatedShippingCost?: number;
    estimatedShippingCostBySeller?: Record<string, number>;
  }>({ items: [], totalAmount: 0, totalItems: 0, currency: 'CNY' });
  const { showToast } = useToast();
  const { t, locale: appLocale } = useTranslation();
  const locale = appLocale as 'en' | 'ko' | 'zh';
  
  // Resolve multilingual object or string to string for current locale
  const resolveText = useCallback((value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && 'en' in value) {
      const o = value as Record<string, string>;
      return getLocalizedText(
        { en: o.en ?? '', ko: o.ko ?? '', zh: o.zh ?? '' },
        locale
      );
    }
    return String(value);
  }, [locale]);

  // Helper function to map cart data from API response (supports subjectMultiLang, companyName/categoryName as {en,ko,zh}, sku valueMultiLang)
  const mapCartData = useCallback((data: any) => {
    if (data && data.cart) {
      const cartData = data.cart;
      const mappedItems = (cartData.items || []).map((item: any) => {
        const variations = (item.skuInfo?.skuAttributes || []).map((attr: any) => ({
          name: resolveText(attr.attributeNameMultiLang ?? attr.attributeNameTrans ?? attr.attributeName) || '',
          value: resolveText(attr.valueMultiLang ?? attr.valueTrans ?? attr.value) || '',
        }));
        const price = parseFloat(item.skuInfo?.price || item.skuInfo?.consignPrice || '0');
        const name = resolveText(item.subjectMultiLang ?? item.subjectTrans ?? item.subject) || '';
        const companyNameStr = resolveText(item.companyName) || '';
        return {
          id: item._id || item.offerId?.toString() || '',
          _id: item._id,
          offerId: item.offerId,
          productId: item.offerId?.toString() || '',
          name,
          image: item.imageUrl || '',
          price,
          quantity: item.quantity || 1,
          minOrderQuantity: item.minOrderQuantity || 1,
          variant: variations,
          source: item.source || '1688',
          companyName: companyNameStr,
          sellerOpenId: item.sellerOpenId,
          skuInfo: item.skuInfo,
          originalData: item,
        };
      });
      setCart({
        items: mappedItems,
        totalAmount: cartData.totalAmount || 0,
        totalItems: cartData.totalItems ?? mappedItems.length,
        currency: cartData.currency || 'CNY',
        estimatedShippingCost: cartData.estimatedShippingCost,
        estimatedShippingCostBySeller: cartData.estimatedShippingCostBySeller || {},
      });
    }
  }, [resolveText]);

  // Memoize callbacks to prevent fetchCart from being recreated
  const handleCartSuccess = useCallback((data: any) => {
    console.log('🛒 CartScreen: API Success - Raw response:', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      fullResponse: data,
    });
    mapCartData(data);
  }, [mapCartData]);

  const handleCartError = useCallback((error: string) => {
    // console.error('Failed to fetch cart:', error);
    showToast(error || t('cart.failedToLoad'), 'error');
    setCart({ items: [], totalAmount: 0, totalItems: 0, currency: 'CNY' });
  }, [showToast, t]);

  const { mutate: fetchCart, isLoading: cartLoading } = useGetCartMutation({
    onSuccess: handleCartSuccess,
    onError: handleCartError,
  });
  
  const { mutate: updateCartItem } = useUpdateCartItemMutation({
    onSuccess: (data) => {
      // console.log('Cart item updated successfully:', data);
      mapCartData(data);
      showToast(t('cart.quantityUpdated'), 'success');
    },
    onError: (error) => {
      // console.error('Failed to update cart item:', error);
      showToast(error || t('cart.failedToUpdateQuantity'), 'error');
    },
  });

  const { mutate: deleteCartItem } = useDeleteCartItemMutation({
    onSuccess: (data) => {
      // console.log('Cart item deleted successfully:', data);
      mapCartData(data);
      showToast(t('cart.itemRemoved'), 'success');
    },
    onError: (error) => {
      // console.error('Failed to delete cart item:', error);
      showToast(error || t('cart.failedToRemove'), 'error');
    },
  });

  const { mutate: clearCart } = useClearCartMutation({
    onSuccess: (data) => {
      // console.log('Cart cleared successfully:', data);
      mapCartData(data);
      showToast(t('cart.cartCleared'), 'success');
      setSelectedItems(new Set());
      setAllSelected(false);
    },
    onError: (error) => {
      // console.error('Failed to clear cart:', error);
      showToast(error || t('cart.failedToClear'), 'error');
    },
  });

  const { mutate: deleteCartBatch } = useDeleteCartBatchMutation({
    onSuccess: (data) => {
      // console.log('Cart items deleted successfully:', data);
      mapCartData(data);
      showToast(t('cart.itemsRemoved'), 'success');
      setSelectedItems(new Set());
      setAllSelected(false);
    },
    onError: (error) => {
      // console.error('Failed to delete cart items:', error);
      showToast(error || t('cart.failedToDelete'), 'error');
    },
  });

  const { mutate: checkoutCart, isLoading: isCheckingOut } = useCheckoutCartMutation({
    onSuccess: (data) => {
      if (data.selectedItems && data.selectedItems.length > 0) {
        const paymentItems = data.selectedItems.map((item: any) => ({
          id: item._id,
          _id: item._id,
          offerId: item.offerId,
          name: resolveText(item.subjectMultiLang ?? item.subjectTrans ?? item.subject) || '',
          price: item.previewFinalUnitPriceKRW ?? parseFloat(item.skuInfo?.price || '0'),
          quantity: item.quantity,
          image: item.imageUrl,
          source: item.source,
          skuInfo: item.skuInfo,
          companyName: resolveText(item.companyName) || '',
          sellerOpenId: item.sellerOpenId,
        }));
        
        // Calculate total price from selected items
        const paymentTotalPrice = data.selectedItems.reduce((sum: number, item: any) => {
          const price = item.previewFinalUnitPriceKRW || parseFloat(item.skuInfo?.price || '0');
          return sum + (price * item.quantity);
        }, 0);
        
        // Navigate to payment screen with full checkout API response data
        (navigation as any).navigate('Payment', {
          items: paymentItems,
          totalAmount: data.productTotalKRW ?? paymentTotalPrice,
          estimatedShippingCost: data.estimatedShippingCost ?? 0,
          estimatedShippingCostBySeller: data.estimatedShippingCostBySeller ?? {},
          fromCart: true,
          checkoutData: {
            productTotalKRW: data.productTotalKRW,
            shippingTotalKRW: data.shippingTotalKRW,
            estimatedShippingCost: data.estimatedShippingCost,
            estimatedShippingCostBySeller: data.estimatedShippingCostBySeller,
            availableCoupons: data.availableCoupons,
            availablePoints: data.availablePoints,
            transportationMethods: data.transportationMethods,
            additionalServicePrices: data.additionalServicePrices,
            serviceFeePercentage: data.serviceFeePercentage,
            estimatedRuralCost: data.estimatedRuralCost,
          },
          directPurchaseItems: data.selectedItems,
        });
      } else {
        showToast(t('cart.selectItems'), 'warning');
      }
    },
    onError: (error) => {
      // console.error('Failed to checkout:', error);
      showToast(error || t('cart.checkoutFailed'), 'error');
    },
  });
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>('All');
  const isFetchingRecommendationsRef = useRef(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const lastFetchTimeRef = useRef<number>(0);
  const FETCH_DEBOUNCE_MS = 1000; // Only fetch if at least 1 second has passed since last fetch
  
  // Recommendations state for "More to Love"
  const [recommendationsProducts, setRecommendationsProducts] = useState<Product[]>([]);
  const [recommendationsOffset, setRecommendationsOffset] = useState(1); // Current page offset
  const [hasMoreRecommendations, setHasMoreRecommendations] = useState(true); // Whether more products exist
  const isRecommendationsRefreshingRef = useRef(false); // Prevent loading during refresh
  const currentRecommendationsPageRef = useRef<number>(1); // Track current page for callbacks
  const isLoadingMoreRecommendationsRef = useRef(false); // Prevent multiple simultaneous loads
  
  // Store fetchCart in a ref to avoid dependency issues
  const fetchCartRef = useRef(fetchCart);
  useEffect(() => {
    fetchCartRef.current = fetchCart;
  }, [fetchCart]);

  // Recommendations mutation with infinite scroll support
  const {
    mutate: fetchRecommendations,
    isLoading: recommendationsLoading,
    error: recommendationsError,
  } = useRecommendationsMutation({
    onSuccess: (data) => {
      // Updated API structure: data.products (not data.recommendations)
      const productsArray = data?.products || [];
      const currentPage = currentRecommendationsPageRef.current;
      
      // Reset loading flag
      isLoadingMoreRecommendationsRef.current = false;
      
      if (productsArray.length > 0) {
        // Map API response to Product format
        const mappedProducts = productsArray.map((item: any): Product => {
          const price = parseFloat(item.priceInfo?.price || item.priceInfo?.consignPrice || 0);
          const originalPrice = parseFloat(item.priceInfo?.consignPrice || item.priceInfo?.price || 0);
          const discount = originalPrice > price && originalPrice > 0
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;
          
          const productData: Product = {
            id: item.offerId?.toString() || '',
            externalId: item.offerId?.toString() || '',
            offerId: item.offerId?.toString() || '',
            name: locale === 'zh' ? (item.subject || item.subjectTrans || '') : (item.subjectTrans || item.subject || ''),
            image: item.imageUrl || '',
            price: price,
            originalPrice: originalPrice,
            discount: discount,
            description: '',
            category: { id: '', name: '', icon: '', image: '', subcategories: [] },
            subcategory: '',
            brand: '',
            seller: { 
              id: '', 
              name: '', 
              avatar: '', 
              rating: 0, 
              reviewCount: 0, 
              isVerified: false, 
              followersCount: 0, 
              description: '', 
              location: '', 
              joinedDate: new Date() 
            },
            rating: 0,
            reviewCount: 0,
            rating_count: 0,
            inStock: true,
            stockCount: 0,
            tags: [],
            isNew: false,
            isFeatured: false,
            isOnSale: discount > 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            orderCount: item.monthSold || 0,
            repurchaseRate: item.repurchaseRate || '',
          };
          
          // Preserve non-typed fields for navigation / tracking
          (productData as any).source = selectedPlatform || '1688';
          
          return productData;
        });
        
        // Check pagination - first page asks for FEED_INITIAL_PAGE_SIZE,
        // subsequent pages for FEED_MORE_PAGE_SIZE. If we got fewer products
        // than the page size we requested, there are no more pages.
        const requestedPageSize = currentPage === 1
          ? PAGINATION.FEED_INITIAL_PAGE_SIZE
          : PAGINATION.FEED_MORE_PAGE_SIZE;
        const hasMore = productsArray.length >= requestedPageSize;
        setHasMoreRecommendations(hasMore);
        
        // Dedup by external/offer id when appending — the recommendations
        // API can return the same product across pages and duplicates would
        // crash the FlatList with "two children with the same key".
        const productKey = (p: any): string =>
          (p?.offerId?.toString?.()) || (p?.externalId?.toString?.()) || (p?.id?.toString?.()) || '';
        if (currentPage === 1) {
          setRecommendationsProducts(mappedProducts);
        } else {
          setRecommendationsProducts(prev => {
            const seen = new Set(prev.map(productKey).filter(Boolean));
            const fresh = mappedProducts.filter((p: any) => {
              const k = productKey(p);
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            return [...prev, ...fresh];
          });
        }
      } else {
        // No products found
        if (currentPage === 1) {
        setRecommendationsProducts([]);
        }
        setHasMoreRecommendations(false);
      }
    },
    onError: (error) => {
      // Reset loading flag
      isLoadingMoreRecommendationsRef.current = false;
      const currentPage = currentRecommendationsPageRef.current;
      if (currentPage === 1) {
        setRecommendationsProducts([]);
      }
      setHasMoreRecommendations(false);
    },
  });

  // Store fetchRecommendations in ref to prevent dependency issues
  const fetchRecommendationsRef = useRef(fetchRecommendations);
  useEffect(() => {
    fetchRecommendationsRef.current = fetchRecommendations;
  }, [fetchRecommendations]);

  // Load more recommendations when offset changes (infinite scroll)
  useEffect(() => {
    // Prevent loading more data when refreshing or already loading
    if (isRecommendationsRefreshingRef.current || isLoadingMoreRecommendationsRef.current) {
      return;
    }
    
    if (recommendationsOffset > 1 && fetchRecommendationsRef.current && hasMoreRecommendations) {
      isLoadingMoreRecommendationsRef.current = true;
      const outMemberId = user?.id?.toString() || 'dferg0001';
      const platform = '1688'; // Always use 1688 for More to Love products
      currentRecommendationsPageRef.current = recommendationsOffset;
      fetchRecommendationsRef.current(locale || 'en', outMemberId, recommendationsOffset, PAGINATION.FEED_MORE_PAGE_SIZE, platform)
        .finally(() => {
          isLoadingMoreRecommendationsRef.current = false;
        });
    }
  }, [recommendationsOffset, locale, user?.id, hasMoreRecommendations]);

  // Track if initial fetch has been done (prevent real-time updates)
  const hasInitialFetchRef = useRef<string | null>(null);

  // Fetch recommendations only once on mount or when locale/user changes (not on every focus)
  useEffect(() => {
    if (locale && fetchRecommendationsRef.current) {
      const outMemberId = isAuthenticated ? (user?.id?.toString() || 'dferg0001') : 'dferg0001';
      const platform = '1688'; // Always use 1688 for More to Love products
      const fetchKey = `${locale}-${outMemberId}-${platform}`;
      
      // Only fetch if this is the first time or locale/user changed
      if (!hasInitialFetchRef.current || hasInitialFetchRef.current !== fetchKey) {
        hasInitialFetchRef.current = fetchKey;
        // Reset pagination state
        setRecommendationsOffset(1);
        setHasMoreRecommendations(true);
        // Clear existing products BEFORE making the API call
        setRecommendationsProducts([]);
        // Fetch first page
        currentRecommendationsPageRef.current = 1;
        fetchRecommendationsRef.current(locale || 'en', outMemberId, 1, PAGINATION.FEED_INITIAL_PAGE_SIZE, platform);
      }
    }
  }, [locale, user?.id, isAuthenticated, fetchRecommendations]);

  // Fetch cart status when screen comes into focus (but debounced to prevent too frequent calls)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTimeRef.current;

        // Only fetch if enough time has passed since last fetch
        if (timeSinceLastFetch >= FETCH_DEBOUNCE_MS) {
          lastFetchTimeRef.current = now;
          fetchCartRef.current();
        }
      } else {
        // Reset cart when user is not authenticated
        setCart({ items: [], totalAmount: 0, totalItems: 0, currency: 'CNY' });
        setSelectedItems(new Set());
        setAllSelected(false);
        lastFetchTimeRef.current = 0;
      }
    }, [isAuthenticated]) // Removed fetchCart from dependencies
  );


  // Navigate to product detail helper. The optional productData payload lets
  // ProductDetailScreen render the image / title / price immediately while
  // it fetches the full detail in the background.
  const navigateToProductDetail = async (
    productId: string | number,
    source: string = '1688',
    country: string = 'en',
    productData?: any,
  ) => {
    (navigation as any).navigate('ProductDetail', {
      productId: productId.toString(),
      source: source,
      country: country,
      productData,
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        {t('cart.title')} { selectedCount > 0 ? `(${selectedCount})` : '(0)' }
      </Text>
      {/* <TouchableOpacity 
        style={styles.backButton}
        // onPress={() => navigation.goBack()}
      >
        <Ionicons name="ar row-back" size={24} color={COLORS.black} />
      </TouchableOpacity> */}
      
      
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => {navigation.navigate('Wishlist' as never)}}>
          <HeartIcon width={24} height={24} color={COLORS.black} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerIcon} 
          onPress={handleDeleteSelected}
          disabled={cart.items.length === 0}
        >
          <DeleteIcon 
            width={24} 
            height={24} 
            color={cart.items.length === 0 ? COLORS.gray[300] : COLORS.black} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPlatformFilter = () => {
    const platforms = ['1688', 'taobao'];
    const counts: Record<string, number> = { All: cart.items.length };
    platforms.forEach(p => {
      counts[p] = cart.items.filter(item => (item.source || '1688').toLowerCase() === p.toLowerCase()).length;
    });
    const tabs = [
      { label: `${t('cart.all')} (${counts.All})`, value: 'All' },
      { label: `${t('home.platforms.1688')} (${counts['1688'] ?? 0})`, value: '1688' },
      { label: `${t('home.platforms.taobao')} (${counts['taobao'] ?? 0})`, value: 'taobao' },
    ];
    return (
      <View style={styles.platformFilterBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.platformFilterTab, selectedPlatformFilter === tab.value && styles.platformFilterTabActive]}
            onPress={() => setSelectedPlatformFilter(tab.value)}
          >
            <Text style={[styles.platformFilterText, selectedPlatformFilter === tab.value && styles.platformFilterTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render delete confirmation modal
  const renderDeleteModal = () => (
    <Modal
      visible={showDeleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={cancelDelete}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {t('cart.confirmDelete')}
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={cancelDelete}
            >
              <Text style={styles.modalCancelText}>
                {t('cart.cancel')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalConfirmButton}
              onPress={confirmDelete}
            >
              <Text style={styles.modalConfirmText}>
                {t('cart.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Stable wrapper style — memoized so it's the SAME object reference across
  // renders, otherwise every parent re-render makes the inline `[...]` array
  // a new value and ProductCard's memo wrapper sees `style` as changed.
  const productCardWrapperStyle = useMemo(
    () => [styles.productCardWrapper, { width: dynGridCardWidth }],
    [dynGridCardWidth],
  );

  const renderMoreToLoveItem = useCallback(
    ({ item: product, index }: { item: Product; index: number }) => {
      if (!product || !product.id) {
        return null;
      }

      const handleLike = async () => {
        if (!isAuthenticated) {
          return;
        }
        try {
          await toggleWishlist(product);
        } catch (error) {
          // Error toggling wishlist
        }
      };

      const handlePress = () => {
        const productIdToUse = (product as any).offerId || product.id;
        const source = (product as any).source || selectedPlatform || '1688';
        const country = locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';
        navigateToProductDetail(productIdToUse, source, country, product);
      };

      return (
        <View style={productCardWrapperStyle}>
          <ProductCard
            key={`moretolove-${product.id || product.offerId || index}-${index}`}
            product={product}
            variant="moreToLove"
            cardWidth={dynGridCardWidth}
            onPress={handlePress}
            onLikePress={handleLike}
            isLiked={isProductLiked(product)}
            showLikeButton={true}
            showDiscountBadge={true}
            showRating={true}
          />
        </View>
      );
    },
    [
      isAuthenticated,
      dynGridCardWidth,
      productCardWrapperStyle,
      isProductLiked,
      selectedPlatform,
      locale,
      toggleWishlist,
      navigateToProductDetail,
    ],
  );

  // Stable keyExtractor — defined once via useCallback to avoid passing a new
  // function reference to FlatList every render.
  const keyExtractorMoreToLove = useCallback(
    (item: Product, index: number) =>
      `moretolove-${item.id?.toString() || index}-${index}`,
    [],
  );

  const renderMoreToLove = () => {
    const productsToDisplay = recommendationsProducts;
    
    // Show loading state if fetching
    if (recommendationsLoading && productsToDisplay.length === 0) {
      return (
        <View style={styles.moreToLoveSection}>
          <Text style={styles.sectionTitle}>{t('home.moreToLove')}</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('cart.loadingRecommendations')}</Text>
          </View>
        </View>
      );
    }
    
    // Show error state
    if (recommendationsError && productsToDisplay.length === 0) {
      return (
        <View style={styles.moreToLoveSection}>
          <Text style={styles.sectionTitle}>{t('home.moreToLove')}</Text>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('cart.failedToLoadRecommendations')}</Text>
          </View>
        </View>
      );
    }
    
    // Don't show section if no products
    if (!Array.isArray(productsToDisplay) || productsToDisplay.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.moreToLoveSection}>
        <Text style={styles.sectionTitle}>{t('home.moreToLove')}</Text>
        <FlatList
          key={`cart-moretolove-cols-${moreToLoveColumns}`}
          data={productsToDisplay}
          renderItem={renderMoreToLoveItem}
          keyExtractor={keyExtractorMoreToLove}
          numColumns={moreToLoveColumns}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          columnWrapperStyle={styles.productsGridRow}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={10}
          updateCellsBatchingPeriod={80}
          onEndReached={() => {
            // For nested FlatList with scrollEnabled={false}, onEndReached may not fire reliably
            // Rely on parent ScrollView scroll detection instead
            // This is kept as a backup but parent scroll detection is primary
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => {
            if (isLoadingMoreRecommendationsRef.current && productsToDisplay.length > 0) {
              return (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingMoreText}>{t('cart.loadingMore')}</Text>
                </View>
              );
            }
            if (!hasMoreRecommendations && productsToDisplay.length > 0) {
              return (
                <View style={styles.endOfListContainer}>
                  <Text style={styles.endOfListText}>{t('cart.noMoreProducts')}</Text>
                </View>
              );
            }
            return null;
          }}
        />
      </View>
    );
  };
  
  // If not authenticated, show login prompt
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        {renderDeleteModal()}
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            
            // Check if user has scrolled near the bottom (within 200px)
            const scrollPosition = contentOffset.y;
            const scrollHeight = contentSize.height;
            const screenHeight = layoutMeasurement.height;
            const distanceFromBottom = scrollHeight - scrollPosition - screenHeight;
            
            // Check if user is near bottom to trigger infinite scroll for "More to Love"
            if (distanceFromBottom < 200 && hasMoreRecommendations && !recommendationsLoading && !isRecommendationsRefreshingRef.current && !isLoadingMoreRecommendationsRef.current) {
              setRecommendationsOffset(prev => prev + 1);
            }
          }}
          scrollEventThrottle={400}
        >
          <View style={styles.emptyCart}>
            <Image 
              source={require('../../assets/icons/cart_empty.png')} 
              style={styles.emptyCartImage}
            />
            <Text style={styles.welcomeText}>{t('cart.welcome')}</Text>
            <Text style={styles.loginPrompt}>
              {t('cart.loginPrompt')}
            </Text>
            {/* <Text style={styles.emptySubtitle}>
              {t('cart.emptySubtitle')}
            </Text> */}
            <TouchableOpacity
              style={[styles.continueShoppingButton, {backgroundColor: COLORS.text.red, marginBottom: SPACING.sm}]}
              onPress={() => navigation.navigate('Auth')}
            >
              <Text style={styles.continueShoppingButtonText}>{t('cart.login')}</Text>
            </TouchableOpacity>
          </View>
          {renderMoreToLove()}
          
          <View style={styles.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Calculate totals from cart items
  const selectedCartItems = cart.items.filter(item => selectedItems.has(item.id));
  const totalPrice = selectedCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const selectedCount = selectedCartItems.length;

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    
    // Update all selected state
    const allItemIds = cart.items.map(item => item.id);
    setAllSelected(newSelected.size === allItemIds.length && allItemIds.length > 0);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedItems(new Set());
      setAllSelected(false);
    } else {
      const allItemIds = cart.items.map(item => item.id);
      setSelectedItems(new Set(allItemIds));
      setAllSelected(true);
    }
  };

  const handleQuantityChange = async (itemId: string, increment: boolean) => {
    const item = cart.items.find(i => i.id === itemId);
    if (!item) return;
    
    const minOrderQuantity = (item as any).minOrderQuantity || 1;
    
    let newQuantity: number;
    if (increment) {
      newQuantity = item.quantity + 1;
    } else {
      // When reducing, check if new quantity is still >= minOrderQuantity
      const reducedQuantity = item.quantity - 1;
      if (reducedQuantity < minOrderQuantity) {
        showToast(
          t('cart.minOrderQuantity') + minOrderQuantity,
          'warning'
        );
        return;
      }
      newQuantity = reducedQuantity;
    }
    
    // Update quantity locally only - no API call
    setCart(prevCart => ({
      ...prevCart,
      items: prevCart.items.map(i => 
        i.id === itemId ? { ...i, quantity: newQuantity } : i
      ),
    }));
  };

  const handleRemoveItem = async (itemId: string) => {
    const item = cart.items.find(i => i.id === itemId);
    if (!item) return;
    
    const cartItemId = (item as any)._id || itemId;
    if (!cartItemId) {
      showToast(t('cart.invalidCartItem'), 'error');
      return;
    }
    
    deleteCartItem(cartItemId);
  };

  const handleDeleteSelected = async () => {
    // Show confirmation modal instead of deleting immediately
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    
    if (selectedItems.size === 0) {
      // If no items selected, clear entire cart
      if (cart.items.length > 0) {
        clearCart();
      }
      return;
    }

    // Delete selected items in batch
    const selectedCartItems = cart.items.filter(item => selectedItems.has(item.id));
    const itemIds = selectedCartItems.map(item => (item as any)._id || item.id).filter(id => id);
    
    if (itemIds.length > 0) {
      deleteCartBatch(itemIds);
    } else {
      showToast(t('cart.noValidItems'), 'warning');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
  };


  // Group cart items by source and companyName
  const groupCartItemsBySourceAndCompany = (items: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    
    items.forEach((item) => {
      const source = item.source || '1688';
      const companyName = item.companyName || '';
      const key = `${source}_${companyName}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    
    // Convert to array format with source and companyName
    return Object.keys(grouped).map((key) => {
      const [source, ...companyParts] = key.split('_');
      const companyName = companyParts.join('_');
      return {
        source,
        companyName,
        items: grouped[key],
      };
    });
  };

  const renderCartItem = (item: any, uniqueKey?: string) => {
    // Get variations from item.variant array
    const variations = (item as any).variant || [];
    // Show only values, not "Product Specification" text
    const variationText = variations.map((v: any) => v.value).filter(Boolean).join(', ');
    
    // Get image from item.image
    const itemImage = item.image || '';
    
    // Get source from item for navigation
    const itemSource = item.source || '1688';
    
    // Generate unique key
    const itemKey = uniqueKey || `cart-item-${item.id || item._id || item.offerId || Math.random()}`;
    
    // Debug logging for rendering
    console.log('🎨 CartScreen: Rendering cart item:', {
      itemId: item.id,
      itemKey: itemKey,
      itemName: item.name,
      itemImage: itemImage,
      hasImage: !!itemImage,
      hasName: !!item.name,
      variationText,
      price: item.price,
    });
    
    return (
      <View style={styles.cartItem} key={itemKey}>
        {/* <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
        >
          <Icon name="close" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity> */}
        
        <View style={styles.itemContent}>
          <TouchableOpacity 
            style={styles.itemCheckbox}
            onPress={() => handleSelectItem(item.id)}
          >
            <View style={[
              styles.checkbox,
              selectedItems.has(item.id) && styles.checkboxSelected
            ]}>
              {selectedItems.has(item.id) && (
                <ThickCheckIcon size={12} color={COLORS.white} />
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => {
              if (item.offerId) {
                navigateToProductDetail(item.offerId, itemSource, locale);
              }
            }}
          >
            <Image 
              source={{ 
                uri: itemImage || `https://via.placeholder.com/${PRODUCT_IMG_PX}x${PRODUCT_IMG_PX}/f0f0f0/999999?text=No+Image`
              }}
              style={styles.productImage}
              defaultSource={{ uri: `https://via.placeholder.com/${PRODUCT_IMG_PX}x${PRODUCT_IMG_PX}/f0f0f0/999999?text=Loading` }}
              onError={(error) => {
                console.log('🖼️ CartScreen: Image failed to load:', {
                  itemId: item.id,
                  imageUrl: itemImage,
                  error: error.nativeEvent.error,
                });
              }}
              onLoad={() => {
                console.log('✅ CartScreen: Image loaded successfully:', itemImage);
              }}
              onLoadStart={() => {
                console.log('🔄 CartScreen: Image loading started:', itemImage);
              }}
            />
          </TouchableOpacity>
          
          <View style={styles.productInfo}>
            <TouchableOpacity
              onPress={() => {
                if (item.offerId) {
                  navigateToProductDetail(item.offerId, itemSource, locale);
                }
              }}
            >
              <Text style={styles.productName} numberOfLines={1}>
                {(() => {
                  const displayName = item.name || t('cart.unknownItem');
                  console.log('📝 CartScreen: Rendering product name:', {
                    itemId: item.id,
                    itemName: item.name,
                    displayName: displayName,
                    hasName: !!item.name,
                    fallbackText: t('cart.unknownItem'),
                  });
                  return displayName;
                })()}
              </Text>
            </TouchableOpacity>
            {variationText && (
              <Text style={styles.productVariant} numberOfLines={1}>{variationText}</Text>
            )}
            
            <View style={styles.priceRow}>
              <Text style={styles.currentPrice}>{formatPriceKRW(item.price)}</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.id, false)}
                >
                  <MinusIcon width={16} height={16} color={COLORS.black} />
                </TouchableOpacity>
                
                <Text style={styles.quantityText}>{item.quantity}</Text>
                
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.id, true)}
                >
                  <PlusIcon width={16} height={16} color={COLORS.black} />
                </TouchableOpacity>
              </View>
            </View>
            
          </View>
        </View>
      </View>
    );
  };

  // Check if all items in a group are selected
  const isGroupSelected = (groupItems: any[]) => {
    if (groupItems.length === 0) return false;
    return groupItems.every(item => selectedItems.has(item.id));
  };

  // Handle group selection/deselection
  const handleGroupSelect = (groupItems: any[]) => {
    const allSelected = isGroupSelected(groupItems);
    const newSelected = new Set(selectedItems);
    
    if (allSelected) {
      // Deselect all items in the group
      groupItems.forEach(item => newSelected.delete(item.id));
    } else {
      // Select all items in the group
      groupItems.forEach(item => newSelected.add(item.id));
    }
    
    setSelectedItems(newSelected);
    
    // Update all selected state
    const allItemIds = cart.items.map(item => item.id);
    setAllSelected(newSelected.size === allItemIds.length && allItemIds.length > 0);
  };

  const renderGroupedCartItems = () => {
    const allItems = selectedPlatformFilter === 'All'
      ? cart.items
      : cart.items.filter(item => (item.source || '1688').toLowerCase() === selectedPlatformFilter.toLowerCase());
    const groupedItems = groupCartItemsBySourceAndCompany(allItems);
    
    return groupedItems.map((group, groupIndex) => {
      const groupSelected = isGroupSelected(group.items);
      
      return (
        <View key={`group-${group.source}-${group.companyName}-${groupIndex}`} style={styles.groupContainer}>
          <View style={styles.groupHeader}>
            <TouchableOpacity 
              style={styles.groupCheckbox}
              onPress={() => handleGroupSelect(group.items)}
            >
              <View style={[
                styles.checkbox,
                groupSelected && styles.checkboxSelected
              ]}>
                {groupSelected && (
                  <ThickCheckIcon size={12} color={COLORS.white} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.groupHeaderText}>
              {group.companyName}
            </Text>
          </View>
          {group.items.map((item, itemIndex) => renderCartItem(item, `${groupIndex}-${itemIndex}`))}
        </View>
      );
    });
  };


  const renderBottomBar = () => (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
      <View style={styles.bottomContent}>
        <TouchableOpacity 
          style={styles.allCheckbox}
          onPress={handleSelectAll}
        >
          <View style={[
            styles.checkbox,
            allSelected && styles.checkboxSelected
          ]}>
            {allSelected && (
              <ThickCheckIcon size={12} color={COLORS.white} />
            )}
          </View>
          <Text style={styles.allText}>{t('cart.all')}</Text>
        </TouchableOpacity>
        <View style={{flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end'}}>
          <Text style={styles.totalPrice}>{formatPriceKRW(totalPrice)}</Text>
          <TouchableOpacity 
          style={styles.payButton}
          onPress={() => {
            if (selectedCount === 0) {
              showToast(t('cart.selectItems'), 'warning');
              return;
            }

            // Build quantities object with selected items only
            const quantities: { [cartItemId: string]: number } = {};
            selectedCartItems.forEach(item => {
              const cartItemId = (item as any)._id;
              if (cartItemId) {
                quantities[cartItemId] = item.quantity;
              }
            });

            // Call checkout API with selected items' quantities
            checkoutCart(quantities);
          }}
          disabled={isCheckingOut || selectedCount === 0}
        >
          <Text style={styles.payButtonText}>
            {isCheckingOut ? t('cart.processing') : `${t('cart.pay')} (${selectedCount})`}
          </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Show loading only on initial load (when cart is empty and loading)
  // Don't show loading during updates/deletes
  const isInitialLoad = cartLoading && (!cart.items || cart.items.length === 0);
  
  if (isInitialLoad) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: SPACING.md, color: COLORS.text.secondary }}>{t('cart.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        {renderDeleteModal()}
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            
            // Check if user has scrolled near the bottom (within 200px)
            const scrollPosition = contentOffset.y;
            const scrollHeight = contentSize.height;
            const screenHeight = layoutMeasurement.height;
            const distanceFromBottom = scrollHeight - scrollPosition - screenHeight;
            
            // Check if user is near bottom to trigger infinite scroll for "More to Love"
            if (distanceFromBottom < 200 && hasMoreRecommendations && !recommendationsLoading && !isRecommendationsRefreshingRef.current && !isLoadingMoreRecommendationsRef.current) {
              setRecommendationsOffset(prev => prev + 1);
            }
          }}
          scrollEventThrottle={400}
        >
          <View style={styles.emptyCart}>
            <Image 
              source={require('../../assets/icons/cart_empty.png')} 
              style={styles.emptyCartImage}
            />
            <Text style={styles.emptyTitle}>{t('cart.emptyTitle')}</Text>
            {/* <Text style={styles.emptySubtitle}>
              {t('cart.emptySubtitle')}
            </Text> */}
            {!isAuthenticated && (
              <TouchableOpacity
                style={[styles.continueShoppingButton, {backgroundColor: COLORS.text.red, marginBottom: SPACING.sm}]}
                onPress={() => navigation.navigate('Auth')}
              >
                <Text style={styles.continueShoppingButtonText}>{t('cart.login')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              hitSlop={BACK_NAVIGATION_HIT_SLOP}
              style={styles.continueShoppingButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.continueShoppingButtonText}>{t('cart.continueShopping')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.helpCenter} >
            <View style={styles.helpCenterItem} >
              <View style={styles.helpCenterItemHeader} >
                <PrivacyIcon />
                <Text style={styles.helpCenterTitle}>{t('cart.helpCenter2')}</Text>
              </View>
              <Text style={styles.helpCenterSubTitle}>{t('cart.helpCenterSubTitle2')}</Text>
            </View>
          </View>
          
          {renderMoreToLove()}
          
          <View style={styles.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderPlatformFilter()}
      {renderDeleteModal()}
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          
            // Check if user has scrolled near the bottom (within 200px)
          const scrollPosition = contentOffset.y;
          const scrollHeight = contentSize.height;
          const screenHeight = layoutMeasurement.height;
          const distanceFromBottom = scrollHeight - scrollPosition - screenHeight;
          
          // Check if user is near bottom to trigger infinite scroll for "More to Love"
          if (distanceFromBottom < 200 && hasMoreRecommendations && !recommendationsLoading && !isRecommendationsRefreshingRef.current && !isLoadingMoreRecommendationsRef.current) {
            // Trigger loading more recommendations
            setRecommendationsOffset(prev => prev + 1);
            }
        }}
        scrollEventThrottle={400}
      >
        {renderGroupedCartItems()}

        {showHeavyContent && renderMoreToLove()}

        <View style={styles.bottomSpace} />
      </ScrollView>
      
      {renderBottomBar()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: SPACING.xs,
    width: 48
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: COLORS.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  headerIcon: {
    padding: SPACING.xs,
  },
  platformFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    gap: SPACING.sm,
  },
  platformFilterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  platformFilterTabActive: {
    backgroundColor: COLORS.lightRed,
    borderColor: COLORS.red,
  },
  platformFilterText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
  platformFilterTextActive: {
    color: COLORS.red,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  groupContainer: {
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  groupCheckbox: {
    marginRight: SPACING.md,
  },
  groupHeaderText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  sellerSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerCheckbox: {
    marginRight: SPACING.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: COLORS.black,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.text.red,
    borderColor: COLORS.text.red,
  },
  sellerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.sm,
  },
  sellerName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  cartItem: {
    marginHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.lg,
    zIndex: 1,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemCheckbox: {
    marginRight: SPACING.md,
    marginTop: SPACING.xs,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
    backgroundColor: COLORS.gray[100],
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  productVariant: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[500],
    marginBottom: SPACING.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  currentPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
  },
  originalPrice: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[400],
    textDecorationLine: 'line-through',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  quantityButton: {
    width: 28,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginHorizontal: SPACING.md,
    minWidth: 20,
    textAlign: 'center',
  },
  moreToLoveSection: {
    margin: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    // flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  productsGridRow: {
    justifyContent: 'flex-start',
    gap: SPACING.lg,
  },
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
  },
  loadingMoreContainer: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  endOfListContainer: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  productCardWrapper: {
    width: (width - SPACING.lg * 2 - SPACING.sm) / 2,
    marginBottom: SPACING.md,
  },
  bottomSpace: {
    height: 100,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#0000000D',
    ...SHADOWS.lg,
  },
  bottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  allCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  allText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  totalPrice: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginRight: SPACING.md,
  },
  payButton: {
    backgroundColor: COLORS.text.red,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  payButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  emptyCart: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#FFF4EF',
  },
  emptyCartImage: {
    width: 80,
    height: 80,
    marginVertical: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  continueShoppingButton: {
    backgroundColor: COLORS.black,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    width: '85%',
  },
  continueShoppingButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
  },
  helpCenter: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.md,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: '#0000000D',
    gap: SPACING.sm,
  },
  helpCenterItem: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    backgroundColor: '#FAFAFA',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  helpCenterItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  helpCenterTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  helpCenterSubTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  cartImage: {
    width: 160,
    height: 200,
  },
  welcomeText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  loginPrompt: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#FF5500',
    borderRadius: 9999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  loginButtonText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  // Delete confirmation modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 28,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#FF5722',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default CartScreen;