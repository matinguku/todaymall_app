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
  TextInput,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import LinearGradient from 'react-native-linear-gradient';
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

  const platforms = ['1688', 'taobao', 'myCompany'];

  // Get categories tree from store to check if already loaded
  const { categoriesTree } = usePlatformStore();
  const hasFetchedRef = useRef<string | null>(null); // Track which platform we've fetched
  const hasFetchedForYouRef = useRef<string | null>(null); // Track which category we've fetched for "For You"
  const lastPlatformForCategoryRef = useRef<string | null>(null); // Track which platform we last set category for
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

      // Enrich missing images in background.
      (async () => {
        const enrichedTree = await Promise.all(
          childCatsTree.map(async (level2: any) => {
            const level2Name = getLocalizedCategoryName(level2);
            const level3Children = Array.isArray(level2.children) ? level2.children : [];

            const enrichedChildren = await Promise.all(
              level3Children.map(async (level3: any) => {
                const level3Image = getCategoryImage(level3);
                if (level3Image) return level3;

                const level3Name = getLocalizedCategoryName(level3);
                const previewImage = await fetchPreviewImage(level3Name);
                return previewImage ? { ...level3, imageUrl: previewImage } : level3;
              })
            );

            const firstChildImage = enrichedChildren
              .map((child: any) => getCategoryImage(child))
              .find((img: string) => !!img);

            const level2Image = getCategoryImage(level2) || firstChildImage || await fetchPreviewImage(level2Name);
            return {
              ...level2,
              imageUrl: level2Image || level2.imageUrl || '',
              children: enrichedChildren,
            };
          })
        );

        if (activeChildRequestKeyRef.current !== requestKey) {
          return;
        }

        setChildCategories(enrichedTree);

        if (requestKey) {
          childCategoryCacheRef.current[requestKey] = enrichedTree;
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
          
          // Page size kept small (6) so the For You list paints quickly
          // when the user opens / switches a category. Was 20, but the
          // larger payload + 20 image downloads delayed first paint —
          // the rest of the list streams in via infinite-scroll below.
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
        
        // Same small page size on pull-to-refresh — see the initial
        // fetch above for context. Reset infinite-scroll bookkeeping
        // back to page 1 so subsequent scroll-to-bottom starts fresh.
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
    // Just select the category - recommended subcategories will show automatically
    setSelectedCategory(categoryId);
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

  const renderRecommendedItem = ({ item }: { item: any }) => {
    // Pull whatever image field the API or the background enrichment
    // populated. Then run it through the same CDN thumbnail transform
    // the home page uses so the request is small + cacheable.
    const rawImage = item.image || item.imageUrl || '';
    const displayImage = rawImage
      ? buildProductDisplayImageUri(rawImage, IMAGE_CONFIG.HOME_GRID_IMAGE_PIXEL, 60)
      : '';

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
              source={{ uri: displayImage, priority: FastImage.priority.normal }}
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
    // Show loading state
    if (isLoadingForYou) {
      return (
        <View style={styles.forYouSection}>
          <View style={styles.forYouHeader}>
            <Text style={styles.forYouTitle}>{t('home.forYou')}</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('category.loadingProducts')}</Text>
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
        {/* Footer spinner while infinite-scroll fetches the next page. */}
        {isLoadingMoreForYou && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}
      </View>
    );
  };

  // Transform child categories to recommended items format (from API)
  const allRecommendedItems = useMemo(() => childCategories.flatMap((level2: any) => {
    const items: any[] = [];
    const level3Children = Array.isArray(level2.children) ? level2.children : [];
    const firstChildImage = level3Children
      .map((child: any) => getCategoryImage(child))
      .find((img: string) => !!img) || '';
    
    // Add level 2 category as an item
    items.push({
      id: level2._id,
      name: typeof level2.name === 'object'
        ? (level2.name[locale] || level2.name.en || level2.name.zh || 'Category')
        : level2.name,
      // Prefer the first image from the list that appears after tapping this item.
      image: firstChildImage || getCategoryImage(level2) || '',
      subsubcategories: level3Children.map((level3: any) => ({
        id: level3._id,
        name: typeof level3.name === 'object'
          ? (level3.name[locale] || level3.name.en || level3.name.zh || 'Category')
          : level3.name,
        externalId: level3.externalId,
        image: getCategoryImage(level3) || '',
      })),
    });

    // Add level 3 categories as separate items
    if (level3Children.length > 0) {
      level3Children.forEach((level3: any, index: number) => {
        items.push({
          id: level3._id,
          name: typeof level3.name === 'object'
            ? (level3.name[locale] || level3.name.en || level3.name.zh || 'Category')
            : level3.name,
          // If this item has no own image, use the first image from the shown list.
          image: getCategoryImage(level3) || (index === 0 ? firstChildImage : '') || '',
          isLevel3: true,
          parentId: level2._id,
        });
      });
    }

    return items;
  }), [childCategories, locale, getCategoryImage]);
  
  // Show only first 9 subcategories as recommended. If a recommended
  // card still has no image (because the background fetchPreviewImage
  // search returned nothing for that category name), fall back to the
  // first For You product image at the same index — those products are
  // already loaded for the SAME category, so their images are
  // representative and guaranteed to be available.
  const recommendedItems = useMemo(() => {
    const sliced = allRecommendedItems.slice(0, 9);
    if (forYouProducts.length === 0) return sliced;
    return sliced.map((item: any, idx: number) => {
      if (item.image) return item;
      const fallback = forYouProducts[idx % forYouProducts.length];
      const fallbackImage =
        (fallback as any)?.image ||
        (fallback as any)?.imageUrl ||
        '';
      return fallbackImage ? { ...item, image: fallbackImage } : item;
    });
  }, [allRecommendedItems, forYouProducts]);

  // Infinite-scroll: fetch the next page of For You products and append
  // them to the existing list. Triggered by the parent ScrollView's
  // onScroll handler when the user is near the bottom of the screen.
  // Defined here (not earlier) so `categoriesToDisplay` is in scope.
  const loadMoreForYouProducts = useCallback(() => {
    if (isLoadingMoreForYou || !forYouHasMore) return;
    if (!selectedCategory || !selectedCompany) return;

    const selectedCategoryData = categoriesToDisplay.find(
      (cat: any) => cat.id === selectedCategory,
    );
    if (!selectedCategoryData) return;

    const categoryName = selectedCategoryData.name;
    const platformSource = getPlatformFromCompany(selectedCompany);
    const countryCode = locale === 'zh' ? 'en' : locale;
    const searchFilter = platformSource === 'taobao' ? undefined : 'isQqyx';

    const nextPage = forYouPage + 1;
    setForYouPage(nextPage);
    setIsLoadingMoreForYou(true);
    isLoadMoreRef.current = true;

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
    isLoadingForYou,
    isLoadingMoreForYou,
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
            // Detect approach to the bottom and fire load-more for the
            // For You list. Threshold of 200px lets the next page start
            // fetching just before the user actually hits the end.
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const distanceFromEnd =
                contentSize.height - layoutMeasurement.height - contentOffset.y;
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
                  <View style={styles.recommendedGrid}>
                    {recommendedItems.map((item, index) => (
                      <View key={`rec-${item.id || index}`}>
                        {renderRecommendedItem({ item })}
                      </View>
                    ))}
                  </View>
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