import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Modal,
  StatusBar,
  Share,
  Platform,
  Animated,
  InteractionManager,
  useWindowDimensions,
  PixelRatio,
  ActivityIndicator,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from '../../components/Icon';
// Removed WebView import - using simpler HTML rendering approach
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, SERVER_BASE_URL, BACK_NAVIGATION_HIT_SLOP } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import {
  isLiveSource,
  resolveLiveCode,
  pickExplicitLiveCodeFromTree,
  extractLiveCode,
  getLiveCodeForCartPayload,
  resolveLiveCodeForOwnmallOrderLine,
  sanitizeLiveCodeForApi,
  isStrictBackendLiveCode,
} from '../../utils/liveCode';
import { recordLiveProduct } from '../../utils/liveProductTracker';

import { ProductCard, SearchButton } from '../../components';
import { PhotoCaptureModal } from '../../components';
import { usePlatformStore } from '../../store/platformStore';
import { useAppSelector } from '../../store/hooks';
import { Product } from '../../types';
import { useProductDetailMutation } from '../../hooks/useProductDetailMutation';
import { useRelatedRecommendationsMutation } from '../../hooks/useRelatedRecommendationsMutation';
import { useSearchProductsMutation } from '../../hooks/useSearchProductsMutation';
import { useAddToCartMutation } from '../../hooks/useAddToCartMutation';
import { useCheckoutDirectPurchaseMutation } from '../../hooks/useCheckoutDirectPurchaseMutation';
import { useTranslation } from '../../hooks/useTranslation';
import { useToast } from '../../context/ToastContext';
import { formatPriceKRW, getLocalizedText } from '../../utils/i18nHelpers';
import { buildCdnThumbnailUri } from '../../utils/productImage';
import { warmRelatedPage } from '../../utils/relatedPrefetch';
import { useWishlistStatus } from '../../hooks/useWishlistStatus';
import { useAddToWishlistMutation } from '../../hooks/useAddToWishlistMutation';
import { useDeleteFromWishlistMutation } from '../../hooks/useDeleteFromWishlistMutation';
import { useGetCartMutation } from '../../hooks/useGetCartMutation';
import { productsApi } from '../../services/productsApi';
import HeartPlusIcon from '../../assets/icons/HeartPlusIcon';
import FamilyStarIcon from '../../assets/icons/FamilyStarIcon';
import ArrowBackIcon from '../../assets/icons/ArrowBackIcon';
import CartIcon from '../../assets/icons/CartIcon';
import StarIcon from '../../assets/icons/StarIcon';
import StarHalfIcon from '../../assets/icons/StarHalfIcon';
import StarOutlineIcon from '../../assets/icons/StarOutlineIcon';
import DeliveryIcon from '../../assets/icons/DeliveryIcon';
import ArrowRightIcon from '../../assets/icons/ArrowRightIcon';
import HeartIcon from '../../assets/icons/HeartIcon';
import CameraIcon from '../../assets/icons/CameraIcon';
import SupportAgentIcon from '../../assets/icons/SupportAgentIcon';
import ContentCopyIcon from '../../assets/icons/ContentCopyIcon';
import PlusIcon from '../../assets/icons/PlusIcon';
import MinusIcon from '../../assets/icons/MinusIcon';
import ShareAppIcon from '../../assets/icons/ShareAppIcon';
import CheckIcon from '../../assets/icons/CheckIcon';
import ShoppingCreditsIcon from '../../assets/icons/ShoppingCreditsIcon';
import HomeIcon from '../../assets/icons/HomeIcon';
import SellerShopIcon from '../../assets/icons/SellerShopIcon';
import ImageSearchResultsModal from './searchScreen/ImageSearchResultsModal';
import SearchImageIcon from '../../assets/icons/SearchImageIcon';

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = 400;

const GALLERY_THUMB_QUALITY = 55;

/** ~2× 60dp swatch decode target for retina without loading full SKU photos. */
const COLOR_SWATCH_THUMB_EDGE = 120;
const COLOR_SWATCH_THUMB_QUALITY = 58;

const TAOBAO_RELATED_THUMB_QUALITY = 56;

/** Memoized gallery page: CDN-sized decode + FastImage cache to limit PDP jank. */
type PdpGallerySlideProps = {
  uri: string;
  widthPx: number;
  heightPx: number;
  thumbEdgePx: number;
  index: number;
  onPress: () => void;
};

const PdpGallerySlide = React.memo(function PdpGallerySlide({
  uri,
  widthPx,
  heightPx,
  thumbEdgePx,
  index,
  onPress,
}: PdpGallerySlideProps) {
  const thumbUri = useMemo(
    () => buildCdnThumbnailUri(uri, thumbEdgePx, GALLERY_THUMB_QUALITY),
    [uri, thumbEdgePx],
  );
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <FastImage
        source={{
          uri: thumbUri,
          priority: index === 0 ? FastImage.priority.high : FastImage.priority.low,
          cache: FastImage.cacheControl.immutable,
        }}
        style={{ width: widthPx, height: heightPx, backgroundColor: COLORS.gray[100] }}
        resizeMode={FastImage.resizeMode.cover}
      />
    </TouchableOpacity>
  );
});

const ColorSwatchImage = React.memo(function ColorSwatchImage({
  uri,
  isSelected,
}: {
  uri: string;
  isSelected: boolean;
}) {
  const thumbUri = useMemo(
    () => buildCdnThumbnailUri(uri, COLOR_SWATCH_THUMB_EDGE, COLOR_SWATCH_THUMB_QUALITY),
    [uri],
  );
  return (
    <FastImage
      source={{
        uri: thumbUri,
        priority: FastImage.priority.low,
        cache: FastImage.cacheControl.immutable,
      }}
      style={[styles.colorImage, isSelected && styles.selectedColorImage] as any}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
});

const TaobaoRelatedThumb = React.memo(function TaobaoRelatedThumb({
  uri,
  thumbEdgePx,
}: {
  uri: string;
  thumbEdgePx: number;
}) {
  const thumbUri = useMemo(
    () => buildCdnThumbnailUri(uri, thumbEdgePx, TAOBAO_RELATED_THUMB_QUALITY),
    [uri, thumbEdgePx],
  );
  return (
    <FastImage
      source={{
        uri: thumbUri,
        priority: FastImage.priority.low,
        cache: FastImage.cacheControl.immutable,
      }}
      style={styles.simpleTaobaoImage as any}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
});

/**
 * Suppliers often emit the same dimension under different labels (e.g.
 * `컬러` vs `색상` vs `颜色`), which created multiple PDP rows that all
 * read as "color". Collapse those headers to one internal key.
 */
function canonicalVariationTypeKey(typeName: string): string {
  const raw = (typeName || '').trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();

  const colorExact = new Set([
    'color',
    'colour',
    '颜色',
    '色彩',
    '色',
    '색상',
    '색깔',
    '컬러',
    '主色',
    '配色',
  ]);
  if (colorExact.has(lower) || colorExact.has(raw)) return 'color';
  if (/컬러|색상|색깔|颜色|色彩/.test(raw)) return 'color';

  const sizeExact = new Set(['size', '尺码', '尺寸', '사이즈', '크기']);
  if (sizeExact.has(lower) || sizeExact.has(raw)) return 'size';
  if (/尺码|尺寸|사이즈|크기/.test(raw)) return 'size';

  return raw;
}

function parseVariantNameSegments(variantName: string): Array<{ typeKey: string; value: string }> {
  const out: Array<{ typeKey: string; value: string }> = [];
  variantName.split('/').forEach((part) => {
    const p = part.trim();
    const colonIndex = p.indexOf(':');
    if (colonIndex === -1) return;
    const typeName = p.substring(0, colonIndex).trim();
    const value = p.substring(colonIndex + 1).trim();
    if (!typeName || !value) return;
    out.push({ typeKey: canonicalVariationTypeKey(typeName), value });
  });
  return out;
}

/** True when a raw variant `name` string encodes every selected dimension. */
function rawVariantNameMatchesSelections(variantName: string, selections: Record<string, string>): boolean {
  if (!variantName || Object.keys(selections).length === 0) return false;
  const segments = parseVariantNameSegments(variantName);
  return Object.entries(selections).every(([stateKey, selectedVal]) => {
    const canon = stateKey.toLowerCase();
    return segments.some(
      (s) =>
        s.typeKey.toLowerCase() === canon &&
        String(s.value).toLowerCase() === String(selectedVal).toLowerCase(),
    );
  });
}

function skuAttributeRowMatches(attr: any, canonicalKey: string, selectedValue: string): boolean {
  const rawAttr = String(attr?.attributeNameTrans || attr?.attributeName || '').trim();
  if (!rawAttr) return false;
  if (canonicalVariationTypeKey(rawAttr).toLowerCase() !== canonicalKey.toLowerCase()) return false;
  const v = String(attr?.valueTrans || attr?.value || '').trim();
  return v.toLowerCase() === String(selectedValue).toLowerCase();
}

/**
 * PDP badge / copy row: label is always "Product Code"; for live-commerce the
 * numeric value is the live code (explicit / name / route), then offerId, then
 * catalog code.
 */
function getPdpCatalogCodeDisplay(
  routeSource: unknown,
  product: any,
  routeLiveCode?: unknown,
): { value: string } {
  const catalog =
    String(product?.productCode ?? '').trim() ||
    String(product?.offerId ?? '').trim() ||
    String(product?.id ?? '').trim();
  if (!isLiveSource(routeSource)) {
    return { value: catalog };
  }
  const directLive = sanitizeLiveCodeForApi((product as any)?.liveCode);
  if (directLive) return { value: directLive };
  const fromNav =
    routeLiveCode != null && routeLiveCode !== '' ? String(routeLiveCode).trim() : '';
  const fromNavOk = sanitizeLiveCodeForApi(fromNav);
  if (fromNavOk) return { value: fromNavOk };
  const resolved = sanitizeLiveCodeForApi(
    resolveLiveCode(routeSource, product, product?.name, product?.subject, product?.subjectTrans),
  );
  const offer = String((product as any).offerId ?? '').trim();
  if (resolved) return { value: resolved };
  if (offer) return { value: offer };
  return { value: catalog };
}

/** True when navigation passed a non-empty liveCode that fails API format rules. */
function routeHasInvalidLiveCommerceLiveParam(routeLiveCode: unknown): boolean {
  const raw = routeLiveCode != null ? String(routeLiveCode).trim() : '';
  if (!raw) return false;
  return !isStrictBackendLiveCode(raw);
}

/** Plain text from HTML description — module scope so PDP re-renders don't re-parse unless `description` changes. */
function stripHtmlDescriptionToPlain(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const ProductDetailScreen: React.FC = () => {
  const { width: dynWidth, height: dynHeight } = useWindowDimensions();
  const pdpIsTablet = Math.min(dynWidth, dynHeight) >= 600;
  const pdpIsLandscape = dynWidth > dynHeight;
  const pdpGridCols = pdpIsTablet ? (pdpIsLandscape ? 4 : 3) : 2;
  const pdpGridCardWidth = (dynWidth - SPACING.sm * 2 - SPACING.sm * (pdpGridCols - 1)) / pdpGridCols;
  const taobaoRelatedThumbEdge = Math.min(
    360,
    Math.max(200, Math.round(pdpGridCardWidth * Math.min(PixelRatio.get(), 3))),
  );
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const {
    productId,
    offerId,
    productData: initialProductData,
    source: routeSource,
    country: routeCountry,
    liveCode: routeLiveCode,
  } = route.params || {};
  // console.log("[ProductDetailScreen] routeSource:", routeSource);
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS OR HOOKS THAT USE THEM
  // Get platform and locale (defined early so they can be used in callbacks)
  const { selectedPlatform } = usePlatformStore();
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';
  const { t } = useTranslation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  
  // Use wishlist status hook to check if products are liked based on external IDs
  const { isProductLiked, refreshExternalIds, addExternalId, removeExternalId } = useWishlistStatus();
  const { user, isAuthenticated } = useAuth();
  
  // Use refs to track values (defined early)
  const sourceRef = useRef<string>('1688');
  const countryRef = useRef<string>('en');
  const hasFetchedProductRef = useRef<string | null>(null);
  /** When `offerId` / `productId` / `source` change, reset PDP so we do not show the previous product until the new detail arrives. */
  const routeProductIdentityRef = useRef<string>('');

  // Keep refs in sync with route params / store so fetch calls use correct source/country
  useEffect(() => {
    // Prefer explicit route params when provided, otherwise fallback to selectedPlatform/locale
    const rawSource = (route.params?.source as string) || selectedPlatform || '1688';
    sourceRef.current = (rawSource === 'live-commerce' || rawSource === 'companymall' || rawSource === 'myCompany' || rawSource?.toLowerCase() === 'mycompany') ? 'ownmall' : rawSource;
    countryRef.current = (route.params?.country as string) || (locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en');
  }, [route.params?.source, route.params?.country, selectedPlatform, locale]);
  
  // Use product data from navigation params if available, otherwise fetch.
  // Render whatever we have on the first frame and refresh in the
  // background — there's no loading screen, so when `product` is null the
  // page just shows an empty background until the detail API resolves.
  const [product, setProduct] = useState<any>(initialProductData || null);
  // Set to true once the product-detail API has resolved (or failed). Related
  // products only fetch after this so the heavy detail call wins network /
  // CPU budget on the first paint.
  const [detailFetched, setDetailFetched] = useState(false);
  const [wishlistCount, setWishlistCount] = useState<number | null>(null);
  // Live-commerce seller info (avatar, name, viewer count, etc.). Populated
  // from /live-commerce/sellers/:sellerId when the recommendations fetch
  // runs for live products. Used by the seller mini-card under the title.
  const [liveSellerInfo, setLiveSellerInfo] = useState<any>(null);
  /** After first paint + idle: mount description HTML parsing and "more to love" to cut Davey/GC on open. */
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  const scrollRelatedPrefetchAtRef = useRef(0);

  // Post-login auto-add-to-cart flow.
  // When a logged-out user taps "Add to Cart" we open Auth → Signup (modal)
  // with autoAddToCart=true. When auth succeeds and we return to this
  // screen, we render a loading view INSTEAD of the regular product detail
  // UI so the user doesn't see the product page flash between Login and
  // Cart — they perceive a direct Login → Cart transition.
  // Initialize from route.params so the very first render after returning
  // from Login already shows the loader (no one-frame flash).
  const [isAutoCartFlow, setIsAutoCartFlow] = useState<boolean>(
    () => Boolean((route.params as any)?.autoAddToCart),
  );
  // Single-fire guard for the auto-trigger useEffect below. Declared here
  // (above the addToCart hook) so the hook's onError closure can reset it.
  const autoAddTriggeredRef = useRef(false);
  // Same dual-guard pattern as `autoBuyNowOnMountRef` — avoids firing add-to-cart
  // from a stale restored `autoAddToCart` param unless this screen also saw the
  // intent (including returning from Auth onto an already-mounted PDP).
  const autoAddToCartOnMountRef = useRef<boolean>(
    Boolean((route.params as any)?.autoAddToCart),
  );
  const autoBuyTriggeredRef = useRef(false);
  // Snapshot the auto-buy intent at mount. Without this snapshot, a stale
  // `autoBuyNow: true` left in restored navigation state (e.g. after a
  // navigation persistence round-trip, or after a Login flow that didn't
  // fully clear its params) would fire Buy Now the next time the user
  // simply opens any product card. Auto-Buy is meant for the
  // Login→ProductDetail return path only; we capture it once and the rest
  // of the effect requires both this snapshot AND the live route param.
  const autoBuyNowOnMountRef = useRef<boolean>(
    Boolean((route.params as any)?.autoBuyNow),
  );

  // When returning from Auth (modal) with `autoBuyNow` in params, the screen
  // may already be mounted — refresh the mount snapshot so post-login Buy Now
  // still runs once.
  useEffect(() => {
    if ((route.params as any)?.autoBuyNow) {
      autoBuyNowOnMountRef.current = true;
      autoBuyTriggeredRef.current = false;
    }
  }, [(route.params as any)?.autoBuyNow]);

  useEffect(() => {
    if ((route.params as any)?.autoAddToCart) {
      autoAddToCartOnMountRef.current = true;
      autoAddTriggeredRef.current = false;
    }
  }, [(route.params as any)?.autoAddToCart]);

  // Scroll-based header animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_SCROLL_THRESHOLD = 80;

  // Image search state
  const [similarSearchVisible, setSimilarSearchVisible] = useState(false);
  const [similarSearchBase64, setSimilarSearchBase64] = useState<string>('');
  const [similarSearchUri, setSimilarSearchUri] = useState<string>('');
  const [isFetchingBase64, setIsFetchingBase64] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  // Imperative handle on the image-gallery FlatList so a color-option tap
  // can jump it to the matching image. Each page is `dynWidth` wide.
  const galleryScrollRef = useRef<FlatList<string> | null>(null);
  // When a variation option carries an image that is NOT already in the
  // product's gallery (apiImages), we append it as a "virtual" extra page
  // so the user still sees the image they picked. Replaced each time the
  // user picks a different out-of-gallery option; cleared when the chosen
  // option's image is found in apiImages.
  const [extraVariationImage, setExtraVariationImage] = useState<string | null>(null);

  // Stock-text pulse animation. Idle at scale 1; runs 4 cycles of
  // 1 → 1.15 → 1 (≈ 1.6 s total) when fired by `pulseStock()`. Fired from
  // the Add to Cart / Buy Now button presses to draw the user's eye to the
  // stock badge — works both as a confirmation tap when the item is in
  // stock and as an alert when the item is out of stock and the buttons
  // refuse to proceed.
  const stockPulse = useRef(new Animated.Value(1)).current;
  const pulseStock = useCallback(() => {
    stockPulse.stopAnimation(() => {
      stockPulse.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(stockPulse, { toValue: 1.15, duration: 200, useNativeDriver: true }),
          Animated.timing(stockPulse, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
        { iterations: 4 },
      ).start();
    });
  }, [stockPulse]);

  // When `extraVariationImage` is added/replaced, the gallery re-renders
  // with one more page at index `apiImages.length`. Defer the scroll until
  // after that render so the ScrollView has the new contentSize; otherwise
  // it would clamp the scroll into the old (smaller) bounds.
  useEffect(() => {
    if (!extraVariationImage) return;
    const apiImages = getApiProductImages(product);
    const targetIdx = apiImages.length; // Appended page sits at the end.
    const id = setTimeout(() => {
      setSelectedImageIndex(targetIdx);
      galleryScrollRef.current?.scrollToOffset({
        offset: targetIdx * dynWidth,
        animated: true,
      });
    }, 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraVariationImage]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  // Initialize quantity with minOrderQuantity if available, otherwise 1
  const [quantity, setQuantity] = useState(() => {
    const minOrderQty = initialProductData?.minOrderQuantity;
    return minOrderQty && minOrderQty > 0 ? minOrderQty : 1;
  });
  
  // Add to wishlist mutation (defined after t and showToast)
  const { mutate: addToWishlist } = useAddToWishlistMutation({
    onSuccess: async (data) => {
      showToast(t('product.productAddedToWishlist') || 'Product added to wishlist', 'success');
      // Immediately refresh external IDs to update heart icon color
      await refreshExternalIds();
      // Refresh wishlist count
      const externalId = product?.offerId || product?.externalId || product?.id || productId || offerId || '';
      const fetchSource = sourceRef.current;
      if (externalId && fetchSource) {
        try {
          const response = await productsApi.getWishlistCount(externalId.toString(), fetchSource);
          if (response.success && response.data) {
            setWishlistCount(response.data.count || 0);
          }
        } catch (error) {
          // console.error('Failed to refresh wishlist count:', error);
        }
      }
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
      // Refresh wishlist count
      const externalId = product?.offerId || product?.externalId || product?.id || productId || offerId || '';
      const fetchSource = sourceRef.current;
      if (externalId && fetchSource) {
        try {
          const response = await productsApi.getWishlistCount(externalId.toString(), fetchSource);
          if (response.success && response.data) {
            setWishlistCount(response.data.count || 0);
          }
        } catch (error) {
          // console.error('Failed to refresh wishlist count:', error);
        }
      }
    },
    onError: (error) => {
      showToast(error || t('product.failedToRemoveFromWishlist'), 'error');
    },
  });
  
  // Add to cart mutation (for Add to Cart button)
  const { mutate: addToCart, isLoading: isAddingToCart } = useAddToCartMutation({
    onSuccess: (data) => {
      showToast(t('product.addedToCart'), 'success');
      // Stay on the product page; clear the post-login loader if it was
      // shown so the user falls back to the regular product detail view.
      setIsAutoCartFlow(false);
    },
    onError: (error) => {
      // console.error('Failed to add product to cart:', error);
      showToast(error || t('product.failedToAdd'), 'error');
      // If we were in the post-login auto-add flow, reset both guards so
      // the user lands back on the regular product detail page (with the
      // error toast) instead of being stuck on the loading screen.
      autoAddTriggeredRef.current = false;
      setIsAutoCartFlow(false);
    },
  });

  // Get cart mutation to fetch cart after adding product (for Buy Now - navigates to Payment)
  const { mutate: fetchCart } = useGetCartMutation({
    onSuccess: (data) => {
      // console.log('Cart fetched after Buy Now:', data);
      // Find the cart item we just added
      const cartData = data?.cart;
      const cartItems = cartData?.items || [];
      
      // Find the item that matches our product
      const productIdForUrl = product?.offerId || product?.id || productId || offerId || '';
      const addedCartItem = cartItems.find((item: any) => 
        item.offerId?.toString() === productIdForUrl.toString() ||
        item.productId?.toString() === productIdForUrl.toString()
      );
      
      if (!addedCartItem) {
        showToast(t('product.failedToFindCartItem'), 'error');
        return;
      }
      
      // Format the item for Payment screen (similar to CartScreen)
      const price = parseFloat(addedCartItem.skuInfo?.price || addedCartItem.skuInfo?.consignPrice || addedCartItem.price || product?.price || '0');
      const productQuantity = quantity;
      
      // Extract color and size from variations
      const variations = (addedCartItem.skuInfo?.skuAttributes || []).map((attr: any) => ({
        name: attr.attributeNameTrans || attr.attributeName || '',
        value: attr.valueTrans || attr.value || '',
      }));
      
      const colorVariation = variations.find((v: any) =>
        v.name.toLowerCase().includes('color') || v.name.toLowerCase().includes('colour')
      );
      const sizeVariation = variations.find((v: any) =>
        v.name.toLowerCase().includes('size')
      );
      
      const paymentItem = {
        id: addedCartItem.id || addedCartItem._id || productIdForUrl.toString(),
        _id: addedCartItem._id, // Cart item ID from backend
        name: product?.name || product?.subjectTrans || product?.subject || addedCartItem.subjectTrans || '',
        color: colorVariation?.value || selectedVariations[Object.keys(selectedVariations).find(k => k.toLowerCase().includes('color')) || ''] || undefined,
        size: sizeVariation?.value || selectedVariations[Object.keys(selectedVariations).find(k => k.toLowerCase().includes('size')) || ''] || undefined,
        price: price,
        quantity: productQuantity,
        image: product?.images?.[0] || product?.image || addedCartItem.imageUrl || '',
      };
      
      const totalAmount = price * productQuantity;
      
      // Navigate directly to Payment page (like CartScreen does)
      navigation.navigate('Payment', {
        items: [paymentItem],
        totalAmount: totalAmount,
        fromCart: false, // Indicate this is from Buy Now, not cart
        selectedAddress: user?.addresses?.find(addr => addr.isDefault) || user?.addresses?.[0],
      });
    },
    onError: (error) => {
      // console.error('Failed to fetch cart after Buy Now:', error);
      showToast(t('product.failedToProceed'), 'error');
    },
  });

  // Direct purchase checkout (Buy Now) - POST /cart/checkout/direct-purchase, then navigate to Payment with response
  const resolveText = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const o = value as Record<string, unknown>;
      if ('en' in o || 'ko' in o || 'zh' in o) {
        const raw = o[locale] ?? o.en ?? o.ko ?? o.zh;
        if (raw != null && typeof raw !== 'object') return String(raw);
        return getLocalizedText(
          {
            en: String(o.en ?? ''),
            ko: String(o.ko ?? ''),
            zh: String(o.zh ?? ''),
          },
          locale,
        );
      }
    }
    return String(value);
  };

  const { mutate: checkoutDirectPurchase, isLoading: isAddingToCartForBuyNow } = useCheckoutDirectPurchaseMutation({
    onSuccess: (data) => {
      if (!data.selectedItems || data.selectedItems.length === 0) {
        // Backend dropped every item from the direct-purchase request —
        // typically because the product (or its SKU) was unlisted by
        // the seller between the user opening the page and tapping Buy
        // Now. Surface an "unavailable" toast and stay on the product
        // detail page; do NOT navigate to Payment or back to the seller
        // page on this error.
        showToast(t('product.outOfStock'), 'warning');
        return;
      }
      const lineLiveCode =
        getLiveCodeForCartPayload(routeSource, product, routeLiveCode, productId) ||
        resolveLiveCodeForOwnmallOrderLine(product) ||
        undefined;
      const selectedItems = !lineLiveCode
        ? data.selectedItems
        : (data.selectedItems || []).map((item: any) => ({
            ...item,
            liveCode: item.liveCode || lineLiveCode,
            ownmallProductType: item.ownmallProductType || 'live',
            productNo:
              item.productNo ||
              (String((product as any).productNo || '').trim() || undefined),
          }));
      const paymentItems = selectedItems.map((item: any) => ({
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
      const totalAmount = data.productTotalKRW ?? paymentItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
      navigation.navigate('Payment', {
        items: paymentItems,
        totalAmount,
        fromCart: false,
        estimatedShippingCost: data.estimatedShippingCost ?? 0,
        estimatedShippingCostBySeller: data.estimatedShippingCostBySeller ?? {},
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
        directPurchaseItems: selectedItems,
        selectedAddress: user?.addresses?.find(addr => addr.isDefault) || user?.addresses?.[0],
      });
    },
    onError: (error) => {
      showToast(error || t('product.failedToProceed'), 'error');
      autoBuyTriggeredRef.current = false;
    },
  });

  // Toggle wishlist function
  const toggleWishlist = async (product: any) => {
    if (!user || !isAuthenticated) {
      showToast(t('home.pleaseLogin'), 'warning');
      return;
    }

    // Get product external ID — live listings often have no catalog offerId;
    // fall back to live code / route id so the heart button does not falsely
    // show "invalid product id" on live PDPs.
    let externalId =
      (product as any).externalId?.toString() ||
      (product as any).offerId?.toString() ||
      '';

    if (!externalId && isLiveSource(routeSource)) {
      externalId =
        String((product as any).liveCode ?? '').trim() ||
        getLiveCodeForCartPayload(routeSource, product, routeLiveCode, productId) ||
        product.id?.toString() ||
        String(productId ?? offerId ?? '').trim() ||
        '';
    }

    if (!externalId) {
      showToast(t('product.invalidProductId'), 'error');
      return;
    }

    const isLiked = isProductLiked(product);
    const source = (product as any).source || sourceRef.current || selectedPlatform || '1688';
    const country = locale;

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

  // Handle follow/unfollow store
  const handleFollowStore = async () => {
    if (!user || !isAuthenticated) {
      showToast(t('home.pleaseLogin'), 'warning');
      // navigation.navigate()
      return;
    }

    if (isStoreFollowed) {
      // Show unfollow confirmation modal
      setShowUnfollowModal(true);
    } else {
      // Follow directly
      await performFollowAction();
    }
  };

  const performFollowAction = async () => {
    setIsFollowingStore(true);
    try {
      // Get company name from product metadata or seller
      const companyName = (product as any).metadata?.original1688Data?.companyName || 
                          product.seller?.name || 
                          'Store';
      
      // Get shop ID and name
      const shopId = product.seller?.id || (product as any).sellerOpenId || '';
      const shopName = companyName;
      
      // Get platform
      const platform = source === 'taobao' ? 'taobao' : '1688';
      
      // Get up to 2 products from the current product
      const products = [
        {
          offerId: product.offerId || product.id || '',
          title: product.name || product.subject || '',
          imageUrl: product.image || product.images?.[0] || '',
          price: product.price || 0,
        }
      ];
      
      const response = await productsApi.followStoreWithProducts(shopId, shopName, products, platform);

      if (response.success) {
        setIsStoreFollowed(true);
        showToast(t('live.storeFollowedSuccessfully'), 'success');
      } else {
        showToast(response.message || t('live.failedToFollowStore'), 'error');
      }

      if (shopId) {
        navigation.navigate('SellerProfile', {
          sellerId: shopId,
          sellerName: shopName,
          source: source,
          country: locale === 'zh' ? 'en' : locale,
        });
      }
    } catch (error) {
      showToast(t('live.failedToFollowStore'), 'error');
    } finally {
      setIsFollowingStore(false);
    }
  };

  const performUnfollowAction = async () => {
    setIsFollowingStore(true);
    try {
      const shopId = product.seller?.id || (product as any).sellerOpenId || '';
      const platform = source === 'taobao' ? 'taobao' : '1688';
      
      const response = await productsApi.toggleFollowStore(shopId, platform, 'unfollow');
      
      if (response.success) {
        setIsStoreFollowed(false);
        showToast(t('live.storeUnfollowedSuccessfully'), 'success');
      } else {
        showToast(response.message || t('live.failedToUnfollowStore'), 'error');
      }
    } catch (error) {
      showToast(t('live.failedToUnfollowStore'), 'error');
    } finally {
      setIsFollowingStore(false);
      setShowUnfollowModal(false);
    }
  };
  
  // Additional state declarations - MUST be before any hooks that use them
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showFullSpecifications, setShowFullSpecifications] = useState(false);
  const [currentStatIndex, setCurrentStatIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isPartNumberCopied, setIsPartNumberCopied] = useState(false);
  const [photoCaptureVisible, setPhotoCaptureVisible] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedProductsPage, setRelatedProductsPage] = useState(1);
  const [relatedProductsHasMore, setRelatedProductsHasMore] = useState(true);
  // Tracks the page number used for the in-flight related-products fetch so
  // onSuccess knows whether to replace (page 1) or append (page > 1).
  const relatedProductsPageRef = useRef<number>(1);
  const isLoadingMoreRelatedRef = useRef(false);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [similarProductsPage, setSimilarProductsPage] = useState(1);
  const [similarProductsHasMore, setSimilarProductsHasMore] = useState(true);
  const [similarProductsLoadingMore, setSimilarProductsLoadingMore] = useState(false);
  const isFetchingSimilarProductsRef = useRef(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const [isStoreFollowed, setIsStoreFollowed] = useState(false);
  const [isFollowingStore, setIsFollowingStore] = useState(false);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);

  // Use source from route params if available, otherwise use selectedPlatform
  // Memoize to prevent infinite loops - only depend on route params, not store values
  const source = useMemo(() => {
    const raw = routeSource || selectedPlatform || '1688';
    // Normalize ownmall-family sources
    if (raw === 'live-commerce' || raw === 'companymall' || raw === 'myCompany' || raw?.toLowerCase() === 'mycompany') return 'ownmall';
    return raw;
  }, [routeSource, selectedPlatform]);
  const country = useMemo(() => routeCountry || locale, [routeCountry, locale]);
  // i18n rollout changed several list mappers to populate `id` with values
  // that aren't always the 1688 offerId. Always prefer explicit `offerId`
  // when opening detail; fall back to route `productId`.
  const resolvedRouteProductId = useMemo(
    () => offerId?.toString?.() || productId?.toString?.() || '',
    [offerId, productId],
  );
  
  // Live stats data - defined before useEffect that uses it
  const liveStats = [
    { icon: 'star', color: '#FFD700', text: '155+ people gave 5-star reviews' },
    { icon: 'cart-outline', color: COLORS.primary, text: '900+ people bought this item' },
    { icon: 'heart-outline', color: COLORS.red, text: '3,000+ people added to cart' },
  ];
  
  // Search products mutation (for Taobao related products) - MUST be before useEffect hooks
  const { mutate: searchProducts } = useSearchProductsMutation({
    onSuccess: (data) => {
      if (!data || !data.products || !Array.isArray(data.products)) {
        setRelatedProducts([]);
        setRelatedProductsHasMore(false);
        return;
      }

      // Map search results to Product format
      const mappedProducts: Product[] = data.products.map((item: any) => {
        return {
          id: item.id?.toString() || item.externalId?.toString() || '',
          externalId: item.externalId?.toString() || item.id?.toString() || '',
          offerId: item.offerId?.toString() || item.externalId?.toString() || item.id?.toString() || '',
          name: item.name || item.title || '',
          description: item.description || '',
          images: item.images || (item.image ? [item.image] : []),
          image: item.image || item.images?.[0] || '',
          price: item.price || 0,
          originalPrice: item.originalPrice || item.price || 0,
          category: item.category || { id: '', name: '', icon: '', image: '', subcategories: [] },
          subcategory: item.subcategory || { id: '', name: '', icon: '', image: '', subcategories: [] },
          brand: item.brand || '',
          seller: item.seller || { id: '', name: '', avatar: '', rating: 0, reviewCount: 0, isVerified: false, followersCount: 0, description: '', location: '', joinedDate: new Date().toISOString() },
          rating: item.rating || 0,
          reviewCount: item.reviewCount || 0,
          rating_count: item.rating_count || 0,
          inStock: item.inStock !== undefined ? item.inStock : true,
          stockCount: item.stockCount || 0,
          tags: item.tags || [],
          isNew: item.isNew || false,
          isFeatured: item.isFeatured || false,
          isOnSale: item.isOnSale || false,
          createdAt: typeof item.createdAt === 'string'
            ? item.createdAt
            : (item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date().toISOString()),
          updatedAt: typeof item.updatedAt === 'string'
            ? item.updatedAt
            : (item.updatedAt instanceof Date ? item.updatedAt.toISOString() : new Date().toISOString()),
          orderCount: item.orderCount || 0,
          repurchaseRate: item.repurchaseRate || '',
          source: item.source || 'taobao',
        } as Product;
      });

      setRelatedProducts(mappedProducts);
      setRelatedProductsHasMore(
        data.pagination?.pageNo < Math.ceil((data.pagination?.totalRecords || 0) / (data.pagination?.pageSize || 20))
      );
    },
    onError: (error) => {
      // console.error('Failed to search related products:', error);
      setRelatedProducts([]);
      setRelatedProductsHasMore(false);
    },
  });

  // Related recommendations mutation (for non-Taobao products)
  const { mutate: fetchRelatedRecommendations, isLoading: relatedRecommendationsLoading } = useRelatedRecommendationsMutation({
    onSuccess: (data) => {
      if (!data || !data.recommendations) {
        return;
      }

      let mappedProducts: Product[] = [];

      // Non-Taobao related recommendations mapping (1688 and other platforms)
      mappedProducts = data.recommendations.map((rec: any) => ({
          id: rec.offerId?.toString() || '',
          externalId: rec.offerId?.toString() || '',
          offerId: rec.offerId?.toString() || '',
          name: country === 'zh' ? (rec.subject || rec.subjectTrans || '') : (rec.subjectTrans || rec.subject || ''),
          description: '',
          price: parseFloat(rec.priceInfo?.price || 0),
          originalPrice: parseFloat(rec.priceInfo?.price || 0),
          image: rec.imageUrl || '',
          images: rec.imageUrl ? [rec.imageUrl] : [],
          category: {
            id: rec.topCategoryId?.toString() || '',
            name: '',
            icon: '',
            image: '',
            subcategories: [],
          },
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
            joinedDate: new Date().toISOString(),
          },
          rating: 0,
          reviewCount: 0,
          rating_count: 0,
          inStock: true,
          stockCount: 0,
          tags: [],
          isNew: false,
          isFeatured: false,
          isOnSale: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orderCount: 0,
          repurchaseRate: '',
          mainVideo: '',
          rawVariants: [],
          attributes: [],
          productSkuInfos: [],
          productSaleInfo: {},
          productShippingInfo: {},
          sellerDataInfo: {},
          minOrderQuantity: 1,
          unitInfo: {},
          categoryId: rec.topCategoryId,
          subject: rec.subject || '',
          subjectTrans: rec.subjectTrans || rec.subject || '',
          promotionUrl: '',
        }));

      const currentPage = relatedProductsPageRef.current;
      // First page replaces; subsequent pages append (with dedup so the
      // FlatList doesn't crash on duplicate keys).
      const productKey = (p: any): string =>
        (p?.offerId?.toString?.()) || (p?.externalId?.toString?.()) || (p?.id?.toString?.()) || '';
      if (currentPage === 1) {
        setRelatedProducts(mappedProducts);
      } else {
        setRelatedProducts(prev => {
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

      const hasMore = data.pagination?.pageNo <
        Math.ceil((data.pagination?.totalRecords || 0) / (data.pagination?.pageSize || 10));
      setRelatedProductsHasMore(hasMore);
      isLoadingMoreRelatedRef.current = false;

      // Pre-warm page N+1 in the background so the next "load more" hits
      // cache instead of waiting on the network.
      if (hasMore) {
        const fetchSource = sourceRef.current;
        const language = locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';
        const currentProductId = (productId || offerId)?.toString() || '';
        if (currentProductId) {
          warmRelatedPage({
            productId: currentProductId,
            pageNo: currentPage + 1,
            pageSize: 10,
            language,
            source: fetchSource,
          });
        }
      }
    },
    onError: (error) => {
      // showToast(error || t('product.failedToLoadRelatedProducts'), 'error');
    },
  });

  // Product detail mutation - MUST be called before any useEffect hooks
  const { mutate: fetchProductDetail } = useProductDetailMutation({
    onSuccess: (data, ctx) => {
      // console.log('📦 [ProductDetailScreen] Product detail fetched successfully:', {
      //   hasData: !!data,
      //   dataKeys: data ? Object.keys(data) : [],
      //   source,
      // });
      if (__DEV__) {
        const d = data as Record<string, unknown> | null;
        console.log('[PDP] detail ok', {
          keys: d && typeof d === 'object' ? Object.keys(d).slice(0, 20) : [],
          offerId: (d as any)?.offerId,
        });
      }
      // Taobao product detail mapping (branch on the source used for this request, not render-time `source`)
      if (ctx.source === 'taobao' && data) {
        const taobao = data;

        // Images from pic_urls
        const images: string[] = Array.isArray(taobao.pic_urls) ? taobao.pic_urls : [];

        // Build map from sku_id to localized properties if multi_language_info.sku_properties exists
        const localizedSkuPropsMap: Record<string, any[]> = {};
        if (taobao.multi_language_info?.sku_properties && Array.isArray(taobao.multi_language_info.sku_properties)) {
          taobao.multi_language_info.sku_properties.forEach((skuProp: any) => {
            if (skuProp && skuProp.sku_id) {
              localizedSkuPropsMap[skuProp.sku_id.toString()] = skuProp.properties || [];
            }
          });
        }

        // Map SKUs to variants
        const rawVariants = (taobao.sku_list || []).map((sku: any) => {
          const skuId = sku.sku_id?.toString() || '';
          const localizedProps = localizedSkuPropsMap[skuId] || sku.properties || [];

          const name = Array.isArray(localizedProps)
            ? localizedProps
                .map((p: any) => `${p.prop_name || p.propId}: ${p.value_name || p.value_desc || p.valueId}`)
                .join(' / ')
            : '';

          const priceNum = Number(sku.promotion_price ?? sku.price ?? taobao.promotion_price ?? taobao.price ?? 0);
          const price = isNaN(priceNum) ? 0 : priceNum;

          return {
            id: skuId,
            name,
            price,
            stock: sku.quantity || 0,
            image: sku.pic_url || images[0] || '',
            attributes: localizedProps,
            specId: sku.spec_id || skuId,
            skuId,
          };
        });

        // Map attributes (properties) to simple name/value pairs
        const attributes = (taobao.multi_language_info?.properties || taobao.properties || []).map((attr: any) => ({
          name: attr.prop_name || '',
          value: attr.value_name || '',
        }));

        const priceNum = Number(taobao.promotion_price ?? taobao.price ?? 0);
        const price = isNaN(priceNum) ? 0 : priceNum;

        const mappedProduct = {
          id: taobao.item_id?.toString() || productId?.toString() || '',
          externalId: taobao.item_id?.toString() || '',
          offerId: taobao.item_id?.toString() || '',
          name: taobao.multi_language_info?.title || taobao.title || '',
          description: taobao.description || '',
          images,
          image: images[0] || '',
          price,
          originalPrice: price,
          category: {
            id: taobao.category_id?.toString() || '',
            name: taobao.category_name || '',
            icon: '',
            image: '',
            subcategories: [],
          },
          brand: '',
          seller: {
            id: taobao.shop_id?.toString() || '',
            name: taobao.shop_name || '',
            avatar: '',
            rating: 0,
            reviewCount: 0,
            isVerified: false,
            followersCount: 0,
            description: '',
            location: '',
            joinedDate: new Date().toISOString(),
          },
          rating: 0,
          reviewCount: 0,
          rating_count: 0,
          inStock: true,
          stockCount: (taobao.sku_list || []).reduce(
            (sum: number, sku: any) => sum + (sku.quantity || 0),
            0
          ),
          tags: taobao.tags || [],
          isNew: false,
          isFeatured: false,
          isOnSale: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orderCount: 0,
          repurchaseRate: '',
          // Additional fields to align with 1688 mapping
          mainVideo: '',
          rawVariants,
          attributes,
          productSkuInfos: taobao.sku_list || [],
          productSaleInfo: {},
          productShippingInfo: {},
          sellerDataInfo: {},
          minOrderQuantity: 1,
          unitInfo: {},
          categoryId: taobao.category_id,
          subject: taobao.title || '',
          subjectTrans: taobao.multi_language_info?.title || taobao.title || '',
          promotionUrl: '',
        };

        setProduct(mappedProduct);
        setDetailFetched(true);

        const currentProductId = resolvedRouteProductId;
        if (currentProductId) {
          hasFetchedProductRef.current = currentProductId;
        }
        return;
      }

      // 1688 / default product detail mapping
      if (data && data.product) {
        // Map API response to product format
        const apiProduct = data.product;
        const totalSkuStock = (apiProduct.productSkuInfos || []).reduce(
          (sum: number, sku: any) =>
            sum + (typeof sku?.amountOnSale === 'number' ? sku.amountOnSale : parseInt(String(sku?.amountOnSale || 0), 10) || 0),
          0,
        );
        
        // Extract images from productImage.images
        const images = apiProduct.productImage?.images || [];
        
        // Map SKUs to variants
        const rawVariants = (apiProduct.productSkuInfos || []).map((sku: any) => ({
          id: sku.skuId?.toString() || '',
          name: sku.skuAttributes?.map((attr: any) => 
            `${attr.attributeNameTrans || attr.attributeName}: ${attr.valueTrans || attr.value}`
          ).join(' / ') || '',
          price: parseFloat(sku.price || sku.consignPrice || 0),
          stock: sku.amountOnSale || 0,
          image: sku.skuAttributes?.[0]?.skuImageUrl || images[0] || '',
          attributes: sku.skuAttributes || [],
          specId: sku.specId || '',
          skuId: sku.skuId?.toString() || '',
        }));
        
        // Map product attributes
        const attributes = (apiProduct.productAttribute || []).map((attr: any) => ({
          name: attr.attributeNameTrans || attr.attributeName,
          value: attr.valueTrans || attr.value,
        }));
        
        // Map product data
        const mappedProduct = {
          id: apiProduct.offerId?.toString() || productId?.toString() || '',
          offerId: apiProduct.offerId?.toString() || '',
          name: resolveText(locale === 'zh' ? (apiProduct.subject || apiProduct.subjectTrans || '') : (apiProduct.subjectTrans || apiProduct.subject || '')),
          description: typeof apiProduct.description === 'string' ? apiProduct.description : '',
          images: images,
          image: images[0] || '',
          price: parseFloat(apiProduct.productSaleInfo?.priceRangeList?.[0]?.price || apiProduct.productSkuInfos?.[0]?.price || 0),
          originalPrice: parseFloat(apiProduct.productSaleInfo?.priceRangeList?.[0]?.price || apiProduct.productSkuInfos?.[0]?.price || 0),
          category: {
            id: apiProduct.categoryId?.toString() || '',
            name: '',
            icon: '',
            image: '',
            subcategories: [],
          },
          brand: '',
          seller: {
            id: apiProduct.sellerOpenId || '',
            name: resolveText(apiProduct.companyName) || '',
            avatar: '',
            rating: parseFloat(apiProduct.sellerDataInfo?.compositeServiceScore || apiProduct.tradeScore || 0),
            reviewCount: 0,
            isVerified: false,
            followersCount: 0,
            description: '',
            location: apiProduct.productShippingInfo?.sendGoodsAddressText || '',
            joinedDate: new Date().toISOString(),
          },
          rating: parseFloat(apiProduct.tradeScore || 0),
          reviewCount: parseInt(apiProduct.soldOut || '0', 10),
          rating_count: parseInt(apiProduct.soldOut || '0', 10),
          // Stock in ownmall/live detail is per SKU (`amountOnSale`), so
          // total stock should be the sum across all SKUs, not productSaleInfo.
          inStock: totalSkuStock > 0,
          stockCount: totalSkuStock,
          tags: [],
          isNew: false,
          isFeatured: false,
          isOnSale: false,
          createdAt: apiProduct.createDate
            ? new Date(apiProduct.createDate).toISOString()
            : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orderCount: parseInt(apiProduct.soldOut || '0', 10),
          repurchaseRate: apiProduct.sellerDataInfo?.repeatPurchasePercent || '',
          // Additional fields from API
          mainVideo: apiProduct.mainVideo || '',
          rawVariants: rawVariants,
          attributes: attributes,
          productSkuInfos: apiProduct.productSkuInfos || [],
          productSaleInfo: apiProduct.productSaleInfo || {},
          productShippingInfo: apiProduct.productShippingInfo || {},
          sellerDataInfo: apiProduct.sellerDataInfo || {},
          minOrderQuantity: apiProduct.minOrderQuantity || 1,
          unitInfo: apiProduct.productSaleInfo?.unitInfo || {},
          // Live-product part number (e.g. "611385"). Only present on
          // live-commerce items; we surface it on the product object so
          // the part-number row in renderProductInfo can render it.
          productNo: apiProduct.productNo || '',
          // Additional fields for cart API
          categoryId: apiProduct.categoryId,
          subject: apiProduct.subject || '',
          subjectTrans: apiProduct.subjectTrans || apiProduct.subject || '',
          promotionUrl: apiProduct.promotionUrl || '',
          productCode: String(
            apiProduct.productCode ?? apiProduct.offerId ?? apiProduct.productId ?? '',
          ).trim(),
          liveCode: (() => {
            if (!isLiveSource(routeSource)) return '';
            const fromApi =
              pickExplicitLiveCodeFromTree(apiProduct) ??
              extractLiveCode(apiProduct.subject, apiProduct.subjectTrans) ??
              '';
            const s1 = sanitizeLiveCodeForApi(fromApi);
            if (s1) return s1;
            const navLc =
              routeLiveCode != null && String(routeLiveCode).trim() !== ''
                ? String(routeLiveCode).trim()
                : '';
            const s2 = sanitizeLiveCodeForApi(navLc);
            if (s2) return s2;
            const pid = String(productId ?? '').trim();
            if (pid && /^\d{3,12}$/.test(pid) && !/^[a-f\d]{24}$/i.test(pid)) {
              const s3 = sanitizeLiveCodeForApi(pid);
              if (s3) return s3;
            }
            return '';
          })(),
          // Live-commerce internal seller id. The live channel's
          // /live-commerce/sellers/:sellerId endpoint keys off this Mongo
          // _id rather than the 1688 sellerOpenId.
          // Own-mall API may tag broadcast SKUs; used when enriching checkout rows for /orders.
          ownmallProductType:
            String(apiProduct.ownmallProductType ?? apiProduct.ownmall_product_type ?? '').trim() ||
            undefined,
          ownerSellerId: apiProduct.ownerSellerId || '',
        };

        setProduct(mappedProduct);
        setDetailFetched(true);
        // Mark this productId as fetched
        const currentProductId = resolvedRouteProductId;
        if (currentProductId) {
          hasFetchedProductRef.current = currentProductId;
        }
      }
    },
    onError: (error, _ctx) => {
      const errorStr = typeof error === 'string' ? error : (error as any)?.message || String(error);
      // console.error('📦 [ProductDetailScreen] Product detail fetch error:', {
      //   error,
      //   errorType: typeof error,
      //   errorMessage: errorStr,
      //   productId,
      //   offerId,
      //   source,
      //   country,
      // });
      setDetailFetched(true);
      // Reset ref on error so we can retry
      hasFetchedProductRef.current = null;
      
      // Check if it's a 404 or "not found" error
      const errorMessage = errorStr.toLowerCase();
      const isNotFound = 
        errorMessage.includes('404') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('no product') ||
        errorMessage.includes('product not found');
      
      if (isNotFound) {
        // Navigate to 404 page after a short delay
        setTimeout(() => {
          navigation.navigate('NotFound', {
            message: t('notFound.productNotFound') || 'The product you are looking for could not be found.',
            title: t('notFound.productTitle') || 'Product Not Found',
          });
        }, 500);
      } else if (
        !errorMessage.includes('numeric') &&
        !errorMessage.includes('offerid') &&
        !product
      ) {
        // Only surface the error toast when we have nothing to show. If
        // the screen is already rendering with initialProductData, the
        // background refresh failure is silent — the user still sees the
        // product card payload.
        showToast(error || t('home.productDetailsError'), 'error');
      }
    },
  });

  // Update quantity when product is loaded/updated with minOrderQuantity
  useEffect(() => {
    if (product?.minOrderQuantity && product.minOrderQuantity > 0) {
      setQuantity(product.minOrderQuantity);
    }
  }, [product?.minOrderQuantity]);

  // Defer heavy below-fold subtree until transitions + first layout settle (reduces Davey on open).
  useEffect(() => {
    setBelowFoldReady(false);
    if (!detailFetched || !product?.id) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setBelowFoldReady(true);
    });
    return () => task.cancel?.();
  }, [detailFetched, product?.id]);

  // Reset visible product + fetch guards when navigating to another PDP identity
  // (same screen instance). Avoids showing product A while product B's request is in flight.
  useEffect(() => {
    const currentProductId = resolvedRouteProductId;
    if (!currentProductId) return;
    const identityKey = `${offerId ?? ''}|${productId ?? ''}|${source}`;
    if (routeProductIdentityRef.current === identityKey) return;
    routeProductIdentityRef.current = identityKey;
    setProduct(initialProductData || null);
    setDetailFetched(false);
    setBelowFoldReady(false);
    hasFetchedProductRef.current = null;
    relatedFetchedForRef.current = null;
    setRelatedProducts([]);
    setRelatedProductsPage(1);
    setRelatedProductsHasMore(true);
    setLiveSellerInfo(null);
    setSelectedColor(null);
    setSelectedSize(null);
    setSelectedVariations({});
    setSelectedImageIndex(0);
    setExtraVariationImage(null);
  }, [resolvedRouteProductId, offerId, productId, source]);

  // Always fetch the full product detail in the background. If we already
  // have initialProductData (from the previous-page card payload), the screen
  // is already painting that data — the fetch just upgrades it with the rest
  // of the fields when the network resolves. If we don't, the empty
  // background covers the brief wait until detail arrives.
  useEffect(() => {
    const currentProductId = resolvedRouteProductId;
    if (!currentProductId) return;

    // Don't refetch the same productId twice (e.g. from re-render churn).
    if (hasFetchedProductRef.current === currentProductId) return;

    const fetchSource = sourceRef.current;
    const fetchCountry = countryRef.current;
    fetchProductDetail(currentProductId, fetchSource, fetchCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRouteProductId, initialProductData, routeSource, routeCountry]);
  
  // Fetch wishlist count when product is loaded
  useEffect(() => {
    const fetchWishlistCount = async () => {
      if (!product) return;
      
      const externalId = product?.offerId || product?.externalId || product?.id || productId || offerId || '';
      const fetchSource = sourceRef.current;
      
      if (!externalId || !fetchSource) return;
      
      try {
        const response = await productsApi.getWishlistCount(externalId.toString(), fetchSource);
        if (response.success && response.data) {
          setWishlistCount(response.data.count || 0);
        } else {
          setWishlistCount(0);
        }
      } catch (error) {
        // console.error('Failed to fetch wishlist count:', error);
        setWishlistCount(0);
      }
    };
    
    fetchWishlistCount();
  }, [product, productId, offerId, routeSource]);

  // Fetch related products only AFTER the product-detail API has settled.
  // Track per-productId so this fires exactly once per detail page even if
  // `product` mutates (initial card payload → full detail upgrade) or other
  // deps change. The previous implementation used InteractionManager whose
  // cancel cleanup ran on every product mutation, which prevented the
  // related-products fetch from ever firing in some cases.
  const relatedFetchedForRef = useRef<string | null>(null);
  // For live-commerce products, the "Recommended Products" section shows
  // OTHER products from the same live-commerce seller via the live channel
  // endpoint (/live-commerce/sellers/:sellerId), keyed by the live channel's
  // internal `ownerSellerId` (Mongo _id) — the 1688 `sellerOpenId` is empty
  // for ownmall products. The mapped output matches the Product shape that
  // the related-recommendations onSuccess produces so the rest of the
  // rendering / pagination code is unchanged.
  const fetchSellerOffersAsRelated = useCallback(async (page: number) => {
    const currentProductId = (productId || offerId)?.toString() || '';
    const liveSellerId = (product as any)?.ownerSellerId || '';
    if (!liveSellerId) {
      setRelatedProductsHasMore(false);
      isLoadingMoreRelatedRef.current = false;
      return;
    }

    try {
      const response = await productsApi.getLiveCommerceSellerDetail(liveSellerId, {
        page,
        pageSize: 10,
      });
      if (!response.success || !response.data) {
        setRelatedProductsHasMore(false);
        isLoadingMoreRelatedRef.current = false;
        return;
      }

      // Capture the seller's profile (avatar, name, etc.) so the seller
      // mini-card under the product title can render a real picture
      // instead of the placeholder.
      if (response.data.liveSeller) {
        setLiveSellerInfo(response.data.liveSeller);
      }

      const items = response.data.items || [];
      const mapped: Product[] = items.map((item: any) => {
        const id = item.productId || item.product?.id || item.id || '';
        const itemTitle =
          item.product?.titleKo || item.product?.titleEn || item.product?.titleZh ||
          item.liveTitle || '';
        return {
          id: String(id),
          externalId: String(id),
          offerId: String(id),
          name: itemTitle,
          description: '',
          price: parseFloat(String(item.product?.price ?? 0)),
          originalPrice: parseFloat(String(item.product?.price ?? item.product?.promotionPrice ?? 0)),
          image: item.product?.imageUrl || item.imageUrl || item.mediaUrl || '',
          images: [item.product?.imageUrl || item.imageUrl || item.mediaUrl || ''].filter(Boolean),
          category: { id: '', name: '', icon: '', image: '', subcategories: [] },
          subcategory: '',
          brand: '',
          seller: {
            id: liveSellerId,
            name: '',
            avatar: '',
            rating: 0,
            reviewCount: 0,
            isVerified: false,
            followersCount: 0,
            description: '',
            location: '',
            joinedDate: new Date().toISOString(),
          },
          rating: item.reviewScore || 0,
          reviewCount: item.reviewNumbers || 0,
          rating_count: item.reviewNumbers || 0,
          inStock: true,
          stockCount: typeof item.stockCount === 'number' ? item.stockCount : 0,
          tags: [],
          isNew: false,
          isFeatured: false,
          isOnSale: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orderCount: item.itemsSold || 0,
          repurchaseRate: '',
          mainVideo: '',
          rawVariants: [],
          attributes: [],
          productSkuInfos: [],
          productSaleInfo: {},
          productShippingInfo: {},
          sellerDataInfo: {},
          minOrderQuantity: 1,
          unitInfo: {},
          subject: itemTitle,
          subjectTrans: itemTitle,
          promotionUrl: '',
          source: 'live-commerce',
          liveCode:
            item.liveCode ||
            item.live_code ||
            item.liveCommerceCode ||
            item.product?.liveCode ||
            undefined,
        } as any;
      })
      // Drop the product the user is currently viewing.
      .filter((p: any) => p.externalId && p.externalId !== currentProductId);

      const productKey = (p: any): string =>
        (p?.offerId?.toString?.()) || (p?.externalId?.toString?.()) || (p?.id?.toString?.()) || '';

      if (page === 1) {
        setRelatedProducts(mapped);
      } else {
        setRelatedProducts(prev => {
          const seen = new Set(prev.map(productKey).filter(Boolean));
          const fresh = mapped.filter((p: any) => {
            const k = productKey(p);
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          return [...prev, ...fresh];
        });
      }

      const pagination = response.data.pagination;
      const totalPages = pagination
        ? Math.ceil((pagination.total || 0) / (pagination.pageSize || 10))
        : 0;
      const hasMore = !!pagination && (pagination.page || 1) < totalPages;
      setRelatedProductsHasMore(hasMore);
      isLoadingMoreRelatedRef.current = false;
    } catch {
      setRelatedProductsHasMore(false);
      isLoadingMoreRelatedRef.current = false;
    }
  }, [product, productId, offerId]);

  useEffect(() => {
    const currentProductId = (productId || offerId)?.toString();
    if (!currentProductId || !product || !detailFetched) return;

    const language = locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';
    const fetchSource = sourceRef.current;
    const isLive = routeSource === 'live-commerce' || routeSource === 'live';

    // For live, the dedup key includes ownerSellerId so the effect re-fires
    // once seller info populates (initial productData payload may arrive
    // without it).
    const liveSellerIdNow = (product as any)?.ownerSellerId || '';
    const dedupKey = isLive
      ? `${currentProductId}|${liveSellerIdNow}`
      : currentProductId;
    if (relatedFetchedForRef.current === dedupKey) return;
    if (isLive && !liveSellerIdNow) return; // Wait for seller info to land.
    relatedFetchedForRef.current = dedupKey;

    // Reset pagination state for the new product.
    setRelatedProductsPage(1);
    setRelatedProductsHasMore(true);
    setRelatedProducts([]);
    relatedProductsPageRef.current = 1;
    isLoadingMoreRelatedRef.current = false;

    if (isLive) {
      fetchSellerOffersAsRelated(1);
    } else if (fetchSource === 'taobao') {
      const searchKeyword = product.category?.name || '';
      if (searchKeyword) {
        searchProducts(searchKeyword, fetchSource, language, 1, 20, undefined, undefined, undefined, undefined, false);
      }
    } else {
      fetchRelatedRecommendations(currentProductId, 1, 10, language, fetchSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, offerId, locale, product, detailFetched, routeSource]);

  // Load page N+1 when relatedProductsPage advances. Driven by the parent
  // ScrollView's onScroll handler (see Animated.ScrollView below).
  useEffect(() => {
    if (relatedProductsPage <= 1) return;
    if (!relatedProductsHasMore) return;
    const fetchSource = sourceRef.current;
    const isLive = routeSource === 'live-commerce' || routeSource === 'live';
    if (!isLive && fetchSource === 'taobao') return; // Taobao path uses a different feed.
    const currentProductId = (productId || offerId)?.toString();
    if (!currentProductId) return;
    const language = locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';
    relatedProductsPageRef.current = relatedProductsPage;
    isLoadingMoreRelatedRef.current = true;
    if (isLive) {
      fetchSellerOffersAsRelated(relatedProductsPage);
    } else {
      fetchRelatedRecommendations(currentProductId, relatedProductsPage, 10, language, fetchSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedProductsPage, relatedProductsHasMore]);
  
  // Load more similar products - MUST be before early return
  const loadMoreSimilarProducts = useCallback(() => {
    // Function removed - API integration removed
  }, []);

  // Extract image URLs from HTML description - MUST be before early return
  const extractImagesFromHtml = useCallback((html: string): string[] => {
    if (!html) return [];
    
    // Match all img tags with src attribute
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images: string[] = [];
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[1]) {
        images.push(match[1]);
    }
    }
    
    return images;
  }, []);

  const descriptionHtmlDerived = useMemo(() => {
    const html = product?.description;
    if (!html) return { images: [] as string[], plain: '' };
    return {
      images: extractImagesFromHtml(html),
      plain: stripHtmlDescriptionToPlain(html),
    };
  }, [product?.description, extractImagesFromHtml]);

  // Get product images from API only (not from HTML description)
  const getApiProductImages = useCallback((currentProduct: any): string[] => {
    if (!currentProduct) {
      // Even before product is set, the previous-page thumbnail can render
      // immediately if it was passed via navigation params.
      const seedImage = initialProductData?.image || '';
      return seedImage ? [seedImage] : [];
    }

    // Promote the card-thumbnail to the front of the gallery list. The
    // previous screen has already downloaded that URL, so React Native's
    // image cache returns it instantly — the user sees a real image on the
    // first frame instead of a blank box while the rest of the gallery
    // streams in. Once the detail API arrives, the thumbnail stays at index
    // 0 and the high-res images fill in behind it.
    const apiImages: string[] = Array.isArray((currentProduct as any).images)
      ? (currentProduct as any).images.filter(Boolean)
      : [];
    const cardImage: string = initialProductData?.image || currentProduct.image || '';

    if (apiImages.length === 0) {
      return cardImage ? [cardImage] : [];
    }
    if (cardImage && !apiImages.includes(cardImage)) {
      return [cardImage, ...apiImages];
    }
    return apiImages;
  }, [initialProductData]);

  // Parse variation types from variant names
  // Example: "Color: Cat print thickened modal-grey / Specifications: 20*25cm"
  // IMPORTANT: This must be defined before early return to avoid hooks order issues
  const getVariationTypes = useCallback(() => {
    if (!product) return [];
    
    const variationTypesMap = new Map<string, Map<string, { value: string; image?: string; [key: string]: any }>>();
    
    // Get source to determine filtering logic
    const currentSource = (product as any).source || routeSource || selectedPlatform || '1688';
    
    // Check if we have raw variants data (from product detail API)
    const rawVariants = (product as any).rawVariants || [];
    const productSkuInfos = (product as any).productSkuInfos || [];
    
    if (rawVariants.length > 0) {
      // Parse each variant name to extract variation types
      rawVariants.forEach((variant: any) => {
        // Filter out variations based on source
        if (currentSource === '1688') {
          // For 1688, filter out if amountOnSale is 0
          // Check in variant first, then try to find in productSkuInfos
          let amountOnSale = variant.amountOnSale;
          if (amountOnSale === undefined && variant.skuId) {
            const matchingSku = productSkuInfos.find((sku: any) => 
              sku.skuId?.toString() === variant.skuId?.toString() || 
              sku.specId?.toString() === variant.specId?.toString()
            );
            amountOnSale = matchingSku?.amountOnSale;
          }
          if (amountOnSale === 0) {
            return; // Skip this variant
          }
        } else if (currentSource === 'taobao') {
          // For Taobao, filter out if quantity is 0
          const quantity = variant.quantity || variant.stock || 0;
          if (quantity === 0) {
            return; // Skip this variant
          }
        }
        
        const variantName = variant.name || '';
        
        if (!variantName) return;
        
        // Split by "/" to get each variation type
        const parts = variantName.split('/').map((p: string) => p.trim());
        
        parts.forEach((part: string) => {
          // Extract type name (before ":") and value (after ":")
          const colonIndex = part.indexOf(':');
          if (colonIndex === -1) return;
          
          const typeName = part.substring(0, colonIndex).trim();
          const value = part.substring(colonIndex + 1).trim();
          
          if (!typeName || !value) return;

          const groupKey = canonicalVariationTypeKey(typeName);

          // Initialize map for this variation type if it doesn't exist
          if (!variationTypesMap.has(groupKey)) {
            variationTypesMap.set(groupKey, new Map());
          }

          const optionsMap = variationTypesMap.get(groupKey)!;
          
          // Only add if value doesn't exist (remove duplicates)
          if (!optionsMap.has(value)) {
            optionsMap.set(value, {
              value: value,
              image: variant.image || undefined,
              ...variant,
            });
          }
        });
      });
    }
    
    // Convert map to array format
    const variationTypes: Array<{ name: string; options: Array<{ value: string; image?: string; [key: string]: any }> }> = [];
    
    variationTypesMap.forEach((optionsMap, groupKey) => {
      // Options are already filtered at the variant level above
      // Just convert to array and add to variationTypes
      const options = Array.from(optionsMap.values());

      if (options.length > 0) {
        variationTypes.push({
          name: groupKey,
          options: options,
        });
      }
    });
    
    return variationTypes;
  }, [product, routeSource, selectedPlatform, selectedVariations]);

  // Stock status for the currently selected option tab (SKU).
  // - `stockCount`: sum of all amountOnSale when no complete selection yet.
  // - once all variation tabs are selected, it resolves the matching SKU and
  //   reports that SKU's amountOnSale so "Out of Stock" follows the tab.
  const selectedStockInfo = useMemo(() => {
    const parseStock = (value: any): number => {
      if (typeof value === 'number' && !isNaN(value)) return value;
      if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return isNaN(n) ? 0 : n;
      }
      return 0;
    };

    const skuInfos = ((product as any)?.productSkuInfos || []) as any[];
    const totalStockFromSkus = skuInfos.reduce(
      (sum: number, sku: any) => sum + parseStock(sku?.amountOnSale),
      0,
    );
    const fallbackStockCount = (product as any)?.stockCount ?? totalStockFromSkus;
    const baseStockCount =
      skuInfos.length > 0 ? totalStockFromSkus : parseStock(fallbackStockCount);
    const baseInStock =
      (product as any)?.inStock ?? baseStockCount > 0;

    const variationTypes = getVariationTypes();
    if (variationTypes.length === 0 || !product) {
      return { stockCount: baseStockCount, inStock: baseInStock };
    }

    const hasAllSelections = variationTypes.every((variationType) => {
      const variationName = variationType.name.toLowerCase();
      const selectedValue =
        selectedVariations[variationName] ||
        (variationName === 'color' ? selectedColor : null) ||
        (variationName === 'size' ? selectedSize : null);
      return !!selectedValue;
    });

    if (!hasAllSelections) {
      return { stockCount: baseStockCount, inStock: baseInStock };
    }

    const rawVariants = ((product as any)?.rawVariants || []) as any[];
    let selectedVariant: any = null;
    if (rawVariants.length > 0) {
      const selectionMap: Record<string, string> = {};
      variationTypes.forEach((variationType) => {
        const typeName = variationType.name.toLowerCase();
        const selectedValue =
          selectedVariations[typeName] ||
          (typeName === 'color' ? selectedColor : null) ||
          (typeName === 'size' ? selectedSize : null);
        if (selectedValue) selectionMap[typeName] = String(selectedValue);
      });
      selectedVariant = rawVariants.find((variant: any) => {
        const variantName = variant.name || '';
        if (!variantName) return false;
        return rawVariantNameMatchesSelections(variantName, selectionMap);
      });
    }

    let selectedSku: any = null;
    if (selectedVariant) {
      selectedSku = skuInfos.find(
        (sku: any) =>
          sku.skuId?.toString() === selectedVariant.skuId?.toString() ||
          sku.specId?.toString() === selectedVariant.specId?.toString(),
      );
    }

    if (!selectedSku && Object.keys(selectedVariations).length > 0 && skuInfos.length > 0) {
      selectedSku = skuInfos.find((sku: any) => {
        const attrs = sku.skuAttributes || [];
        return Object.entries(selectedVariations).every(([typeName, selectedValue]) => {
          return attrs.some((attr: any) =>
            skuAttributeRowMatches(attr, typeName, String(selectedValue)),
          );
        });
      });
    }

    if (!selectedSku && selectedVariant) {
      const variantStock = parseStock(selectedVariant.amountOnSale ?? selectedVariant.stock);
      return { stockCount: variantStock, inStock: variantStock > 0 };
    }

    if (selectedSku) {
      const skuStock = parseStock(selectedSku.amountOnSale);
      return { stockCount: skuStock, inStock: skuStock > 0 };
    }

    return { stockCount: baseStockCount, inStock: baseInStock };
  }, [product, getVariationTypes, selectedVariations, selectedColor, selectedSize]);

  // Check if all variation types are selected
  // IMPORTANT: This must be defined before early return to avoid hooks order issues
  const canAddToCart = useMemo(() => {
    // While the detail API is still loading, getVariationTypes() returns
    // [] (no variation info yet), which would otherwise make this evaluate
    // to `true` and briefly flash the button as enabled before the real
    // variations arrive. Gate on detailFetched so the button stays disabled
    // until we actually know whether variations exist.
    if (!product || !detailFetched) {
      return false;
    }

    // Out-of-stock gate: once the detail API has resolved we trust
    // `inStock`/`stockCount`. Either signal being zero blocks Add to Cart
    // and Buy Now. Earlier than this point `detailFetched` keeps us false
    // anyway, so we don't accidentally disable on an uninitialized 0.
    const stockCount: number = selectedStockInfo.stockCount;
    const inStockFlag: boolean = selectedStockInfo.inStock;
    if (!inStockFlag || stockCount === 0) {
      return false;
    }

    const variationTypes = getVariationTypes();

    // If there are no variations, buttons should be enabled
    if (variationTypes.length === 0) {
      return true;
    }

    // Check if all variation types have selections
    for (const variationType of variationTypes) {
      const variationName = variationType.name.toLowerCase();
      const selectedValue = selectedVariations[variationName] ||
                           (variationName === 'color' ? selectedColor : null) ||
                           (variationName === 'size' ? selectedSize : null);

      if (!selectedValue) {
        return false; // At least one variation is not selected
      }
    }

    return true; // All variations are selected
  }, [detailFetched, getVariationTypes, selectedColor, selectedSize, selectedVariations, selectedStockInfo.stockCount, selectedStockInfo.inStock]);

  // Get selected variation price - MUST be before early return
  const getSelectedVariationPrice = useMemo(() => {
    if (!product) return { price: 0, originalPrice: 0 };
    
    const source = routeSource || selectedPlatform || '1688';
    
    if (source === 'taobao') {
      // For Taobao, find the selected variation and return its price
      const selectedVariation = product.rawVariants?.find((variant: any) => {
        if (!variant.attributes || !Array.isArray(variant.attributes)) return false;
        
        return Object.keys(selectedVariations).every(variantName => {
          const selectedValue = selectedVariations[variantName];
          return variant.attributes.some((attr: any) => {
            const attrName = attr.prop_name || attr.propId || '';
            const attrValue = attr.value_name || attr.value_desc || attr.valueId || '';
            return attrName === variantName && attrValue === selectedValue;
          });
        });
      });
      
      if (selectedVariation) {
        return {
          price: selectedVariation.price || product.price || 0,
          originalPrice: selectedVariation.price || product.originalPrice || product.price || 0,
        };
      }
    } else {
      // For 1688, find the selected SKU and return its consignPrice
      const productSkuInfos = (product as any).productSkuInfos || [];
      const rawVariants = (product as any).rawVariants || [];
      
      // Find matching variant from rawVariants
      let selectedVariant: any = null;
      if (rawVariants.length > 0 && Object.keys(selectedVariations).length > 0) {
        selectedVariant = rawVariants.find((variant: any) => {
          const variantName = variant.name || '';
          if (!variantName) return false;
          return rawVariantNameMatchesSelections(variantName, selectedVariations);
        });
      }
      
      // Get skuId from variant if found
      let skuIdFromVariant: string | number | null = null;
      if (selectedVariant) {
        skuIdFromVariant = selectedVariant.skuId || selectedVariant.id || null;
      }
      
      // Find matching SKU from productSkuInfos
      let selectedSku: any = null;
      if (productSkuInfos.length > 0) {
        if (skuIdFromVariant) {
          selectedSku = productSkuInfos.find((sku: any) => 
            sku.skuId?.toString() === skuIdFromVariant?.toString() || 
            sku.specId?.toString() === skuIdFromVariant?.toString()
          );
        }
        
        // If no match by skuId, try to match by attributes
        if (!selectedSku && Object.keys(selectedVariations).length > 0) {
          selectedSku = productSkuInfos.find((sku: any) => {
            const skuAttributes = sku.skuAttributes || [];
            return Object.entries(selectedVariations).every(([variationName, selectedValue]) =>
              skuAttributes.some((attr: any) =>
                skuAttributeRowMatches(attr, variationName, String(selectedValue)),
              ),
            );
          });
        }
      }
      
      // For 1688, use consignPrice from selectedSku
      if (selectedSku?.consignPrice) {
        return {
          price: parseFloat(selectedSku.consignPrice) || product.price || 0,
          originalPrice: parseFloat(selectedSku.consignPrice) || product.originalPrice || product.price || 0,
        };
      } else if (selectedVariant?.consignPrice) {
        return {
          price: parseFloat(selectedVariant.consignPrice) || product.price || 0,
          originalPrice: parseFloat(selectedVariant.consignPrice) || product.originalPrice || product.price || 0,
        };
      }
    }
    
    return { price: product.price || 0, originalPrice: product.originalPrice || product.price || 0 };
  }, [product, selectedVariations, routeSource, selectedPlatform]);

  const handleRelatedProductPress = useCallback((item: Product | any) => {
    const productIdToUse = (item as any).offerId || item.id;
    const itemSource =
      selectedPlatform === 'taobao'
        ? (item as any).source || 'taobao'
        : (item as any).source || selectedPlatform || '1688';
    const itemCountry = locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';

    navigation.push('ProductDetail', {
      productId: productIdToUse?.toString() || item.id?.toString() || '',
      offerId: (item as any).offerId?.toString(),
      source: itemSource,
      country: itemCountry,
    });
  }, [locale, navigation, selectedPlatform]);

  const renderRelatedProductItem = useCallback(({ item }: { item: Product | any }) => {
    if (selectedPlatform === 'taobao') {
      return (
        <TouchableOpacity
          style={[styles.similarProductItem, { width: pdpGridCardWidth }]}
          onPress={() => handleRelatedProductPress(item)}
        >
          <View style={styles.simpleTaobaoCard}>
            <TaobaoRelatedThumb uri={(item as any).image} thumbEdgePx={taobaoRelatedThumbEdge} />
            <Text style={styles.simpleTaobaoTitle} numberOfLines={2}>
              {resolveText((item as any).name)}
            </Text>
            <Text style={styles.simpleTaobaoPrice}>
              {formatPriceKRW(Number((item as any).price || 0))}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.similarProductItem, { width: pdpGridCardWidth }]}>
        <ProductCard
          product={item}
          variant="moreToLove"
          cardWidth={pdpGridCardWidth}
          onPress={() => handleRelatedProductPress(item)}
          onLikePress={() => toggleWishlist(item)}
          isLiked={isProductLiked(item)}
        />
      </View>
    );
  }, [handleRelatedProductPress, isProductLiked, selectedPlatform, toggleWishlist, pdpGridCardWidth, taobaoRelatedThumbEdge]);

  const relatedProductsKeyExtractor = useCallback(
    (item: Product | any, index: number) =>
      `related-${item.id?.toString() || (item as any).offerId?.toString() || index}-${index}`,
    [],
  );

  const renderSimilarProductItem = useCallback(({ item }: { item: Product }) => (
    <View style={[styles.similarProductItem, { width: pdpGridCardWidth }]}>
      <ProductCard
        product={item}
        variant="moreToLove"
        cardWidth={pdpGridCardWidth}
        onPress={() => navigation.push('ProductDetail', { productId: item.id })}
        onLikePress={() => toggleWishlist(item)}
        isLiked={isProductLiked(item)}
      />
    </View>
  ), [isProductLiked, navigation, toggleWishlist, pdpGridCardWidth]);

  const similarProductsKeyExtractor = useCallback(
    (item: Product, index: number) => `similar-${item.id?.toString() || index}-${index}`,
    [],
  );

  const renderSimilarProductsFooter = useCallback(() => {
    if (!similarProductsLoadingMore) {
      return null;
    }

    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  }, [similarProductsLoadingMore]);

  // ─── HOOKS THAT MUST RUN BEFORE THE `if (!product)` EARLY RETURN ────
  // Anything below this comment that registers a hook (useEffect, useRef,
  // useMemo, useCallback…) must live ABOVE the early return so the hook
  // count stays constant across renders — otherwise React throws the
  // "Rendered more hooks than during the previous render" error when
  // product transitions from null → loaded (e.g. on first navigation
  // from LiveScreen, where no productData is passed in route params).

  // Holds the latest handleAddToCart closure. handleAddToCart itself is
  // defined AFTER the early return because its body assumes product is
  // non-null; the ref bridges the auto-trigger useEffect (which lives
  // here, above the return) to that later definition.
  const handleAddToCartRef = useRef<() => void>(() => {});
  const handleBuyNowRef = useRef<() => void>(() => {});

  // Auto-execute add-to-cart when the user returns from Auth after being
  // prompted from handleAddToCart. Same snapshot + live-param guard as Buy Now.
  useEffect(() => {
    const arrivedFromAuth =
      autoAddToCartOnMountRef.current &&
      Boolean((route.params as any)?.autoAddToCart);

    if (
      !autoAddTriggeredRef.current &&
      arrivedFromAuth &&
      isAuthenticated &&
      detailFetched &&
      product &&
      canAddToCart
    ) {
      autoAddTriggeredRef.current = true;
      navigation.setParams({ autoAddToCart: undefined } as any);
      setIsAutoCartFlow(true);
      handleAddToCartRef.current();
    }
  }, [
    (route.params as any)?.autoAddToCart,
    isAuthenticated,
    detailFetched,
    product,
    canAddToCart,
  ]);

  // Auto-execute Buy Now when the user returns from Login/Signup after
  // being prompted from the Buy Now button. Mirrors the autoAddToCart
  // flow so the user is taken directly to the purchase page without
  // tapping Buy Now again.
  useEffect(() => {
    // Require BOTH the mount-time snapshot AND the current route param
    // to be set. The snapshot guards against stale params from restored
    // navigation state; the live param guards against the snapshot
    // surviving a screen reuse. Without both, opening a product card
    // could spontaneously POST /cart/checkout/direct-purchase on mount.
    const arrivedFromAuth =
      autoBuyNowOnMountRef.current && Boolean((route.params as any)?.autoBuyNow);

    if (
      !autoBuyTriggeredRef.current &&
      arrivedFromAuth &&
      isAuthenticated &&
      detailFetched &&
      product &&
      canAddToCart
    ) {
      autoBuyTriggeredRef.current = true;
      navigation.setParams({ autoBuyNow: undefined } as any);
      handleBuyNowRef.current();
    }
  }, [
    (route.params as any)?.autoBuyNow,
    isAuthenticated,
    detailFetched,
    product,
    canAddToCart,
  ]);

  // Early return — MUST be after ALL hooks. No spinner: when the previous
  // page passed `productData`, `product` is non-null on the first frame and
  // the page renders immediately. When it didn't, we briefly render an empty
  // background until the detail API resolves — much less jarring than a
  // full-screen loading indicator.
  if (!product) {
    return <View style={styles.container} />;
  }

  const isLiked = isProductLiked(product);

  const handleQuantityChange = (increment: boolean) => {
    const minOrderQuantity = (product as any)?.minOrderQuantity || 1;
    if (increment) {
      setQuantity(prev => prev + 1);
    } else {
      setQuantity(prev => Math.max(minOrderQuantity, prev - 1));
    }
  };

  const handleAddToCart = async () => {
      if (!isAuthenticated) {
      // Login modal so returning members can continue; new users can open
      // 회원가입 (registration) from Login. Same returnParams + autoAddToCart.
      const persistedLiveCode =
        getLiveCodeForCartPayload(routeSource, product, routeLiveCode, productId) || undefined;
      const returnParams = {
        productId: (productId || offerId)?.toString?.() ?? String(productId || offerId || ''),
        offerId: offerId?.toString?.(),
        source: routeSource || sourceRef.current,
        country: routeCountry || countryRef.current,
        productData: product,
        autoAddToCart: true,
        ...(persistedLiveCode ? { liveCode: persistedLiveCode } : {}),
      };
      navigation.navigate('Auth', {
        screen: 'Login',
        params: {
          returnTo: 'ProductDetail',
          returnParams,
        },
      } as never);
      return;
    }

    if (!canAddToCart) {
      const variationTypes = getVariationTypes();
      if (variationTypes.length > 0) {
        showToast(t('product.pleaseSelectOptions'), 'warning');
      }
      return;
    }

    // Check minOrderQuantity
    const minOrderQuantity = (product as any).minOrderQuantity || 1;
    if (quantity < minOrderQuantity) {
      showToast(
        t('product.minOrderQuantity') || `Minimum order quantity is ${minOrderQuantity}`,
        'warning'
      );
      return;
    }

    try {
      // Get the selected SKU based on selected variations
      const productSkuInfos = (product as any).productSkuInfos || [];
      const rawVariants = (product as any).rawVariants || [];
      
      // Get source from product, route params, or selected platform.
      // Use the already-normalized sourceRef.current (which maps the
      // logical 'live-commerce' / 'companymall' / 'myCompany' values to
      // 'ownmall' for the backend) so the cart-add request doesn't fail
      // with "source must be one of: taobao, 1688, jd, vip, vvic,
      // ownmall". handleBuyNow already does this — handleAddToCart was
      // computing source inline and sending the raw routeSource through.
      const source =
        sourceRef.current ||
        (product as any).source ||
        route.params?.source ||
        selectedPlatform ||
        '1688';
      
      // Find the matching variant/SKU based on selected variations
      let selectedVariant: any = null;
      let selectedSku: any = null;
      
      // First, try to find matching variant from rawVariants (for Taobao, this contains sku_id from sku_properties)
      if (rawVariants.length > 0) {
        if (Object.keys(selectedVariations).length > 0) {
          // Match variant based on selected variations
          // Variant name format: "Color: Red / Size: Large"
          selectedVariant = rawVariants.find((variant: any) => {
            const variantName = variant.name || '';
            if (!variantName) return false;
            return rawVariantNameMatchesSelections(variantName, selectedVariations);
          });
        }
        
        // If no match found or no variations selected, use the first variant
        if (!selectedVariant && rawVariants.length > 0) {
          selectedVariant = rawVariants[0];
        }
      }
      
      // If we found a variant, get skuId from it (this comes from sku_properties)
      let skuIdFromVariant: string | number | null = null;
      let variantPrice: number | null = null;
      
      if (selectedVariant) {
        skuIdFromVariant = selectedVariant.skuId || selectedVariant.id || null;
        variantPrice = selectedVariant.price || null;
      }
      
      // Now try to find matching SKU from productSkuInfos
      if (productSkuInfos.length > 0) {
        if (skuIdFromVariant) {
          // Find SKU by skuId
          selectedSku = productSkuInfos.find((sku: any) => 
            sku.skuId?.toString() === skuIdFromVariant?.toString() || 
            sku.specId?.toString() === skuIdFromVariant?.toString()
          );
        }
        
        // If we have selected variations but no skuId from variant, try to match by attributes
        if (!selectedSku && Object.keys(selectedVariations).length > 0) {
          selectedSku = productSkuInfos.find((sku: any) => {
            const skuAttributes = sku.skuAttributes || [];
            return Object.entries(selectedVariations).every(([variationName, selectedValue]) =>
              skuAttributes.some((attr: any) =>
                skuAttributeRowMatches(attr, variationName, String(selectedValue)),
              ),
            );
          });
        }
        
        // If no match found, use the first SKU
        if (!selectedSku && productSkuInfos.length > 0) {
          selectedSku = productSkuInfos[0];
        } 
      }
      
      // Determine final skuId, specId, and price
      // Priority: skuId from variant (from sku_properties) > skuId from selectedSku > fallback
      const finalSkuId = skuIdFromVariant || selectedSku?.skuId || selectedVariant?.skuId || selectedVariant?.id || '0';
      
      // Determine specId based on source:
      // - For 1688: Use specId from selectedSku if available (specId exists separately in SKU info)
      // - For Taobao: specId can be same as skuId
      const isTaobao = source === 'taobao';
      const finalSpecId = isTaobao 
        ? finalSkuId.toString() // For Taobao, specId same as skuId
        : (selectedSku?.specId?.toString() || finalSkuId.toString()); // For 1688, use specId from SKU info if available
      
      const finalPrice = variantPrice || selectedSku?.price || selectedSku?.consignPrice || product.price || 0;
      
      // Get product ID for promotionUrl
      const productIdForUrl = product.offerId || product.id || productId || offerId || '';
      
      // For Taobao cases, set promotionUrl
      const promotionUrl = isTaobao 
        ? `${SERVER_BASE_URL}/${productIdForUrl}`
        : ((product as any).promotionUrl || '');
      
      // Convert skuId to number if it's a string
      const skuIdValue = typeof finalSkuId === 'string' ? parseInt(finalSkuId) || 0 : finalSkuId;
      
      // Build the request body. Live-commerce lines include `liveCode` plus
      // catalog `offerId` so the provider can classify the line from the response.
      const requestBody: any = {
        categoryId: parseInt((product as any).categoryId || product.category?.id || '0'),
        subject: resolveText((product as any).subject || product.name || ''),
        subjectTrans: resolveText((product as any).subjectTrans || product.name || ''),
        imageUrl: product.images?.[0] || product.image || '',
        promotionUrl: promotionUrl,
        source: source,
        skuInfo: {
          skuId: skuIdValue,
          specId: finalSpecId,
          price: finalPrice.toString(),
          amountOnSale: selectedSku?.amountOnSale || selectedVariant?.stock || 0,
          consignPrice: finalPrice.toString(),
          cargoNumber: selectedSku?.cargoNumber || '',
          skuAttributes: (selectedSku?.skuAttributes || selectedVariant?.attributes || []).map((attr: any) => ({
            attributeId: parseInt(attr.attributeId || attr.propId || '0', 10) || 0,
            attributeName: attr.attributeName || attr.prop_name || '',
            attributeNameTrans: attr.attributeNameTrans || attr.prop_name || attr.attributeName || '',
            value: attr.value || attr.value_name || attr.value_desc || '',
            valueTrans: attr.valueTrans || attr.value_name || attr.value_desc || attr.value || '',
            skuImageUrl: attr.skuImageUrl || attr.image || '',
          })),
          fenxiaoPriceInfo: selectedSku?.fenxiaoPriceInfo || {
            offerPrice: finalPrice.toString(),
          },
        },
        companyName: resolveText(product.seller?.name || (product as any).companyName || ''),
        sellerOpenId: product.seller?.id || (product as any).sellerOpenId || '',
        quantity: quantity,
        minOrderQuantity: minOrderQuantity,
      };

      const cartLiveCode = getLiveCodeForCartPayload(routeSource, product, routeLiveCode, productId);
      if (isLiveSource(routeSource) && !cartLiveCode) {
        showToast(
          routeHasInvalidLiveCommerceLiveParam(routeLiveCode)
            ? t('product.invalidLiveCodeFormat')
            : t('product.liveProductCodeMissing'),
          'warning',
        );
        return;
      }

      const catalogOfferId = parseInt(productIdForUrl.toString() || '0', 10) || 0;
      const addPayload: Record<string, unknown> = {
        ...requestBody,
        offerId: catalogOfferId,
        ...(cartLiveCode ? { liveCode: cartLiveCode } : {}),
      };

      if (__DEV__ && cartLiveCode) {
        console.log('[PDP][live] POST /cart', {
          offerId: addPayload.offerId,
          liveCode: addPayload.liveCode,
          keys: Object.keys(addPayload),
        });
      }

      // Local-only live tracking. Backend doesn't tag live orders, so we
      // remember the offerId on this device the moment the user commits
      // to adding a live product to the cart. BuyListScreen later
      // cross-references each order item's offerId / liveCode against this list to
      // decide whether to display the order number with an `LS` prefix.
      if (isLiveSource(routeSource)) {
        void recordLiveProduct(productIdForUrl);
        if (cartLiveCode) void recordLiveProduct(cartLiveCode);
      }

      await addToCart(addPayload as any);
    } catch (error: any) {
      showToast(error?.message || t('product.failedToAdd'), 'error');
    }
  };

  // Keep the ref pointing to the latest handleAddToCart closure so the
  // auto-trigger useEffect (registered ABOVE the `if (!product)` early
  // return for hook-order stability) can call into it once product data
  // arrives. Plain assignment, not a hook — runs on every render after
  // the early return is bypassed.
  handleAddToCartRef.current = handleAddToCart;

  // Handle Buy Now - same logic as handleAddToCart but navigates to Checkout
  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      showToast(t('home.pleaseLogin'), 'warning');
      return;
    }

    if (!canAddToCart) {
      const variationTypes = getVariationTypes();
      if (variationTypes.length > 0) {
        showToast(t('product.pleaseSelectOptions'), 'warning');
      }
      return;
    }

    // Check minOrderQuantity
    const minOrderQuantity = (product as any).minOrderQuantity || 1;
    if (quantity < minOrderQuantity) {
      showToast(
        t('product.minOrderQuantity') || `Minimum order quantity is ${minOrderQuantity}`,
        'warning'
      );
      return;
    }

    try {
      // Reuse the same logic from handleAddToCart
      const productSkuInfos = (product as any).productSkuInfos || [];
      const rawVariants = (product as any).rawVariants || [];
      const fetchSource = sourceRef.current;
      
      let selectedVariant: any = null;
      let selectedSku: any = null;
      
      if (rawVariants.length > 0) {
        if (Object.keys(selectedVariations).length > 0) {
          selectedVariant = rawVariants.find((variant: any) => {
            const variantName = variant.name || '';
            if (!variantName) return false;
            return rawVariantNameMatchesSelections(variantName, selectedVariations);
          });
        }
        if (!selectedVariant && rawVariants.length > 0) {
          selectedVariant = rawVariants[0];
        }
      }
      
      let skuIdFromVariant: string | number | null = null;
      let variantPrice: number | null = null;
      
      if (selectedVariant) {
        skuIdFromVariant = selectedVariant.skuId || selectedVariant.id || null;
        variantPrice = selectedVariant.price || null;
      }
      
      if (productSkuInfos.length > 0) {
        if (skuIdFromVariant) {
          selectedSku = productSkuInfos.find((sku: any) => 
            sku.skuId?.toString() === skuIdFromVariant?.toString() || 
            sku.specId?.toString() === skuIdFromVariant?.toString()
          );
        }
        
        if (!selectedSku && Object.keys(selectedVariations).length > 0) {
          selectedSku = productSkuInfos.find((sku: any) => {
            const skuAttributes = sku.skuAttributes || [];
            return Object.entries(selectedVariations).every(([variationName, selectedValue]) =>
              skuAttributes.some((attr: any) =>
                skuAttributeRowMatches(attr, variationName, String(selectedValue)),
              ),
            );
          });
        }
        
        if (!selectedSku && productSkuInfos.length > 0) {
          selectedSku = productSkuInfos[0];
        }
      }
      
      const finalSkuId = skuIdFromVariant || selectedSku?.skuId || selectedVariant?.skuId || selectedVariant?.id || '0';
      
      // Determine specId based on source:
      // - For 1688: Use specId from selectedSku if available (specId exists separately in SKU info)
      // - For Taobao: specId can be same as skuId
      const isTaobao = fetchSource === 'taobao';
      const finalSpecId = isTaobao 
        ? finalSkuId.toString() // For Taobao, specId same as skuId
        : (selectedSku?.specId?.toString() || finalSkuId.toString()); // For 1688, use specId from SKU info if available
      
      const finalPrice = variantPrice || selectedSku?.price || selectedSku?.consignPrice || product.price || 0;
      
      const productIdForUrl = product.offerId || product.id || productId || offerId || '';
      const promotionUrl = isTaobao 
        ? `${SERVER_BASE_URL}/${productIdForUrl}`
        : ((product as any).promotionUrl || '');
      
      const skuIdValue = typeof finalSkuId === 'string' ? parseInt(finalSkuId) || 0 : finalSkuId;
      
      const skuInfoPayload = {
        skuId: skuIdValue,
        specId: finalSpecId,
        price: finalPrice.toString(),
        amountOnSale: selectedSku?.amountOnSale || selectedVariant?.stock || 0,
        consignPrice: finalPrice.toString(),
        cargoNumber: selectedSku?.cargoNumber || '',
        skuAttributes: (selectedSku?.skuAttributes || selectedVariant?.attributes || []).map((attr: any) => ({
          attributeId: parseInt(attr.attributeId || attr.propId || '0', 10) || 0,
          attributeName: attr.attributeName || attr.prop_name || '',
          attributeNameTrans: attr.attributeNameTrans || attr.prop_name || attr.attributeName || '',
          value: attr.value || attr.value_name || attr.value_desc || '',
          valueTrans: attr.valueTrans || attr.value_name || attr.value_desc || attr.value || '',
          skuImageUrl: attr.skuImageUrl || attr.image || '',
        })),
        fenxiaoPriceInfo: selectedSku?.fenxiaoPriceInfo || {
          offerPrice: finalPrice.toString(),
        },
      };

      const buyNowLiveCode = getLiveCodeForCartPayload(routeSource, product, routeLiveCode, productId);
      if (isLiveSource(routeSource) && !buyNowLiveCode) {
        showToast(
          routeHasInvalidLiveCommerceLiveParam(routeLiveCode)
            ? t('product.invalidLiveCodeFormat')
            : t('product.liveProductCodeMissing'),
          'warning',
        );
        return;
      }

      const directPurchaseBase: Record<string, unknown> = {
        source: fetchSource,
        quantity: String(quantity),
        price: typeof finalPrice === 'number' ? finalPrice : parseFloat(String(finalPrice)) || 0,
        sellerOpenId: product.seller?.id || (product as any).sellerOpenId || '',
        imageUrl: product.images?.[0] || product.image || '',
        promotionUrl: (product as any).promotionUrl || undefined,
        companyName: resolveText(product.seller?.name || (product as any).companyName || ''),
        subject: resolveText((product as any).subject || product.name || ''),
        subjectTrans: resolveText((product as any).subjectTrans || product.name || (product as any).subject || ''),
        categoryid: (product as any).categoryId?.toString() || product.category?.id?.toString() || undefined,
        categoryname: (product as any).categoryName || product.category?.name || undefined,
        skuInfo: skuInfoPayload,
      };

      const catalogProductId = parseInt(productIdForUrl.toString(), 10) || 0;
      const directPurchaseBody: Record<string, unknown> = {
        ...directPurchaseBase,
        productId: catalogProductId,
        ...(buyNowLiveCode ? { liveCode: buyNowLiveCode } : {}),
      };

      if (__DEV__ && buyNowLiveCode) {
        console.log('[PDP][live] POST /cart/checkout/direct-purchase', {
          productId: directPurchaseBody.productId,
          liveCode: directPurchaseBody.liveCode,
          keys: Object.keys(directPurchaseBody),
        });
      }

      // Same local-only live tracking as handleAddToCart — see that
      // handler's comment for context.
      if (isLiveSource(routeSource)) {
        void recordLiveProduct(productIdForUrl);
        if (buyNowLiveCode) void recordLiveProduct(buyNowLiveCode);
      }

      checkoutDirectPurchase(directPurchaseBody as any);
    } catch (error: any) {
      showToast(error?.message || t('product.failedToProceedToCheckout'), 'error');
    }
  };

  handleBuyNowRef.current = handleBuyNow;

  const handleCartIconPress = () => {
    if (!isAuthenticated) {
      return;
    }
    navigation.navigate('Cart');
  };

  const handlePhotoCaptureConfirm = (data: { quantity: number; request: string; photos: string[] }) => {
    // Handle photo capture confirmation
    // In a real app, this would send the data to the server
  };

  const handleSimilarImageSearch = async () => {
    if (!product) return;
    const imageUrl = getApiProductImages(product)[0] || product.image || '';
    if (!imageUrl) {
      showToast(t('product.noProductImageAvailable'), 'error');
      return;
    }
    setIsFetchingBase64(true);
    try {
      const RNFS = require('react-native-fs');
      // Download the remote image to a temp file then read as base64
      const tempPath = `${RNFS.CachesDirectoryPath}/similar_search_${Date.now()}.jpg`;
      await RNFS.downloadFile({ fromUrl: imageUrl, toFile: tempPath }).promise;
      const base64 = await RNFS.readFile(tempPath, 'base64');
      setSimilarSearchUri(imageUrl);
      setSimilarSearchBase64(base64);
      setSimilarSearchVisible(true);
    } catch (e) {
      showToast(t('product.failedToLoadProductImage'), 'error');
    } finally {
      setIsFetchingBase64(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareTemplate = t('product.shareMessage');
      const fallbackTemplate = 'Check out this amazing product: {productName}\nPrice: {price}\n\nShared from TodayMall';
      const resolvedTemplate =
        !shareTemplate || shareTemplate === 'product.shareMessage'
          ? fallbackTemplate
          : shareTemplate;
      const shareContent = {
        message: resolvedTemplate
          .replace('{productName}', product.name)
          .replace('{price}', formatPriceKRW(product.price)),
        url: `https://todaymall.com/product/${productId}`, // Replace with your actual app URL
      };
      
      await Share.share(shareContent);
    } catch (error) {
      // Error sharing - silently fail
    }
  };

  // White scrim via opacity so scroll-linked animation can use the native driver.
  const headerWhiteOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Header sits on top of the image (absolute overlay), so we must
  // size it using safe-area insets (varies by device/notch). Some
  // devices render a larger status bar area than the emulator.
  const isTabletLandscapeHeaderMode = pdpIsTablet && pdpIsLandscape;
  const headerPaddingTop = isTabletLandscapeHeaderMode
    ? insets.top
    : Math.max(insets.top, SPACING.md);

  const renderHeader = () => {
    const searchBarOpacity = scrollY.interpolate({
      // Delay the search bar fade-in so it appears when the header
      // background is mostly opaque (prevents an unsightly partial
      // overlap while scrolling).
      inputRange: [HEADER_SCROLL_THRESHOLD * 0.7, HEADER_SCROLL_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const cameraIconOpacity = scrollY.interpolate({
      inputRange: [0, HEADER_SCROLL_THRESHOLD * 0.5],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View
        style={[
          styles.header,
          {
            paddingTop: headerPaddingTop,
            zIndex: 2,
            backgroundColor: 'transparent',
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: COLORS.white,
              opacity: headerWhiteOpacity,
            },
          ]}
        />
        <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowBackIcon width={12} height={20} color={COLORS.text.primary} />
        </TouchableOpacity>

        {/* Search bar — fades in on scroll */}
        <Animated.View style={[styles.headerCenter, { opacity: searchBarOpacity }]}>
          <SearchButton
            placeholder={t('category.searchPlaceholder') || 'Search products...'}
            onPress={() => navigation.navigate('Search' as never)}
            style={styles.searchButtonStyle}
            isHomepage={false}
          />
        </Animated.View>

        {/* Camera icon — fades out on scroll. Hidden for live-commerce. */}
        {route.params?.source !== 'live-commerce' && (
          <Animated.View style={[styles.headerCameraIcon, { opacity: cameraIconOpacity }]}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSimilarImageSearch}
              disabled={isFetchingBase64}
            >
              <SearchImageIcon width={30} height={30} color={COLORS.black}/>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <ShareAppIcon width={24} height={24} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleCartIconPress}>
            <CartIcon width={24} height={24} color={COLORS.black} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderImageGallery = () => {
    // Use only API images (not from HTML description). Append the
    // currently-selected variation's picture as a virtual extra page when
    // it is NOT already in apiImages (see `handleSelect` for the wiring).
    const apiImages = getApiProductImages(product);
    const displayImages =
      extraVariationImage && !apiImages.includes(extraVariationImage)
        ? [...apiImages, extraVariationImage]
        : apiImages;
    const totalImages = displayImages.length;

    if (totalImages === 0) {
      return null;
    }

    // Decode ~screen width (capped) so we never pull full-resolution assets into the pager.
    const thumbEdgePx = Math.min(
      480,
      Math.max(220, Math.round(dynWidth * Math.min(PixelRatio.get(), 3))),
    );

    return (
      <View style={styles.imageGalleryContainer}>
        <FlatList
          ref={galleryScrollRef}
          data={displayImages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, index) => `pdp-gal-${index}`}
          getItemLayout={(_, index) => ({
            length: dynWidth,
            offset: dynWidth * index,
            index,
          })}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={2}
          removeClippedSubviews={Platform.OS === 'android'}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / dynWidth);
            setSelectedImageIndex(Math.min(Math.max(0, index), totalImages - 1));
          }}
          scrollEventThrottle={96}
          renderItem={({ item: img, index }) => (
            <PdpGallerySlide
              uri={img}
              widthPx={dynWidth}
              heightPx={IMAGE_HEIGHT}
              thumbEdgePx={thumbEdgePx}
              index={index}
              onPress={() => {
                setViewerImageIndex(index);
                setImageViewerVisible(true);
              }}
            />
          )}
        />

        {/* Image indicators */}
        <View style={styles.imageIndicators}>
          {displayImages.map((img: any, index: number) => (
            <View
              key={`indicator-${index}`}
              style={[
                styles.indicator,
                selectedImageIndex === index && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
        <View style={styles.itemInfoBar}>
          {/* Review badge with star and review count */}
          <View style={styles.reviewBadgeContainer}>
            {/* <View style={styles.reviewBadge}>
              <FamilyStarIcon width={18} height={18} color={COLORS.white} />
              <Text style={[styles.reviewBadgeText, { marginLeft: SPACING.xs }]}>
                {product.rating?.toFixed(1) || '0'}
              </Text>
            </View> */}
            <Text style={styles.itemInfoText}>
              {totalImages}/{selectedImageIndex + 1}
            </Text>
          </View>
          
          <View style={{ flex: 1 }} />
          
          <View style={styles.heartButtonContainer}>
            {wishlistCount !== null && wishlistCount > 0 && (
              <Text style={styles.wishlistCountText}>{wishlistCount}</Text>
            )}
            <TouchableOpacity
              style={styles.heartButton}
              onPress={() => toggleWishlist(product)}
            >
              <HeartPlusIcon
                width={24}
                height={24}
                color={isLiked ? COLORS.red : COLORS.white}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const handleCopyProductCode = async () => {
    const { value: codeToCopy } = getPdpCatalogCodeDisplay(routeSource, product, routeLiveCode);
    if (codeToCopy) {
      await Clipboard.setString(codeToCopy);
      setIsCopied(true);
      // Reset icon after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  };

  // Copy the part number (live-product `productNo`) to the clipboard.
  // Mirrors handleCopyProductCode but targets a different field so the
  // two copy buttons don't fight over the same `isCopied` state.
  const handleCopyPartNumber = () => {
    const isLivePdp = routeSource === 'live-commerce' || routeSource === 'live';
    const partNumber =
      (product as any).productNo ||
      (isLivePdp ? String((product as any).offerId ?? '').trim() : '') ||
      '';
    if (partNumber) {
      Clipboard.setString(partNumber);
      setIsPartNumberCopied(true);
      setTimeout(() => {
        setIsPartNumberCopied(false);
      }, 2000);
    }
  };

  const renderProductInfo = () => {
    // Calculate discount percentage
    const discount = product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;
    
    // Catalog / live code row (live-commerce shows Live Code when present)
    const codeDisplay = getPdpCatalogCodeDisplay(routeSource, product, routeLiveCode);
    const displayCode = codeDisplay.value;
    
    // Get soldOut number from product
    const soldOut = (product as any).soldOut || '0';
    
    const isLive = routeSource === 'live-commerce' || routeSource === 'live';
    const liveSellerId = (product as any).ownerSellerId || product.seller?.id || '';
    // The live channel's /live-commerce/sellers/:sellerId response carries
    // the avatar / display name; the product detail API doesn't. Prefer
    // those fields when liveSellerInfo has resolved (the recommendations
    // fetch populates it shortly after detail loads).
    const liveSellerName =
      liveSellerInfo?.userName ||
      liveSellerInfo?.nickname ||
      liveSellerInfo?.sellerName ||
      (product as any).metadata?.original1688Data?.companyName ||
      product.seller?.name ||
      '';
    const liveSellerAvatar =
      liveSellerInfo?.picUrl ||
      liveSellerInfo?.sellerAvatar ||
      liveSellerInfo?.avatar ||
      product.seller?.avatar ||
      (product as any).sellerAvatar ||
      '';

    return (
      <View style={styles.productInfoContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name || t('product.product')}
        </Text>

        {/* Live seller mini-card — sits directly under the product title
            on live-commerce products. Tapping anywhere on the row opens
            the seller's live page. Hidden when seller info is unavailable
            or the product isn't from the live channel. */}
        {isLive && liveSellerId ? (
          <TouchableOpacity
            style={styles.liveSellerRow}
            activeOpacity={0.7}
            onPress={() => {
              navigation.navigate('LiveSellerDetail', {
                sellerId: liveSellerId,
                sellerName: liveSellerName,
                source: 'ownmall',
              });
            }}
          >
            <Image
              source={{
                uri: liveSellerAvatar ||
                  `https://via.placeholder.com/80.png?text=${encodeURIComponent(liveSellerName?.[0] || 'S')}`,
              }}
              style={styles.liveSellerAvatar}
            />
            <View style={styles.liveSellerTextWrap}>
              <Text style={styles.liveSellerName} numberOfLines={1}>
                {liveSellerName || t('live.live')}
              </Text>
              <Text style={styles.liveSellerSubtitle} numberOfLines={1}>
                {t('live.viewSeller')} {'>'}
              </Text>
            </View>
            <ArrowRightIcon width={14} height={14} color={COLORS.text.secondary} />
          </TouchableOpacity>
        ) : null}

        {/* Review/Rating Row */}
        <View style={styles.ratingRow}>
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {(() => {
                const rating = product.rating || 0;
                const fullStars = Math.floor(rating);
                const hasHalfStar = rating % 1 >= 0.5;
                const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
                
                const stars = [];
                // Full stars
                for (let i = 0; i < fullStars; i++) {
                  stars.push(
                    <StarIcon key={`full-${i}`} width={16} height={16} color="#FF5500" />
                  );
                }
                // Half star
                if (hasHalfStar) {
                  stars.push(
                    <StarHalfIcon key="half" width={16} height={16} color="#FF5500" />
                  );
                }
                // Empty stars
                for (let i = 0; i < emptyStars; i++) {
                  stars.push(
                    <StarOutlineIcon key={`empty-${i}`} width={16} height={16} color="#E0E0E0" />
                  );
                }
                return stars;
              })()}
            </View>
            <Text style={styles.ratingText}>
              {product.rating?.toFixed(1) || '0'}
            </Text>
          </View>
          <View style={{ width: 1, height: 16, backgroundColor: COLORS.gray[500], marginRight: SPACING.sm }} />
          <Text style={styles.soldText}>{soldOut || 0} {t('product.sold')}</Text>
        </View>
        
        {/* Discount and Product Code badges */}
        <View style={styles.badgesRow}>
          {discount > 0 && (
            <View style={styles.discountBadgeInline}>
              <Text style={styles.discountBadgeText}>-{discount}%</Text>
            </View>
          )}
          {displayCode && (
            <View style={styles.productCodeBadge}>
              <Text style={styles.productCodeBadgeText}>
                {t('product.productCode')} {displayCode}
              </Text>
              <TouchableOpacity
                onPress={handleCopyProductCode}
                style={styles.copyIconButton}
              >
                {isCopied ? (
                  <CheckIcon size={18} color={COLORS.red} isSelected={true} />
                ) : (
                  <ContentCopyIcon width={18} height={18} color={COLORS.red} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Part-number row sits on its own line below `badgesRow`
            because `badgesRow` is a flex row — putting this inside
            would lay the part number to the right of the productCode
            badge instead of underneath it. */}
        {(() => {
          // `productNo` is the live-product part number (e.g. "611385").
          // Only present on live-commerce products — for regular catalog
          // products this field is undefined and the row is skipped.
          const partNumber: string =
            (product as any).productNo ||
            (isLive ? String((product as any).offerId ?? '').trim() : '') ||
            '';
          if (!partNumber) return null;
          return (
            <View style={styles.productPartNumberRow}>
              <Text style={styles.productPartNumberText}>
                {`${t('product.partNumber') || 'Part #'} ${partNumber}`}
              </Text>
              <TouchableOpacity
                onPress={handleCopyPartNumber}
                style={styles.copyIconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isPartNumberCopied ? (
                  <CheckIcon size={16} color={COLORS.red} isSelected={true} />
                ) : (
                  <ContentCopyIcon width={16} height={16} color={COLORS.red} />
                )}
              </TouchableOpacity>
            </View>
          );
        })()}
      </View>
    );
  };
  
  const renderRatingRow = () => {
    // Get soldOut number from product
    const soldOut = (product as any).soldOut || '0';
    
    return (
      <View style={styles.ratingRow}>
        <View style={styles.ratingContainer}>
          <Icon name="star" size={16} color="#FFD700" />
          <Text style={styles.ratingText}>
            {product.rating?.toFixed(1) || '0'}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.soldText}>{soldOut || 0} sold</Text>
      </View>
    );
  };

  const renderPriceRow = () => {
    const { price, originalPrice } = getSelectedVariationPrice;
    return (
      <View style={styles.priceRow}>
        <Text style={styles.pricePrimary}>{formatPriceKRW(price)}</Text>
        {originalPrice > 0 && originalPrice > price && (
          <Text style={styles.originalPriceRight}>{formatPriceKRW(originalPrice)}</Text>
        )}
      </View>
    );
  };

  const renderProductCode = () => {
    const codeDisplay = getPdpCatalogCodeDisplay(routeSource, product, routeLiveCode);
    if (!codeDisplay.value) return null;
    return (
    <>
      {/* Product / Live code with copy */}
      <View style={styles.productCodeContainer}>
          <Text style={styles.productCodeLabel}>{t('product.productCode')} </Text>
          <Text style={styles.productCodeText}>{codeDisplay.value}</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyProductCode}
          >
            {isCopied ? (
              <CheckIcon size={16} color="#10B981" isSelected={true} circleColor="#10B981" />
            ) : (
              <ContentCopyIcon width={16} height={16} color={COLORS.primary} />
            )}
            <Text style={[
              styles.copyButtonText,
              isCopied && { color: "#10B981" }
            ]}>
              {isCopied ? t('product.copied') : t('product.copy')}
            </Text>
          </TouchableOpacity>
        </View>
    </>
    );
  };


  const renderVariationSelector = (variationType: { name: string; options: Array<{ value: string; image?: string; [key: string]: any }> }) => {
    const typeLabelRaw = resolveText(variationType.name as unknown).trim();
    const variationName = typeLabelRaw.toLowerCase();

    // Get selected value from selectedVariations state
    const selectedValue = selectedVariations[variationName] || null;

    // Display label translation. The API returns the variation type name
    // in whatever language the source platform uses (1688 → 颜色 / 尺码,
    // Taobao similar, sometimes Korean / English mixed). Map the common
    // synonyms to the existing `product.color` / `product.size` i18n
    // keys so the label always matches the user's locale. Unknown types
    // (e.g. "규격" / "Specification") fall back to the raw API string —
    // safer than silently mistranslating.
    const VARIATION_NAME_I18N_MAP: Record<string, 'color' | 'size'> = {
      // ─── Color ─────────────────────────────────
      color: 'color',
      colour: 'color',
      '颜色': 'color',
      '色彩': 'color',
      '色': 'color',
      '색상': 'color',
      '색깔': 'color',
      '컬러': 'color',
      // ─── Size ──────────────────────────────────
      size: 'size',
      '尺码': 'size',
      '尺寸': 'size',
      '사이즈': 'size',
      '크기': 'size',
    };
    const i18nKey =
      VARIATION_NAME_I18N_MAP[variationName] ||
      VARIATION_NAME_I18N_MAP[typeLabelRaw];
    const displayName = i18nKey
      ? t(`product.${i18nKey}`)
      : resolveText(variationType.name as unknown);
    
    const handleSelect = (value: unknown) => {
      const normalizedValue =
        typeof value === 'string' ? value : resolveText(value);
      // Toggle behavior: re-tapping the already-selected option deselects
      // it and resets the gallery to its default first image. This lets the
      // user clear a color choice without picking a different one.
      if (
        selectedValue != null &&
        (selectedValue === normalizedValue ||
          resolveText(selectedValue as unknown) === normalizedValue)
      ) {
        setSelectedVariations(prev => {
          const next = { ...prev };
          delete next[variationName];
          return next;
        });
        if (variationName === 'color') setSelectedColor(null);
        else if (variationName === 'size') setSelectedSize(null);
        // Drop any appended variation image and snap the gallery back to
        // index 0. Safe to always do this — if the deselected option had
        // no image, scrolling to 0 is a no-op when we're already there.
        setExtraVariationImage(null);
        setSelectedImageIndex(0);
        galleryScrollRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      }

      // Update selectedVariations state
      setSelectedVariations(prev => ({
        ...prev,
        [variationName]: normalizedValue,
      }));

      // Also update selectedColor and selectedSize for backward compatibility with addToCart
      if (variationName === 'color') {
        setSelectedColor(normalizedValue);
      } else if (variationName === 'size') {
        setSelectedSize(normalizedValue);
      }

      // If the chosen option carries an image, surface it on the gallery.
      // 1. Try to find it in apiImages (exact match, then query-stripped).
      // 2. If found, scroll the gallery to that index and drop any leftover
      //    extra-variation image — we don't need the appended page.
      // 3. If NOT found, the variation's picture isn't in the product's
      //    gallery — stash it in `extraVariationImage` so the gallery and
      //    viewer append it as one more page; the effect below will scroll
      //    to that appended page once the gallery has rendered it.
      const chosen = variationType.options.find(
        (o: any) =>
          o.value === value ||
          (typeof o.value === 'object' &&
            o.value != null &&
            resolveText(o.value as unknown) === normalizedValue) ||
          resolveText(o.value as unknown) === normalizedValue,
      );
      const targetUrl: string | undefined = chosen?.image;
      if (targetUrl) {
        const apiImages = getApiProductImages(product);
        const stripQuery = (u: string) => (u || '').split('?')[0];
        let idx = apiImages.findIndex((u: string) => u === targetUrl);
        if (idx < 0) {
          const target = stripQuery(targetUrl);
          idx = apiImages.findIndex((u: string) => stripQuery(u) === target);
        }
        if (idx >= 0) {
          setExtraVariationImage(null);
          setSelectedImageIndex(idx);
          galleryScrollRef.current?.scrollToOffset({
            offset: idx * dynWidth,
            animated: true,
          });
        } else {
          setExtraVariationImage(targetUrl);
          // Scroll happens in the useEffect on extraVariationImage so the
          // ScrollView has had a chance to render the appended page.
        }
      }
    };

    // Color variations render with images; Size (and any other type) render
    // as text-only buttons. Identify by the i18n-mapped key so the API's
    // raw type name (颜色 / 색상 / etc.) doesn't matter.
    const isColorVariation = i18nKey === 'color';
    const hasImages = variationType.options.some((opt: any) => opt.image);

    if (isColorVariation) {
      // Render first variation type with images (if available) and text
      return (
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>
            {displayName}
            {selectedValue ? ` : ${resolveText(selectedValue as unknown)}` : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {variationType.options.map((option: any, optIndex: number) => {
              const optResolved = resolveText(option.value as unknown);
              const selResolved =
                selectedValue != null ? resolveText(selectedValue as unknown) : '';
              const isSelected =
                selResolved !== '' && selResolved === optResolved;
              return (
                <TouchableOpacity
                  key={optIndex}
                  style={styles.colorOption}
                  onPress={() => handleSelect(option.value)}
                >

                  {option.image && (
                    <ColorSwatchImage uri={option.image} isSelected={isSelected} />
                  )}
                  <Text
                    style={[
                      styles.colorName,
                      isSelected && styles.selectedColorName,
                    ]}
                    numberOfLines={3}
                  >
                    {resolveText(option.value as unknown)}
                  </Text>
                </TouchableOpacity>
              );
              
            })}
          </ScrollView>
        </View>
      );
    } else {
      // Render other variation types (or first if no images) as text buttons
      return (
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>
            {displayName}
            {selectedValue ? ` : ${resolveText(selectedValue as unknown)}` : ''}
          </Text>
          <View style={styles.sizeGrid}>
            {variationType.options.map((option: any, optIndex: number) => {
              const optResolved = resolveText(option.value as unknown);
              const selResolved =
                selectedValue != null ? resolveText(selectedValue as unknown) : '';
              const isSelected =
                selResolved !== '' && selResolved === optResolved;
              return (
                <TouchableOpacity
                  key={optIndex}
                  style={[
                    styles.sizeOption,
                    isSelected && styles.selectedSizeOption,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.sizeText,
                      isSelected && styles.selectedSizeText,
                    ]}
                  >
                    {resolveText(option.value as unknown)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }
  };

  const renderAllVariations = () => {
    const variationTypes = getVariationTypes();

    if (variationTypes.length === 0) {
      return null;
    }

    // Sort so Color always renders above Size. Other variation types keep
    // their original API order, after Color and before Size.
    const COLOR_NAMES = new Set(['color', 'colour', '颜色', '色彩', '色', '색상', '색깔', '컬러']);
    const SIZE_NAMES = new Set(['size', '尺码', '尺寸', '사이즈', '크기']);
    const rank = (name: string) => {
      const lower = name.toLowerCase();
      if (COLOR_NAMES.has(lower) || COLOR_NAMES.has(name)) return 0;
      if (SIZE_NAMES.has(lower) || SIZE_NAMES.has(name)) return 2;
      return 1;
    };
    const ordered = [...variationTypes].sort((a, b) => rank(a.name) - rank(b.name));

    return ordered.map((variationType, index) => (
      <View key={index} style={{ paddingBottom: SPACING.md }}>
        {renderVariationSelector(variationType)}
      </View>
    ));
  };

  const renderServiceCommitment = () => {
    return (
      <View style={styles.serviceCommitmentContainer}>
        <Text style={styles.serviceCommitmentTitle}>
          {t('product.serviceCommitment.title')}
        </Text>
        {/* Choice line at the top */}
        <View style={styles.serviceCommitmentChoice}>
          <Text style={styles.serviceCommitmentChoiceText}>
            {t('product.serviceCommitment.choice')}
          </Text>
          <Text style={styles.serviceCommitmentChoiceContent}>
            {t('product.serviceCommitment.choiceContent')}
          </Text>
        </View>
        
        {/* Title and contents */}
        <View style={styles.serviceCommitmentContent}>
          <View style={styles.serviceCommitmentContentHeader}>
            <View style={styles.serviceCommitmentContentHeaderLeft}>
              <DeliveryIcon width={20} height={20} color={COLORS.text.red} />
              <Text style={styles.serviceCommitmentContentTitle}>
                {t('product.serviceCommitment.title')}
              </Text>
            </View>
            <View style={styles.serviceCommitmentContentHeaderRight}>
              <ArrowRightIcon width={10} height={10} color={COLORS.black} />
            </View>
          </View>
          <View style={styles.serviceCommitmentContentSeparator} >
            <Text style={styles.serviceCommitmentText}>
              Delivery:
            </Text>
            <Text style={[styles.serviceCommitmentText, { fontWeight: '800' }]}>
              Dec 19 - 26
            </Text>
          </View>
          <Text style={[styles.serviceCommitmentText, { marginLeft: SPACING.lg }]}>
            Courier company:
          </Text>
        </View>
      </View>
    );
  };

  const renderSellerInfo = () => {
    // Get company name from product metadata or seller (may be { ko, en, zh } from API)
    const companyName = resolveText(
      (product as any).metadata?.original1688Data?.companyName ||
        product.seller?.name ||
        '',
    ) || 'Store';
    
    // Get seller rating
    const sellerRating = product.seller?.rating || 
                        (product as any).metadata?.original1688Data?.sellerDataInfo?.compositeServiceScore || 
                        '0';
    
    // Get sold count
    const soldCount = product.orderCount || product.reviewCount || 0;
    const soldText = soldCount >= 1000 
      ? `${Math.floor(soldCount / 1000)},${String(soldCount % 1000).padStart(3, '0')}+` 
      : `${soldCount}+`;
    
    return (
      <View style={styles.sellerInfoContainer}>
        <TouchableOpacity 
          style={styles.sellerHeader}
          onPress={() => {
            const sellerId = product.seller?.id || (product as any).sellerOpenId || '';
            const shopId = source === 'taobao' 
              ? (product.seller?.id || (product as any).shop_id || '')
              : sellerId;
            
            if (shopId) {
              navigation.navigate('SellerProfile', {
                sellerId: shopId,
                sellerName: companyName,
                source: source,
                country: country,
              });
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.sellerDetails}>
            <Text style={styles.sellerNameBold}>{companyName}</Text>
            <View style={styles.sellerStatsRow}>
              <View style={styles.sellerRatingContainer}>
                {(() => {
                  const r = typeof sellerRating === 'number' ? sellerRating : parseFloat(sellerRating) || 0;
                  const full = Math.floor(r);
                  const half = r % 1 >= 0.5;
                  const empty = 5 - full - (half ? 1 : 0);
                  const stars: React.ReactNode[] = [];
                  for (let i = 0; i < full; i++) stars.push(<StarIcon key={`sf-${i}`} width={16} height={16} color="#FF5500" />);
                  if (half) stars.push(<StarHalfIcon key="sh" width={16} height={16} color="#FF5500" />);
                  for (let i = 0; i < empty; i++) stars.push(<StarOutlineIcon key={`se-${i}`} width={16} height={16} color="#E0E0E0" />);
                  return stars;
                })()}
                <Text style={styles.sellerRatingText}>
                  {typeof sellerRating === 'number' ? sellerRating.toFixed(1) : sellerRating}
                </Text>
              </View>
              <Text style={styles.sellerSoldText}>| {soldText} sold</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.followButton, isStoreFollowed && styles.followButtonActive]}
          onPress={handleFollowStore}
          disabled={isFollowingStore || isStoreFollowed}
        >
          {isFollowingStore ? (
            <ActivityIndicator size="small" color={isStoreFollowed ? COLORS.text.primary : COLORS.white} />
          ) : (
            <>
              {!isStoreFollowed && <PlusIcon width={16} height={16} color={COLORS.white} />}
              <Text style={[styles.followButtonText, isStoreFollowed && styles.followButtonTextActive]}>
                {isStoreFollowed ? 'Following' : 'Follow'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };


  const renderReviews = () => (
    <View style={styles.reviewsContainer}>
      <View style={styles.reviewsHeader}>
        <Text style={styles.reviewsTitle}>{t('product.reviewsCount').replace('{count}', product.ratingCount || '5.5K')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Reviews', { productId })}>
          <Text style={styles.seeAllText}>{t('product.seeAll')}</Text>
        </TouchableOpacity>
      </View>

      {(product.reviews || []).slice(0, 2).map((review: any, index: number) => (
        <View key={review.id || `review-${index}`} style={styles.reviewItem}>
          <View style={styles.reviewHeader}>
            <Image
              source={{ uri: 'https://picsum.photos/seed/user/50/50' }}
              style={styles.reviewAvatar as any}
            />
            <View style={styles.reviewUserInfo}>
              <Text style={styles.reviewUserName}>{review.user || 'Artimus'}</Text>
              <View style={styles.reviewRating}>
                {[...Array(5)].map((_, i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={12}
                    color={i < (review.rating || 5) ? '#FFD700' : COLORS.gray[300]}
                  />
                ))}
              </View>
            </View>
          </View>
          <Text style={styles.reviewText}>
            {review.comment || 'This product is absolutely Great.'}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderProductDetails = () => {
    // Use product attributes from API (productAttribute with attributeNameTrans and valueTrans)
    const attributes = product.attributes || [];
    const { images: descriptionImages, plain: plainText } = descriptionHtmlDerived;

    // Return null if no attributes and no description
    if (attributes.length === 0 && !product.description) {
      return null;
    }

    const INITIAL_SPECS_COUNT = 5; // Show first 5 specifications initially
    const shouldShowReadMore = attributes.length > INITIAL_SPECS_COUNT;
    const displayedSpecs = showFullSpecifications
      ? attributes
      : attributes.slice(0, INITIAL_SPECS_COUNT);

    return (
      <View style={styles.detailsContainer}>
        {/* Header with title and report link */}
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>{t('product.productDetails')}</Text>
          <TouchableOpacity>
            <Text style={styles.reportItemText}>{t('product.reportItem')}</Text>
          </TouchableOpacity>
        </View>

        {/* Specifications Section */}
        {attributes.length > 0 && (
          <View style={styles.specificationsContainer}>
            <Text style={styles.sectionSubtitle}>{t('product.specifications')}{' >'}</Text>
            {displayedSpecs.map((attr: any, index: number) => (
              <View key={`${attr.name || 'spec'}-${index}`} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{resolveText(attr.name)}</Text>
                <Text style={styles.detailValue} numberOfLines={0}>{resolveText(attr.value)}</Text>
              </View>
            ))}
            {shouldShowReadMore && (
              <TouchableOpacity onPress={() => setShowFullSpecifications(!showFullSpecifications)}>
                <Text style={styles.readMoreText}>
                  {showFullSpecifications ? t('product.readLess') : t('product.readMore')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Product Description Section */}
        {product.description && (
          <>
            <View style={styles.htmlContentContainer}>
              {/* Display images from HTML description */}
              {descriptionImages.length > 0 && (
                <View style={styles.descriptionImagesContainer}>
                  {descriptionImages.map((imgUrl: string, index: number) => (
                    <Image
                      key={index}
                      source={{ uri: imgUrl }}
                      style={styles.descriptionImage as any}
                      resizeMode="contain"
                    />
                  ))}
                </View>
              )}

              {/* Display plain text description */}
              {plainText ? (
                <View style={styles.descriptionTextContainer}>
                  <Text style={styles.descriptionText} numberOfLines={3}>{plainText}</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderRelatedProducts = () => {
    // No loading spinner — items just appear when the API responds. The
    // first-page fetch is gated by detailFetched, and load-more pages are
    // pre-warmed in the cache, so the user almost always sees content
    // instead of a spinner.
    if (relatedProducts.length === 0) {
      return null;
    }

    return (
      <View style={styles.similarProductsContainer}>
        <Text style={styles.similarProductsTitle}>{t('home.moreToLove')}</Text>
        {(
          <FlatList
            data={relatedProducts}
            renderItem={({ item }) => {
              // Taobao case: show only image, name and price as requested
              if (selectedPlatform === 'taobao') {
                return (
                  <TouchableOpacity
                    style={styles.similarProductItem}
                    onPress={() => {
                      const productIdToUse = (item as any).offerId || item.id;
                      // Get source from product data, fallback to 'taobao' for Taobao-related products
                      const source = (item as any).source || 'taobao';
                      const country =
                        locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';
                      navigation.push('ProductDetail', {
                        productId: productIdToUse?.toString() || item.id?.toString() || '',
                        offerId: (item as any).offerId?.toString(),
                        source,
                        country,
                      });
                    }}
                  >
                    <View style={styles.simpleTaobaoCard}>
                      <TaobaoRelatedThumb
                        uri={(item as any).image}
                        thumbEdgePx={taobaoRelatedThumbEdge}
                      />
                      <Text
                        style={styles.simpleTaobaoTitle}
                        numberOfLines={2}
                      >
                        {resolveText((item as any).name)}
                      </Text>
                      <Text style={styles.simpleTaobaoPrice}>
                        ₩{Number((item as any).price || 0).toLocaleString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }

              // Default (1688 etc.) uses existing ProductCard
              return (
                <View style={[styles.similarProductItem, { width: pdpGridCardWidth }]}>
                  <ProductCard
                    product={item}
                    variant="moreToLove"
                    cardWidth={pdpGridCardWidth}
                    onPress={() => {
                      const productIdToUse = (item as any).offerId || item.id;
                      const source = (item as any).source || selectedPlatform || '1688';
                      const country =
                        locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en';
                      navigation.push('ProductDetail', {
                        productId: productIdToUse?.toString() || item.id?.toString() || '',
                        offerId: (item as any).offerId?.toString(),
                        source,
                        country,
                      });
                    }}
                    onLikePress={() => toggleWishlist(item)}
                    isLiked={isProductLiked(item)}
                  />
                </View>
              );
            }}
            keyExtractor={(item, index) => `related-${item.id?.toString() || (item as any).offerId?.toString() || index}-${index}`}
            key={`pdp-related-${pdpGridCols}`}
            numColumns={pdpGridCols}
            scrollEnabled={false}
            nestedScrollEnabled={true}
            columnWrapperStyle={styles.similarProductsGrid}
            removeClippedSubviews={true}
            maxToRenderPerBatch={4}
            windowSize={3}
            initialNumToRender={4}
            updateCellsBatchingPeriod={50}
          />
        )}
      </View>
    );
  };


  const renderSimilarProducts = () => {
    if (similarProducts.length === 0 && !similarProductsLoadingMore) {
      return null;
    }
    
    return (
    <View style={styles.similarProductsContainer}>
        <Text style={styles.similarProductsTitle}>{t('home.moretolove')}</Text>
        <FlatList
          key={`pdp-similar-${pdpGridCols}`}
          data={similarProducts}
          renderItem={renderSimilarProductItem}
          keyExtractor={similarProductsKeyExtractor}
          numColumns={pdpGridCols}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          columnWrapperStyle={styles.similarProductsGrid}
          onEndReached={loadMoreSimilarProducts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderSimilarProductsFooter}
          removeClippedSubviews={true}
          maxToRenderPerBatch={4}
          windowSize={3}
          initialNumToRender={4}
          updateCellsBatchingPeriod={50}
        />
    </View>
  );
  };

  const renderBottomBar = () => { 
    const companyName = (product as any).metadata?.original1688Data?.companyName || 
                        product.seller?.name || 
                        'Store';
    return(
    <View style={[styles.bottomBar, { paddingBottom: SPACING.lg + insets.bottom }]}>
      {/* Top row with quantity and cart icon */}
      <View style={styles.topActionRow}>
        {/* Quantity Selector */}
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(false)}
          >
            <MinusIcon width={18} height={18} color={COLORS.text.primary} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(true)}
          >
            <PlusIcon width={18} height={18} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Stock + min-order column shown next to the quantity selector. The
            stock value comes from the product detail API (stockCount /
            inStock); minOrderQuantity is a separate API field, displayed
            in a lighter weight as a secondary hint. */}
        {(() => {
          const stockCount: number = selectedStockInfo.stockCount;
          const inStock: boolean = selectedStockInfo.inStock;
          const minOrderQty: number = (product as any)?.minOrderQuantity ?? 1;
          return (
            <View style={styles.stockInfoColumn}>
              <Animated.Text
                style={[
                  styles.stockStatusText,
                  !inStock && styles.stockStatusOut,
                  { transform: [{ scale: stockPulse }], alignSelf: 'flex-start' },
                ]}
                numberOfLines={1}
              >
                {inStock
                  ? `${t('product.inStock')}: ${stockCount.toLocaleString()}`
                  : t('product.outOfStock')}
              </Animated.Text>
              <Text style={styles.minOrderText} numberOfLines={1}>
                {`${t('product.minOrder')}: ${minOrderQty.toLocaleString()}`}
              </Text>
            </View>
          );
        })()}

        {/* Camera Button */}
      </View>
      
      {/* Bottom row with main action buttons */}
      <View style={styles.mainActionRow}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: SPACING.sm}}>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => {
              if (route.params?.source === 'live-commerce' || route.params?.source === 'live') {
                const liveSellerId = (product as any)?.ownerSellerId || product?.seller?.id || '';
                const liveSellerName =
                  liveSellerInfo?.userName ||
                  liveSellerInfo?.nickname ||
                  liveSellerInfo?.sellerName ||
                  product?.metadata?.original1688Data?.companyName ||
                  product?.seller?.name ||
                  '';

                if (liveSellerId) {
                  navigation.navigate('LiveSellerDetail', {
                    sellerId: liveSellerId,
                    sellerName: liveSellerName,
                    source: 'ownmall',
                  });
                } else {
                  // Fallback: if we can't resolve the seller id from the product payload,
                  // keep the prior behavior.
                  navigation.navigate('FollowedStore' as never);
                }
                return;
              }
              const sellerId = product.seller?.id || (product as any).sellerOpenId || '';
              const shopId = source === 'taobao'
                ? (product.seller?.id || (product as any).shop_id || '')
                : sellerId;

              if (shopId) {
                navigation.navigate('SellerProfile', {
                  sellerId: shopId,
                  sellerName: companyName,
                  source: source,
                  country: country,
                });
              }
            }}
          >
            <SellerShopIcon width={30} height={30} color={COLORS.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.supportAgentButton}
            onPress={() => navigation.navigate('CustomerService')}
          >
            <SupportAgentIcon width={30} height={30} color={COLORS.text.primary} />
          </TouchableOpacity>        
          
          {/* Cart Icon Button */}
          <TouchableOpacity 
            style={styles.cartIconButton}
            onPress={() => toggleWishlist(product)}
          >
            {/* <Ionicons name="cart-outline" size={22} color={COLORS.text.primary} /> */}
            <HeartIcon 
              width={30} 
              height={30} 
              color={isLiked ? COLORS.red : COLORS.black} 
            />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row'}}>
          <TouchableOpacity
            style={[styles.addToCartButton, (!canAddToCart || isAddingToCart) && styles.disabledButton]}
            onPress={() => {
              // Pulse the stock badge on every press — gives the user
              // visual feedback even when the action is blocked (e.g. out
              // of stock or options not selected). The real mutation only
              // fires when canAddToCart is true and we're not already mid-add.
              pulseStock();
              if (!canAddToCart || isAddingToCart) return;
              handleAddToCart();
            }}
          >
            {/* <Ionicons name="cart-outline" size={18} color={COLORS.black} /> */}
            {isAddingToCart ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
                <ActivityIndicator size="small" color={COLORS.black} />
                <Text style={styles.addToCartText}>{t('product.addingToCart')}</Text>
              </View>
            ) : (
              <Text style={styles.addToCartText}>{t('product.addToCart')}</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.buyNowButton, (!canAddToCart || isAddingToCartForBuyNow) && styles.disabledButton]}
            onPress={() => {
              // Pulse the stock badge on every press — same as Add to Cart.
              pulseStock();
              if (isAddingToCartForBuyNow) return;
              if (!isAuthenticated) {
                // Login first for checkout; new accounts use 회원가입 (registration)
                // from Login. Same returnParams + autoBuyNow after auth.
                const persistedLiveCode =
                  getLiveCodeForCartPayload(routeSource, product, routeLiveCode, productId) || undefined;
                const returnParams = {
                  productId: (productId || offerId)?.toString?.() ?? String(productId || offerId || ''),
                  offerId: offerId?.toString?.(),
                  source: routeSource || sourceRef.current,
                  country: routeCountry || countryRef.current,
                  productData: product,
                  autoBuyNow: true,
                  ...(persistedLiveCode ? { liveCode: persistedLiveCode } : {}),
                };
                navigation.navigate('Auth', {
                  screen: 'Login',
                  params: {
                    returnTo: 'ProductDetail',
                    returnParams,
                  },
                } as never);
                return;
              }

              if (!canAddToCart) {
                const variationTypes = getVariationTypes();
                if (variationTypes.length > 0) {
                  // Variations exist but not all are picked yet.
                  showToast(t('product.pleaseSelectOptions'), 'warning');
                } else {
                  // No variations to pick — the block is stock/listing
                  // related (out-of-stock or seller-unlisted). Surface
                  // an explicit "unavailable" toast and stay on this
                  // page rather than navigating away.
                  showToast(t('product.outOfStock'), 'warning');
                }
                return;
              }

              // For Buy Now: Use handleAddToCart logic but with Buy Now mutation
              // Reuse the same logic from handleAddToCart
              handleBuyNow();
            }}
          >
            <Text style={styles.buyNowText}>{t('product.buyNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );}

  const renderImageViewer = () => {
    // Same image set as the gallery: API images + the appended variation
    // image (if any). Keeping the two lists identical means a tap on the
    // appended page opens the viewer at the same index.
    const apiImages = getApiProductImages(product);
    const images =
      extraVariationImage && !apiImages.includes(extraVariationImage)
        ? [...apiImages, extraVariationImage]
        : apiImages;

    return (
      <Modal
        visible={imageViewerVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <Icon name="close" size={32} color={COLORS.white} />
          </TouchableOpacity>

          {/* Image counter */}
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {viewerImageIndex + 1} / {images.length}
            </Text>
          </View>

          {/* Full screen image gallery — windowed list + CDN-sized assets */}
          <FlatList
            key={`viewer-${viewerImageIndex}-${images.length}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={images}
            initialScrollIndex={
              images.length > 0 ? Math.min(viewerImageIndex, images.length - 1) : 0
            }
            getItemLayout={(_, index) => ({
              length: dynWidth,
              offset: dynWidth * index,
              index,
            })}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews={Platform.OS === 'android'}
            keyExtractor={(_, index) => `fullscreen-${index}`}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / dynWidth);
              setViewerImageIndex(Math.min(Math.max(0, index), images.length - 1));
            }}
            renderItem={({ item: img }) => {
              const edge = Math.min(
                960,
                Math.max(480, Math.round(dynWidth * Math.min(PixelRatio.get(), 3))),
              );
              const uri = buildCdnThumbnailUri(img, edge, 70);
              return (
                <View style={[styles.fullScreenImageContainer, { width: dynWidth }]}>
                  <FastImage
                    source={{
                      uri,
                      priority: FastImage.priority.normal,
                      cache: FastImage.cacheControl.immutable,
                    }}
                    style={[styles.fullScreenImage as any, { width: dynWidth }]}
                    resizeMode={FastImage.resizeMode.contain}
                  />
                </View>
              );
            }}
          />
        </View>
      </Modal>
    );
  };

  // Post-login auto-add-to-cart flow: render a loading view INSTEAD of the
  // product detail UI so the user perceives the transition as
  // Auth → (brief loader) → cart success, without seeing the product page flash
  // in between. The auto-trigger useEffect above fires the addToCart API;
  // on success it navigates to Cart (which unmounts this screen); on error
  // the mutation's onError resets isAutoCartFlow so the user falls back to
  // the regular product detail view with the error toast.
  if (isAutoCartFlow) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.white,
          }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: SPACING.md, color: COLORS.text.primary }}>
            {t('product.addingToCart')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Absolutely positioned header overlays the image */}
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        {renderHeader()}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            // Height must match the overlaid header so the background
            // doesn't cover/underlap the system status bar area.
            height: headerPaddingTop,
            backgroundColor: COLORS.white,
            opacity: headerWhiteOpacity,
            zIndex: 0,
          }}
        />
        
      </SafeAreaView>

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 200 + insets.bottom }}
        scrollEventThrottle={64}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (e: any) => {
              // Trigger related-products pagination ~one viewport ahead so
              // the next page resolves from cache (pre-warmed on the
              // previous page's onSuccess) by the time the user gets here.
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent || {};
              if (!layoutMeasurement || !contentOffset || !contentSize) return;
              const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              const threshold = Math.max(600, layoutMeasurement.height);
              if (
                distanceFromBottom < threshold &&
                relatedProductsHasMore &&
                !relatedRecommendationsLoading &&
                !isLoadingMoreRelatedRef.current
              ) {
                const now = Date.now();
                if (now - scrollRelatedPrefetchAtRef.current < 220) return;
                scrollRelatedPrefetchAtRef.current = now;
                setRelatedProductsPage(prev => prev + 1);
              }
            },
          }
        )}
      >
        {renderImageGallery()}
        {renderProductInfo()}
        {/* {renderRatingRow()} */}
        {renderPriceRow()}
        {renderAllVariations()}
        {/* {renderServiceCommitment()} */}
        {renderSellerInfo()}
        {/* {renderReviews()} */}
        {belowFoldReady ? renderProductDetails() : null}
        {belowFoldReady ? renderRelatedProducts() : null}
        {/* {renderSimilarProducts()} */}
      </Animated.ScrollView>

      {renderBottomBar()}
      {renderImageViewer()}

      {/* Similar product image search modal */}
      {similarSearchVisible && (
        <ImageSearchResultsModal
          visible={similarSearchVisible}
          onClose={() => setSimilarSearchVisible(false)}
          imageUri={similarSearchUri}
          imageBase64={similarSearchBase64}
        />
      )}

      <PhotoCaptureModal
        visible={photoCaptureVisible}
        onClose={() => setPhotoCaptureVisible(false)}
        onConfirm={handlePhotoCaptureConfirm}
        product={{
          id: product.id,
          name: product.name,
          image: product.images?.[0] || product.image,
          price: product.price,
        }}
      />

      {/* Unfollow Confirmation Modal */}
      <Modal
        visible={showUnfollowModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnfollowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Unfollow</Text>
            <Text style={styles.modalMessage}>Are you sure you want to unfollow?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowUnfollowModal(false)}
                disabled={isFollowingStore}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={performUnfollowAction}
                disabled={isFollowingStore}
              >
                {isFollowingStore ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingTop: SPACING.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerCameraIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.sm,
  },
  searchButtonStyle: {
    // flex: 1,
    height: 40,
    marginRight: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  imageGalleryContainer: {
    position: 'relative',
  },
  productImage: {
    width: width,
    height: IMAGE_HEIGHT,
    backgroundColor: COLORS.gray[100],
  },
  imageIndicators: {
    position: 'absolute',
    bottom: SPACING.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    opacity: 0.5,
  },
  activeIndicator: {
    opacity: 1,
  },
  liveStatBadge: {
    position: 'absolute',
    bottom: 70,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    maxWidth: width - SPACING.md * 2,
  },
  liveStatIconContainer: {
    marginRight: SPACING.xs,
  },
  liveStatBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '500',
  },
  itemInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  itemInfoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  itemInfoSeparator: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[400],
    marginHorizontal: SPACING.sm,
  },
  reviewBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.smmd,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.small,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.yellow,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  reviewBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '600',
  },
  heartButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  heartButton: {
    padding: SPACING.xs,
    backgroundColor: '#00000066',
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.small,
  },
  wishlistCountText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '600',
    backgroundColor: '#FFFFFF33',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.small,
  },
  productInfoContainer: {
    padding: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  productName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },
  // Live-only seller mini-card rendered directly under the product title.
  liveSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  liveSellerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[200],
  },
  liveSellerTextWrap: {
    flex: 1,
  },
  liveSellerName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  liveSellerSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  discountBadgeInline: {
    backgroundColor: COLORS.red,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  discountBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  productCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightRed,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  productCodeBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.red,
    fontWeight: '600',
    marginRight: SPACING.xs,
  },
  // Secondary part-number row shown directly under the productCode
  // badge. Wraps the value text + copy button so the icon sits inline.
  // marginLeft matches the badge's paddingHorizontal so the first
  // characters of "상품코드" and "품번" align vertically.
  productPartNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  // Same red as the badge, 0.9× the badge font size.
  productPartNumberText: {
    fontSize: FONTS.sizes.sm * 0.9,
    color: COLORS.red,
    fontWeight: '500',
    marginRight: SPACING.xs,
  },
  copyIconButton: {
    padding: 2,
  },
  productDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  soldOutText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    marginLeft: SPACING.xs,
  },
  soldText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.red,
    marginRight: SPACING.sm,
  },
  pricePrimary: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
  },
  originalPrice: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray[500],
    textDecorationLine: 'line-through',
    marginRight: SPACING.sm,
  },
  originalPriceRight: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray[500],
    textDecorationLine: 'line-through',
    marginLeft: 'auto',
  },
  discountBadge: {
    backgroundColor: COLORS.red,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  discountText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  productCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  productCodeLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  productCodeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  copyButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  selectorContainer: {
    padding: SPACING.md,
    paddingBottom: 0,
  },
  selectorTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  colorOption: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  colorImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
  },
  selectedColorImage: {
    borderColor: COLORS.red,
    borderWidth: 3,
  },
  colorName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 80,
  },
  selectedColorName: {
    color: COLORS.red,
    fontWeight: '600',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sizeOption: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.white,
  },
  selectedSizeOption: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.white,
  },
  sizeText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  selectedSizeText: {
    color: COLORS.red,
    fontWeight: '600',
  },
  serviceCommitmentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderColor: COLORS.gray[100],
    marginTop: SPACING.md,
  },
  serviceCommitmentChoice: {
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#E1FEEE',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#0000000D',
  },
  serviceCommitmentChoiceText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '900',
    color: COLORS.white,
    backgroundColor: COLORS.text.red,
    padding: SPACING.sm,
    paddingVertical: 0,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: '#0000000D',
  },
  serviceCommitmentChoiceContent: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '900',
    color: COLORS.text.primary,
  },
  serviceCommitmentContent: {
    marginTop: SPACING.xs,
  },
  serviceCommitmentContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  serviceCommitmentContentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  serviceCommitmentContentHeaderRight: {
    alignItems: 'center',
  },
  serviceCommitmentContentSeparator: {
    marginLeft: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  serviceCommitmentContentTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  serviceCommitmentTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.red,
    marginBottom: SPACING.xs,
  },
  serviceCommitmentText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  sellerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 5,
    borderTopWidth: 5,
    borderColor: COLORS.gray[100],
    backgroundColor: COLORS.white,
  },
  sellerHeader: {
    flex: 1,
    marginRight: SPACING.md,
  },
  sellerDetails: {
    flex: 1,
    marginRight: SPACING.md,
  },
  sellerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerNameBold: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  sellerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sellerRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sellerRatingText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: SPACING.xs,
  },
  sellerSoldText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: '400',
  },
  sellerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  sellerStatsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.xs,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.text.primary,
    borderRadius: 20,
    gap: SPACING.xs,
    minWidth: 100,
  },
  followButtonActive: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
  },
  followButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  followButtonTextActive: {
    color: COLORS.text.primary,
  },
  reviewsContainer: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  reviewsTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  seeAllText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  reviewItem: {
    marginBottom: SPACING.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.sm,
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  detailsContainer: {
    padding: SPACING.lg,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  detailsTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  reportItemText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    color: COLORS.text.primary,
  },
  specificationsContainer: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  sectionSubtitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderColor: COLORS.gray[200],
  },
  detailLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.primary,
    width: '35%',
    height: '100%',
    marginRight: SPACING.md,
    borderRightWidth: 1,
    borderColor: COLORS.gray[200],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[50],
    textAlignVertical: 'center',
  },
  detailValue: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.primary,
    fontWeight: '400',
    height: '100%',
    width: '60%',
    flexWrap: 'wrap',
    textAlign: 'left',
    paddingVertical: SPACING.sm,
    textAlignVertical: 'center',
  },
  readMoreText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    textDecorationLine: 'underline',
    paddingHorizontal: SPACING.md,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderColor: COLORS.gray[200],
  },
  productImagesContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  productImagesTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  productDescriptionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  productDescriptionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  htmlContentContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
  },
  descriptionImagesContainer: {
    width: '100%',
    marginVertical: SPACING.md,
  },
  descriptionImage: {
    width: '100%',
    height: 300,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
  },
  descriptionTextContainer: {
    width: '100%',
  },
  descriptionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  similarProductsContainer: {
    padding: SPACING.sm,
  },
  similarProductsTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  similarProductsGrid: {
    justifyContent: 'flex-start',
    gap: SPACING.sm,
  },
  simpleTaobaoCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.sm,
    margin: SPACING.xs,
    ...SHADOWS.small,
  },
  simpleTaobaoImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  simpleTaobaoTitle: {
    fontSize: 12,
    color: COLORS.text.primary,
    marginTop: SPACING.xs,
  },
  simpleTaobaoPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  similarProductItem: {
    width: (width - SPACING.sm * 2 - SPACING.sm) / 2,
  },
  loadingMoreContainer: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  loadingMoreText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    ...SHADOWS.lg,
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  // Stock + min-order column shown to the right of the quantity selector.
  stockInfoColumn: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  stockStatusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  stockStatusOut: {
    color: COLORS.error,
  },
  minOrderText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    fontWeight: '400',
    marginTop: 2,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 3,
    ...SHADOWS.small,
  },
  quantityText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.lg,
    minWidth: 40,
    textAlign: 'center',
  },
  supportAgentButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartIconButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  // Add-to-cart and Buy-now share a fixed width so the two buttons
  // visually form one continuous pill (left half = white, right half =
  // red) of equal halves. The width comfortably fits "장바구니 담기"
  // at the current font size.
  addToCartButton: {
    width: 120,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.full, // Full round button
    borderBottomLeftRadius: BORDER_RADIUS.full, // Full round button
    borderWidth: 1,
    borderColor: '#00000033',
    // paddingVertical: SPACING.smmd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: 0.5,
    padding: SPACING.sm,
  },
  buyNowButton: {
    width: 120, // match addToCartButton for an equal-width pill
    backgroundColor: COLORS.red,
    borderTopRightRadius: BORDER_RADIUS.full, // Full round button
    borderBottomRightRadius: BORDER_RADIUS.full, // Full round button
    justifyContent: 'center',
    alignItems: 'center', // center "점 검" horizontally inside the wider button
    borderWidth: 1,
    borderColor: '#00000033',
  },
  buyNowText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
    // Wider letterSpacing so the two characters of "점검" render with a
    // visible gap between them ("점  검") — requested by the user. Other
    // labels keep their normal 0.5 spacing.
    letterSpacing: 6,
    padding: SPACING.sm,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: SPACING.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    position: 'absolute',
    top: 50,
    left: SPACING.lg,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  imageCounterText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  fullScreenImageContainer: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    width: width * 0.8,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray[500],
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FF5722',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default ProductDetailScreen;
