import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { launchCamera, launchImageLibrary, MediaType, ImagePickerResponse, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import { requestCameraPermission, requestPhotoLibraryPermission } from '../../utils/permissions';
import { StackNavigationProp } from '@react-navigation/stack';

import FastImage from '@d11/react-native-fast-image';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, IMAGE_CONFIG } from '../../constants';
import { getProductCardImageUri, buildProductDisplayImageUri } from '../../utils/productImage';
import { RootStackParamList, Product } from '../../types';
import { SearchButton, NotificationBadge, ProductCard, ImagePickerModal } from '../../components';
import NotificationIcon from '../../assets/icons/NotificationIcon';
import { useAuth } from '../../context/AuthContext';

import { useToast } from '../../context/ToastContext';
import { usePlatformStore } from '../../store/platformStore';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';
import { useTopCategoriesMutation } from '../../hooks/useTopCategoriesMutation';
import { useChildCategoriesMutation } from '../../hooks/useChildCategoriesMutation';
import { useSearchProductsMutation } from '../../hooks/useSearchProductsMutation';
import { useWishlistStatus } from '../../hooks/useWishlistStatus';
import { useAddToWishlistMutation } from '../../hooks/useAddToWishlistMutation';
import { useDeleteFromWishlistMutation } from '../../hooks/useDeleteFromWishlistMutation';
import { productsApi } from '../../services/productsApi';

const { width: _staticWidth } = Dimensions.get('window');

type CategoryTabScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Category'>;

const LEFT_COLUMN_WIDTH = 90;

const CategoryTabScreen: React.FC = () => {
  const navigation = useNavigation<CategoryTabScreenNavigationProp>();
  const { width: dynWidth } = useWindowDimensions();
  const RIGHT_COLUMN_WIDTH = dynWidth - LEFT_COLUMN_WIDTH - SPACING.md * 2;
  // Match the actual forYou layout:
  //   forYouSection.paddingHorizontal = SPACING.md  → 2 * SPACING.md outer
  //   forYouGrid.gap = SPACING.sm                   → 1 * SPACING.sm between 2 cols
  // Using the wrong spacing here made the two cards overflow the container,
  // which triggered flexWrap and broke image layout.
  const FOR_YOU_CARD_WIDTH = Math.floor(
    (RIGHT_COLUMN_WIDTH - SPACING.md * 2 - SPACING.sm) / 2,
  );
  const { user, isGuest } = useAuth();
  // Use wishlist status hook to check if products are liked based on external IDs
  const { isProductLiked, refreshExternalIds, addExternalId, removeExternalId } = useWishlistStatus();
  
  // Add to wishlist mutation
  const { mutate: addToWishlist } = useAddToWishlistMutation({
    onSuccess: async (data) => {
      // console.log('Product added to wishlist successfully:', data);
      showToast(t('home.productAddedToWishlist'), 'success');
      // Immediately refresh external IDs to update heart icon color
      await refreshExternalIds();
    },
    onError: (error) => {
      // console.error('Failed to add product to wishlist:', error);
      showToast(error || t('home.failedToAddToWishlist'), 'error');
    },
  });

  // Delete from wishlist mutation
  const { mutate: deleteFromWishlist } = useDeleteFromWishlistMutation({
    onSuccess: async (data) => {
      // console.log('Product removed from wishlist successfully:', data);
      showToast(t('home.productRemovedFromWishlist'), 'success');
      // Immediately refresh external IDs to update heart icon color
      await refreshExternalIds();
    },
    onError: (error) => {
      // console.error('Failed to remove product from wishlist:', error);
      showToast(error || t('home.failedToRemoveFromWishlist'), 'error');
    },
  });
  
  // Toggle wishlist function
  const toggleWishlist = async (product: any) => {
    if (!user || isGuest) {
      showToast(t('home.pleaseLogin'), 'warning');
      return;
    }

    // Get product external ID - prioritize externalId, never use MongoDB _id
    const externalId = 
      (product as any).externalId?.toString() ||
      (product as any).offerId?.toString() ||
      '';

    if (!externalId) {
      showToast(t('home.invalidProductId'), 'error');
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
      const imageUrl = getProductCardImageUri(product) || '';
      const price = product.price || 0;
      const title = product.name || product.title || '';

      if (!imageUrl || !title || price <= 0) {
        showToast(t('home.invalidProductData'), 'error');
        return;
      }

      // Optimistic update - add to state and AsyncStorage immediately
      await addExternalId(externalId);
      addToWishlist({ offerId: externalId, platform: source });
    }
  };
  
  // Zustand store
  const { 
    selectedPlatform, 
    selectedCategory,
    setSelectedPlatform, 
    setSelectedCategory,
  } = usePlatformStore();
  
  // i18n
  const locale = useAppSelector((s) => s.i18n.locale);
  const { showToast } = useToast();

  // Helper function to navigate to product detail
  const navigateToProductDetail = async (
    productId: string | number,
    source: string = selectedPlatform,
    country: string = locale as string
  ) => {
    navigation.navigate('ProductDetail', {
      productId: productId.toString(),
      source: source,
      country: country,
    });
  };
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

  const getLocalizedCategoryName = useCallback((category: any): string => {
    if (!category) return '';
    if (typeof category.name === 'object') {
      return category.name?.[locale] || category.name?.en || category.name?.zh || '';
    }
    return category.name || '';
  }, [locale]);
  
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
  const [showRecommended, setShowRecommended] = useState(true);
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const [forYouProducts, setForYouProducts] = useState<Product[]>([]);
  // Infinite-scroll bookkeeping for the For You list. We fetch in pages
  // of FOR_YOU_PAGE_SIZE, append on subsequent pages, and stop firing
  // load-more once the API returns fewer items than a full page.
  const FOR_YOU_PAGE_SIZE = 20;
  const [forYouPage, setForYouPage] = useState(1);
  const [forYouHasMore, setForYouHasMore] = useState(true);
  const [isLoadingMoreForYou, setIsLoadingMoreForYou] = useState(false);
  // Tracks whether the next mutation success should APPEND (load-more)
  // or REPLACE (initial / category change / refresh) the list.
  const isLoadMoreRef = useRef(false);
  const [companies, setCompanies] = useState<string[]>(['All', '1688', 'Taobao']);
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [childCategories, setChildCategories] = useState<any[]>([]);

  const hasFetchedRef = useRef<string | null>(null);
  const hasFetchedForYouRef = useRef<string | null>(null);
  const lastPlatformForCategoryRef = useRef<string | null>(null);
  const lastScrollYRef = useRef(0); // 스크롤 방향 판별용 — 위로 스크롤 중엔 load-more 차단
  const childCategoryCacheRef = useRef<Record<string, any[]>>({});
  const previewImageCacheRef = useRef<Record<string, string>>({});
  const activeChildRequestKeyRef = useRef<string | null>(null);

  const getChildCategoryCacheKey = useCallback((platform: string, categoryId: string) => {
    return `${platform}-${categoryId}-${locale || 'en'}`;
  }, [locale]);

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

  // Child categories mutation
  const { mutate: fetchChildCategories, isLoading: isLoadingChildCategories } = useChildCategoriesMutation({
    onSuccess: (data) => {
      // console.log('Child categories fetched successfully:', data);
      const childCatsTree = data.tree || [];
      const platformSource = getPlatformFromCompany(selectedCompany);
      const countryCode = locale === 'zh' ? 'en' : locale;
      const searchFilter = platformSource === 'taobao' ? undefined : 'isQqyx';
      const requestKey = selectedCategory ? getChildCategoryCacheKey(platformSource, selectedCategory) : null;

      if (!requestKey || activeChildRequestKeyRef.current !== requestKey) {
        return;
      }

      const fetchPreviewImage = async (keyword: string): Promise<string> => {
        if (!keyword) return '';

        const cacheKey = `${platformSource}-${countryCode}-${keyword}`;
        if (previewImageCacheRef.current[cacheKey] !== undefined) {
          return previewImageCacheRef.current[cacheKey];
        }

        try {
          const response = await productsApi.searchProductsByKeyword(
            keyword,
            platformSource,
            countryCode,
            1,
            1,
            '',
            undefined,
            undefined,
            searchFilter,
            false
          );
          const firstProduct = response?.data?.data?.products?.[0];
          const rawImage = (
            firstProduct?.image ||
            firstProduct?.imageUrl ||
            firstProduct?.mainImage ||
            firstProduct?.main_image_url ||
            firstProduct?.images?.[0] ||
            ''
          );
          // Mirror the home page's image-loading pipeline: ask the CDN
          // for a thumbnail-sized variant of the product image (smaller
          // payload, faster to download/decode) instead of the full
          // desktop-sized URL the search API returns.
          const previewImage = rawImage
            ? buildProductDisplayImageUri(
                rawImage,
                IMAGE_CONFIG.HOME_GRID_IMAGE_PIXEL,
                60,
              )
            : '';
          previewImageCacheRef.current[cacheKey] = previewImage;
          return previewImage;
        } catch {
          previewImageCacheRef.current[cacheKey] = '';
          return '';
        }
      };

      // First paint quickly with existing category tree data.
      const baseTree = childCatsTree.map((level2: any) => {
        const level3Children = Array.isArray(level2.children) ? level2.children : [];
        const firstChildImage = level3Children
          .map((child: any) => getCategoryImage(child))
          .find((img: string) => !!img);

        return {
          ...level2,
          imageUrl: getCategoryImage(level2) || firstChildImage || level2.imageUrl || '',
          children: level3Children,
        };
      });

      setChildCategories(baseTree);

      if (requestKey) {
        childCategoryCacheRef.current[requestKey] = baseTree;
      }

      // 이미지 보강을 한 항목씩 순차 처리 → API 동시 호출 방지 + 항목마다 즉시 UI 반영
      (async () => {
        const enrichedTree: any[] = [];

        for (let i = 0; i < childCatsTree.length; i++) {
          if (activeChildRequestKeyRef.current !== requestKey) return;

          const level2 = childCatsTree[i];
          const level2Name = getLocalizedCategoryName(level2);
          const level3Children = Array.isArray(level2.children) ? level2.children : [];

          // level3 자식도 순차 처리
          const enrichedChildren: any[] = [];
          for (const level3 of level3Children) {
            const level3Image = getCategoryImage(level3);
            if (level3Image) {
              enrichedChildren.push(level3);
            } else {
              const level3Name = getLocalizedCategoryName(level3);
              const previewImage = await fetchPreviewImage(level3Name);
              enrichedChildren.push(previewImage ? { ...level3, imageUrl: previewImage } : level3);
            }
          }

          const firstChildImage = enrichedChildren
            .map((child: any) => getCategoryImage(child))
            .find((img: string) => !!img);

          // 항목을 클릭하면 나오는 페이지의 첫 상품 이미지를 카드 이미지로 사용
          // fetchPreviewImage 가 해당 카테고리명으로 상품을 검색해 첫 번째 상품 이미지를 반환
          const productSearchImage = await fetchPreviewImage(level2Name);
          const level2Image =
            productSearchImage || getCategoryImage(level2) || firstChildImage;

          enrichedTree.push({
            ...level2,
            imageUrl: level2Image || level2.imageUrl || '',
            children: enrichedChildren,
          });

          if (activeChildRequestKeyRef.current !== requestKey) return;

          // 이 항목이 보강될 때마다 즉시 UI 갱신 (나머지는 baseTree 유지)
          const partial = [
            ...enrichedTree,
            ...baseTree.slice(enrichedTree.length),
          ];
          setChildCategories(partial);
          if (requestKey) {
            childCategoryCacheRef.current[requestKey] = partial;
          }
        }
      })();
    },
    onError: (error) => {
      // console.error('Failed to fetch child categories:', error);
      setChildCategories([]);
      showToast(error || t('category.failedToLoadSubcategories'), 'error');
    },
  });

  // Fetch top categories when selected company changes
  // Platform parameter is determined by selected company (All = 1688)
  useEffect(() => {
    if (selectedCompany) {
      // Get platform from selected company
      const platformForCompany = getPlatformFromCompany(selectedCompany);
      
      // Check if we already have top categories for this platform
      const alreadyFetched = hasFetchedRef.current === platformForCompany;
      
      // Only fetch if we haven't fetched yet and not currently loading
      if (!alreadyFetched && !isLoadingTopCategories) {
        hasFetchedRef.current = platformForCompany; // Mark as fetching
        fetchTopCategories(platformForCompany);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]); // Depend on selectedCompany

  // Fetch child categories when top category is selected
  useEffect(() => {
    if (selectedCategory && selectedCompany) {
      const platformForCompany = getPlatformFromCompany(selectedCompany);
      const cacheKey = getChildCategoryCacheKey(platformForCompany, selectedCategory);
      const cachedChildCategories = childCategoryCacheRef.current[cacheKey];
      activeChildRequestKeyRef.current = cacheKey;

      if (cachedChildCategories) {
        setChildCategories(cachedChildCategories);
        return;
      }

      fetchChildCategories(platformForCompany, selectedCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedCompany, locale]);

  // Search products mutation for "For You" section
  const { mutate: searchForYouProducts, isLoading: isLoadingForYou } = useSearchProductsMutation({
    onSuccess: (data) => {
      // console.log('For You products fetched successfully:', data);
      if (data && data.data && data.data.products && Array.isArray(data.data.products)) {
        // Map API response to Product format
        const mappedProducts = data.data.products.map((item: any) => {
          const price = parseFloat(item.price || item.wholesalePrice || item.dropshipPrice || 0);
          const originalPrice = parseFloat(item.originalPrice || price);
          const discount = originalPrice > price && originalPrice > 0
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          const row = {
            id: item.id?.toString() || item.externalId?.toString() || '',
            externalId: item.externalId?.toString() || item.id?.toString() || '',
            offerId: item.offerId?.toString() || item.externalId?.toString() || item.id?.toString() || '',
            name: locale === 'zh' 
              ? (item.subject || item.title || item.titleOriginal || '')
              : (item.title || item.titleOriginal || item.subject || ''),
            image: '',
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
            rating: item.rating || 0,
            reviewCount: item.sales || 0,
            rating_count: item.sales || 0,
            inStock: true,
            stockCount: 0,
            tags: [],
            isNew: false,
            isFeatured: false,
            isOnSale: discount > 0,
            createdAt: new Date(item.createDate || new Date()),
            updatedAt: new Date(item.modifyDate || new Date()),
            orderCount: item.sales || 0,
            repurchaseRate: item.repurchaseRate || '',
          } as Product;
          Object.assign(row as any, {
            // `image` comes first — productsApi normalizes the search response
            // to `item.image` (mapped from `main_image_url` / similar), and
            // without copying it here `getProductCardImageUri` has nothing to
            // resolve, causing the For You cards to show empty placeholders.
            image: item.image,
            imageUrl: item.imageUrl || item.image,
            mainImage: item.mainImage || item.main_image_url,
            picUrl: item.picUrl,
            pictUrl: item.pictUrl,
            picture: item.picture,
            images: item.images,
            imageList: item.imageList,
            offerDetail: item.offerDetail,
            offer: item.offer,
            skuInfos: item.skuInfos,
            skuList: item.skuList,
            priceInfo: item.priceInfo,
          });
          // VERIFICATION: pass quality=60 so this single screen exercises the
          // `_NxNqQ.jpg` Alibaba CDN suffix. If For-You images load correctly
          // here, the quality parameter is safe to roll out to other screens.
          (row as Product).image = getProductCardImageUri(row, undefined, 60) || '';
          return row;
        });
        // Append on load-more, replace on initial/refresh.
        if (isLoadMoreRef.current) {
          setForYouProducts((prev) => [...prev, ...mappedProducts]);
        } else {
          setForYouProducts(mappedProducts);
        }
        // No more pages to fetch once the server returns a partial page.
        setForYouHasMore(mappedProducts.length >= FOR_YOU_PAGE_SIZE);
        setIsLoadingMoreForYou(false);
        isLoadMoreRef.current = false;

        // Extract unique company names from mapped products
        const uniqueCompanies = new Set<string>(['All']);
        mappedProducts.forEach((product: any) => {
          const companyName = product.companyName || product.seller?.name || '';
          if (companyName && companyName.trim()) {
            uniqueCompanies.add(companyName);
          }
        });
        // Sort companies with "All" always first
        const sortedCompanies = Array.from(uniqueCompanies).sort((a, b) => {
          if (a === 'All') return -1;
          if (b === 'All') return 1;
          return a.localeCompare(b);
        });
        // setCompanies(sortedCompanies);
        
        // Mark this category+company combination as fetched
        if (selectedCategory) {
          hasFetchedForYouRef.current = `${selectedCategory}-${selectedCompany}`;
        }
      }
    },
    onError: (error) => {
      // console.error('Failed to fetch For You products:', error);
      setForYouProducts([]);
      // Reset ref on error so we can retry
      hasFetchedForYouRef.current = null;
      showToast(error || t('category.failedToLoadProducts'), 'error');
    },
  });

  // Use top categories for left column (from API)
  const categoriesToDisplay = useMemo(() => topCategories.map((cat: any) => ({
    id: cat._id,
    name: typeof cat.name === 'object'
      ? (cat.name[locale] || cat.name.en || cat.name.zh || 'Category')
      : cat.name,
    image: cat.imageUrl || '',
  })), [topCategories, locale]);

  // Fetch "For You" products when category or company is selected
  useEffect(() => {
    // Never interrupt a load-more fetch — if we reset isLoadMoreRef here while
    // a page-2+ request is in flight, onSuccess will treat the response as an
    // initial load and REPLACE the list instead of appending to it.
    if (isLoadMoreRef.current) return;

    if (locale && selectedCategory) {
      // Create a unique key for this combination of category and company
      const fetchKey = `${selectedCategory}-${selectedCompany}`;
      const alreadyFetched = hasFetchedForYouRef.current === fetchKey;

      // Only fetch if we haven't fetched for this combination yet
      if (!alreadyFetched) {
        // Find the selected category to get its name
        const selectedCategoryData = categoriesToDisplay.find((cat: any) => cat.id === selectedCategory);
        
        if (selectedCategoryData) {
          // Mark as fetching with the combination key
          hasFetchedForYouRef.current = fetchKey;
          
          // Get category name
          const categoryName = selectedCategoryData.name;
          
          // Get platform from selected company (default to '1688' for 'All')
          const platformSource = getPlatformFromCompany(selectedCompany);
          // For Chinese case, use 'en' country code but show subject not subjectTrans
          const countryCode = locale === 'zh' ? 'en' : locale;
          
          // Different filter for Taobao vs 1688
          const searchFilter = platformSource === 'taobao' ? undefined : 'isQqyx';
          
          isLoadMoreRef.current = false; // initial fetch — REPLACE list
          setForYouPage(1);
          setForYouHasMore(true);
          searchForYouProducts(
            categoryName,
            platformSource,
            countryCode,
            1,
            FOR_YOU_PAGE_SIZE,
            '', // sort
            undefined, // priceStart
            undefined, // priceEnd
            searchFilter, // filter - 'isQqyx' for 1688, undefined for Taobao
            false // requireAuth = false for category page
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedCompany, locale, categoriesToDisplay]); // categoriesToDisplay needed so fetch fires after categories load

  const onRefresh = async () => {
    setRefreshing(true);
    hasFetchedForYouRef.current = null;
    // Refresh For You products
    if (selectedPlatform && locale && selectedCategory) {
      const selectedCategoryData = categoriesToDisplay.find((cat: any) => cat.id === selectedCategory);
      
      if (selectedCategoryData) {
        const categoryName = selectedCategoryData.name;
        
        // Get platform from selected company (default to '1688' for 'All')
        const platformSource = getPlatformFromCompany(selectedCompany);
        // For Chinese case, use 'en' country code but show subject not subjectTrans
        const countryCode = locale === 'zh' ? 'en' : locale;
        
        // Different filter for Taobao vs 1688
        const searchFilter = platformSource === 'taobao' ? undefined : 'isQqyx';
        
        isLoadMoreRef.current = false;
        setForYouPage(1);
        setForYouHasMore(true);
        searchForYouProducts(
          categoryName,
          platformSource,
          countryCode,
          1,
          FOR_YOU_PAGE_SIZE,
          '',
          undefined,
          undefined,
          searchFilter // 'isQqyx' for 1688, undefined for Taobao
        );
      }
    }
    setRefreshing(false);
  };

  const handleCategoryPress = (categoryId: string) => {
    if (categoryId === selectedCategory) return;
    setSelectedCategory(categoryId);
    setChildCategories([]); // 즉시 비워서 스켈레톤이 바로 표시됨
    setForYouProducts([]);
    setForYouPage(1);
    setForYouHasMore(true);
    setShowAllRecommended(false);
  };

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

  const handleProductPress = async (product: Product) => {
    // Get source from product data, fallback to selectedPlatform (which is now updated when company is selected)
    const source = (product as any).source || selectedPlatform || '1688';
    await navigateToProductDetail(product.id, source, locale as string);
  };

  // Render company filter tabs
  const renderCompanyTabs = () => {
    // Always show company tabs if there are any companies (at least "All")
    if (companies.length === 0) return null;
    
    return (
      <View style={styles.companyTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.companyTabs}
        >
          {companies.map((company, index) => {
            const isSelected = selectedCompany === company;
            
            return (
              <TouchableOpacity
                key={`company-${company}-${index}`}
                style={[
                  styles.companyTab,
                  index === companies.length - 1 && { marginRight: SPACING.md },
                  index === 0 && { marginLeft: SPACING.md }
                ]}
                onPress={() => {
                  setSelectedCompany(company);
                  // Update selectedPlatform in store based on selected company
                  const platform = getPlatformFromCompany(company);
                  setSelectedPlatform(platform);
                  // console.log('[CategoryTabScreen] Company selected:', company, 'Platform updated to:', platform);
                  // Reset fetch refs to allow refetch with new company
                  hasFetchedRef.current = null;
                  hasFetchedForYouRef.current = null;
                  lastPlatformForCategoryRef.current = null;
                  setTopCategories([]);
                  setChildCategories([]);
                  setForYouProducts([]);
                  setForYouPage(1);
                  setForYouHasMore(true);
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

  const renderCategoryItem = ({ item }: { item: any }) => {
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

  const renderRecommendedItem = ({ item, index = 0 }: { item: any, index?: number }) => {
     console.log('[CategoryTabScreen] Rendering recommended item:', item);
    // 자식(subsubcategory) 중 이미지가 있는 첫 번째 항목의 이미지를 카드 이미지로 사용
    const firstChildImage =
      item.subsubcategories?.find((s: any) => s.image)?.image || '';
      console.log('[CategoryTabScreen] First child image for item:', firstChildImage);
    const rawImage = firstChildImage || item.image || '';
    console.log('[CategoryTabScreen] Raw image URL for item:', rawImage, 'First child image:', firstChildImage, 'Item image:', item.image);
    // URL이 있으면 즉시 표시 (순차 보강으로 자연스럽게 하나씩 나타남)
    const displayImage = rawImage
      ? buildProductDisplayImageUri(rawImage, IMAGE_CONFIG.HOME_GRID_IMAGE_PIXEL, 60)
      : '';
    // 앞쪽 항목 우선 다운로드 (FastImage 내부 큐 관리)
    const imagePriority = index < 4 ? FastImage.priority.high : FastImage.priority.low;

    return (
      <TouchableOpacity
        style={[styles.recommendedItem, { width: (dynWidth - 120 - SPACING.sm * 5) / 3 }]}
        onPress={() => {
          const selectedCategoryData = categoriesToDisplay.find(cat => cat.id === selectedCategory);
          
          // Convert subsubcategories to correct locale if they exist
          let localizedSubSubCategories: any[] = [];
          if (item.subsubcategories && item.subsubcategories.length > 0) {
            localizedSubSubCategories = item.subsubcategories.map((subSubCat: any) => {
              // If subSubCat.name is an object with zh, en, ko, extract the correct locale
              if (subSubCat.name && typeof subSubCat.name === 'object') {
                return {
                  ...subSubCat,
                  name: subSubCat.name[locale] || subSubCat.name.en || subSubCat.name
                };
              }
              // If it's already a string, use it as is
              return subSubCat;
            });
          }
          
          // Get platform from selected company
          const platform = getPlatformFromCompany(selectedCompany);
          
          // Always go directly to ProductDiscovery
          navigation.navigate('ProductDiscovery', { 
            subCategoryName: item.name,
            categoryId: selectedCategory,
            categoryName: selectedCategoryData?.name,
            subcategoryId: item.id,
            subsubcategories: localizedSubSubCategories,
            source: platform, // Pass the current platform/company selection
          });
        }}
      >
        <View style={styles.recommendedImageContainer}>
          {displayImage ? (
            <FastImage
              source={{ uri: displayImage, priority: imagePriority }}
              style={styles.recommendedImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <Image
              source={require('../../assets/icons/logo.png')}
              style={styles.recommendedLogo}
              resizeMode="contain"
            />
          )}
        </View>
        <Text style={styles.recommendedName} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderForYouProducts = () => {
    // 상품이 아직 없을 때만 전체 로딩 스피너 표시 (초기 로드).
    // isLoadingForYou 는 load-more 중에도 true 가 되므로, 상품이 이미
    // 있는 상태에서 이 조건을 쓰면 기존 목록이 스피너로 교체된다.
    if (isLoadingForYou && forYouProducts.length === 0) {
      // 스피너 대신 카드 구조(스켈레톤)를 먼저 보여주고, 그림은 데이터 도착 후 표시
      return (
        <View style={styles.forYouSection}>
          <View style={styles.forYouHeader}>
            <Text style={styles.forYouTitle}>{t('home.forYou')}</Text>
          </View>
          <View style={styles.forYouGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`fy-skel-${i}`} style={{ width: FOR_YOU_CARD_WIDTH }}>
                <View style={styles.fySkeletonImage} />
                <View style={styles.fySkeletonTitle} />
                <View style={styles.fySkeletonPrice} />
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Show empty state
    if (!Array.isArray(forYouProducts) || forYouProducts.length === 0) {
      return null;
    }

    return (
      <View style={styles.forYouSection}>
        <View style={styles.forYouHeader}>
          <Text style={styles.forYouTitle}>{t('home.forYou')}</Text>
        </View>
        <View style={styles.forYouGrid}>
          {forYouProducts.map((product: Product, index: number) => {
            const handleLike = async () => {
              if (!user || isGuest) {
                Alert.alert('', t('home.pleaseLogin'));
                return;
              }
              try {
                await toggleWishlist(product);
              } catch (error) {
                // console.error('Error toggling wishlist:', error);
              }
            };

            return (
              <ProductCard
                key={`foryou-${product.id || index}`}
                product={product}
                variant="moreToLove"
                onPress={() => handleProductPress(product)}
                onLikePress={handleLike}
                isLiked={isProductLiked(product)}
                showLikeButton={true}
                showDiscountBadge={true}
                showRating={true}
                cardWidth={FOR_YOU_CARD_WIDTH}
              />
            );
          })}
        </View>
        {/* 하단 스피너: load-more 또는 추가 페이지 로딩 중 */}
        {(isLoadingMoreForYou || isLoadingForYou) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}
      </View>
    );
  };

  // 추천항목: level2 카테고리만 카드로 표시, level3는 subsubcategories로 전달
  // 클릭 시 ProductDiscovery로 이동해 해당 이름으로 상품 검색 (검색창 검색과 동일)
  const recommendedItems = useMemo(() => {
    return childCategories.map((level2: any) => {
      const level3Children = Array.isArray(level2.children) ? level2.children : [];
      const firstChildImage = level3Children
        .map((child: any) => getCategoryImage(child))
        .find((img: string) => !!img) || '';

      const level2Name = typeof level2.name === 'object'
        ? (level2.name[locale] || level2.name.en || level2.name.zh || '')
        : (level2.name || '');

      return {
        id: level2._id,
        name: level2Name,
        // fetchPreviewImage 가 level2.imageUrl 에 상품 검색 첫 이미지를 저장하므로
        // getCategoryImage(level2) 를 firstChildImage 보다 먼저 확인해야 한다
        image: getCategoryImage(level2) || firstChildImage || '',
        subsubcategories: level3Children.map((level3: any) => ({
          id: level3._id,
          name: typeof level3.name === 'object'
            ? (level3.name[locale] || level3.name.en || level3.name.zh || '')
            : (level3.name || ''),
          externalId: level3.externalId,
          image: getCategoryImage(level3) || '',
        })),
      };
    }).filter((item: any) => item.name); // 이름 없는 항목 제거
  }, [childCategories, locale, getCategoryImage]);

  // Infinite-scroll: fetch the next page of For You products and append
  // them to the existing list. Triggered by the parent ScrollView's
  // onScroll handler when the user is near the bottom of the screen.
  // Defined here (not earlier) so `categoriesToDisplay` is in scope.
  const loadMoreForYouProducts = useCallback(() => {
    // isLoadMoreRef is a ref → synchronous, never stale across renders.
    // Using state (isLoadingMoreForYou) here caused a race: React batches
    // state updates, so a second scroll event 400 ms later could see the
    // old false value and fire a duplicate request.
    if (isLoadMoreRef.current || !forYouHasMore) return;
    if (!selectedCategory || !selectedCompany) return;

    const selectedCategoryData = categoriesToDisplay.find(
      (cat: any) => cat.id === selectedCategory,
    );
    if (!selectedCategoryData) return;

    // Lock immediately — before any async work — so concurrent scroll
    // events that fire before the next render are also blocked.
    isLoadMoreRef.current = true;
    setIsLoadingMoreForYou(true);

    const categoryName = selectedCategoryData.name;
    const platformSource = getPlatformFromCompany(selectedCompany);
    const countryCode = locale === 'zh' ? 'en' : locale;
    const searchFilter = platformSource === 'taobao' ? undefined : 'isQqyx';

    const nextPage = forYouPage + 1;
    setForYouPage(nextPage);

    searchForYouProducts(
      categoryName,
      platformSource,
      countryCode,
      nextPage,
      FOR_YOU_PAGE_SIZE,
      '',
      undefined,
      undefined,
      searchFilter,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    forYouHasMore,
    selectedCategory,
    selectedCompany,
    locale,
    forYouPage,
    categoriesToDisplay,
  ]);
  
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
                renderItem={renderCategoryItem}
                keyExtractor={(item) => `category-${item.id || item.name}`}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                style={{minHeight: '100%'}}
              />
            )}
          </ScrollView>
        </View>
        
        <View style={styles.rightColumn}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const currentY = contentOffset.y;
              const isScrollingDown = currentY > lastScrollYRef.current;
              lastScrollYRef.current = currentY;
              if (!isScrollingDown) return;

              const distanceFromEnd =
                contentSize.height - layoutMeasurement.height - currentY;
              if (distanceFromEnd < 200) {
                loadMoreForYouProducts();
              }
            }}
            scrollEventThrottle={400}
          >
            {/* Recommended Section */}
            <View style={styles.recommendedSection}>
              <TouchableOpacity 
                style={styles.recommendedHeader}
                onPress={() => setShowRecommended(!showRecommended)}
              >
                <Text style={styles.recommendedTitle}>{t('home.recommended')}</Text>
                <Icon 
                  name={showRecommended ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={COLORS.text.primary} 
                />
              </TouchableOpacity>
              {showRecommended && (
                <>
                  {(isLoadingChildCategories || (recommendedItems.length === 0 && !!selectedCategory)) ? (
                    // 스켈레톤: 카테고리 전환 시 구조 먼저 표시
                    <View style={styles.recommendedGrid}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <View key={`skel-${i}`} style={[styles.recommendedItem, { width: (dynWidth - 120 - SPACING.sm * 5) / 3 }]}>
                          <View style={[styles.recommendedImageContainer, styles.skeletonBox]} />
                          <View style={styles.skeletonText} />
                        </View>
                      ))}
                    </View>
                  ) : recommendedItems.length === 0 ? null : (
                    <>
                      <View style={styles.recommendedGrid}>
                        {(showAllRecommended ? recommendedItems : recommendedItems.slice(0, 6)).map((item: any, index: number) => (
                          <View key={`rec-${item.id || index}`}>
                            {renderRecommendedItem({ item, index })}
                          </View>
                        ))}
                      </View>
                      {!showAllRecommended && recommendedItems.length > 6 && (
                        <TouchableOpacity
                          style={styles.showMoreButton}
                          onPress={() => setShowAllRecommended(true)}
                        >
                          <Text style={styles.showMoreText}>더보기 ({recommendedItems.length - 6}+)</Text>
                          <Icon name="chevron-down" size={14} color={COLORS.text.secondary} />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
            
            {/* For You Section */}
            {renderForYouProducts()}
          </ScrollView>
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
    width: '90%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flexDirection: 'row',
    minHeight: '100%',
    paddingBottom: 100
  },
  leftColumn: {
    width: 120,
    backgroundColor: COLORS.gray[100],
  },
  rightColumn: {
    flex: 1,
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
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    textAlign: 'left',
    fontWeight: '500',
  },
  categoryNameActive: {
    fontWeight: '600',
    color: COLORS.red,
  },
  recommendedSection: {
    flex: 1,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.xl,
    borderBottomWidth: 5,
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.lg,
    borderBottomColor: COLORS.gray[200],
  },
  recommendedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  recommendedTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  recommendedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  recommendedItem: {
    width: (_staticWidth - 120 - SPACING.sm * 5) / 3,
    alignItems: 'center',
    padding: SPACING.sm,
  },
  recommendedImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  recommendedImage: {
    width: '100%',
    height: '100%',
  },
  recommendedLogo: {
    width: '60%',
    height: '60%',
  },
  recommendedName: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  skeletonBox: {
    backgroundColor: COLORS.gray[200],
  },
  skeletonText: {
    height: 10,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    marginTop: SPACING.xs,
    width: '70%',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  showMoreText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  forYouSection: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  forYouHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  forYouTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  forYouGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingBottom: SPACING.lg * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  fySkeletonImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  fySkeletonTitle: {
    height: 10,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    marginBottom: SPACING.xs,
    width: '85%',
  },
  fySkeletonPrice: {
    height: 10,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    width: '45%',
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