import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Animated,
  Alert,
  Platform,
  FlatList,
  PermissionsAndroid,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary, MediaType, ImagePickerResponse, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import RNFS from 'react-native-fs';
import FastImage from '@d11/react-native-fast-image';
import { requestCameraPermission, requestPhotoLibraryPermission } from '../../utils/permissions';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect, Mask, Circle } from 'react-native-svg';

// Create animated icon component
const AnimatedIcon = Animated.createAnimatedComponent(Icon);

import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, IMAGE_CONFIG, PAGINATION } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { RootStackParamList, Product, NewInProduct, Story, Carousel } from '../../types';

import { ProductCard, SearchButton, NotificationBadge, ImagePickerModal } from '../../components';
import { Banner } from '../../types';
import { useBannersMutation } from '../../hooks/useBannersMutation';
import { useCarouselsMutation } from '../../hooks/useCarouselsMutation';
import { useLiveCommerceMutation } from '../../hooks/useLiveCommerceMutation';
import BrandIcon from '../../assets/icons/BrandIcon';
import { usePlatformStore } from '../../store/platformStore';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';
import SellIcon from '../../assets/icons/SellIcon';
import SensorsIcon from '../../assets/icons/SensorsIcon';
import BoltIcon from '../../assets/icons/BoltIcon';
import StarsIcon from '../../assets/icons/StarsIcon';
import { useNewInProductsMutation } from '../../hooks/useNewInProductsMutation';
import { useRecommendationsMutation } from '../../hooks/useRecommendationsMutation';
import { useWishlistStatus } from '../../hooks/useWishlistStatus';
import { useAddToWishlistMutation } from '../../hooks/useAddToWishlistMutation';
import { useDeleteFromWishlistMutation } from '../../hooks/useDeleteFromWishlistMutation';
import { useSocket } from '../../context/SocketContext';
import { inquiryApi } from '../../services/inquiryApi';
import { useDefaultCategoriesMutation } from '../../hooks/useDefaultCategoriesMutation';
import { formatPriceKRW } from '../../utils/i18nHelpers';
import { getAlibabaThumbnailImageUri, buildCdnThumbnailUri } from '../../utils/productImage';
import { useResponsive } from '../../hooks/useResponsive';
import { invalidateHomeCache, prefetchRecommendations } from '../../utils/homePrefetch';
const LogoImage = require('../../assets/images/logo.png');

const { width: screenWidth } = Dimensions.get('window');
const width = screenWidth - SPACING.sm * 2; // Full width minus horizontal padding
// New In card sizing: 3 items per line, image should be less than 1/3 of mobile width
// Calculate: (width - left padding - right padding - 2 gaps) / 3
// Using smaller padding and gaps to ensure 3 items fit
const pagePadding = SPACING.sm * 2; // Left + right padding
const gaps = SPACING.xs * 2; // 2 gaps between 3 items
const NEW_IN_CARD_WIDTH = Math.floor((width - pagePadding - gaps) / 3);
const NEW_IN_CARD_HEIGHT = Math.floor(NEW_IN_CARD_WIDTH * 1.55);
const GRID_CARD_WIDTH = (width - SPACING.md * 2 - SPACING.md) / 2;

// Live channel (Today's Live Deals) carousel: card width so scroll is per-slide (not full screen)
const LIVE_CHANNEL_CARD_WIDTH = 163;

/**
 * Returns an array of `count` unique random indices in range [0, length).
 * Each index is valid for the given array length; no duplicates within the returned array.
 */
function getUniqueRandomIndices(length: number, count: number): number[] {
  if (length <= 0) return [];
  const n = Math.min(count, length);
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

// Banner marquee: constant-speed water-like flow (same speed regardless of text length)
const PIXELS_PER_SECOND = 35;

const BannerMarqueeText = ({
  title,
  textStyle,
  containerStyle,
  onDurationChange,
}: {
  title: string;
  textStyle: object;
  containerStyle: object;
  onDurationChange?: (durationMs: number) => void;
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const FLOW_START_DELAY_MS = 1200;
  const FLOW_END_DELAY_MS = 1000;
  const STATIC_BANNER_DURATION_MS = 4000;

  const displayTitle = title && String(title).trim() ? title : ' ';

  useEffect(() => {
    scrollAnim.stopAnimation();
    scrollAnim.setValue(0);

    if (containerWidth <= 0 || textWidth <= 0) {
      return;
    }

    const overflowWidth = Math.max(0, textWidth - containerWidth);
    if (overflowWidth <= 0) {
      onDurationChange?.(STATIC_BANNER_DURATION_MS);
      return;
    }

    const travelDistance = containerWidth + textWidth;
    scrollAnim.setValue(containerWidth);

    const flowDurationMs = Math.max(2500, (travelDistance / PIXELS_PER_SECOND) * 1000);
    const totalDurationMs = FLOW_START_DELAY_MS + flowDurationMs + FLOW_END_DELAY_MS;
    onDurationChange?.(totalDurationMs);

    const animation = Animated.sequence([
      Animated.delay(FLOW_START_DELAY_MS),
      Animated.timing(scrollAnim, {
        toValue: -textWidth,
        duration: flowDurationMs,
        useNativeDriver: true,
      }),
      Animated.delay(FLOW_END_DELAY_MS),
    ]);

    animation.start();

    return () => {
      scrollAnim.stopAnimation();
      scrollAnim.setValue(0);
    };
  }, [containerWidth, onDurationChange, scrollAnim, textWidth, title]);

  return (
    <View
      style={[containerStyle, { overflow: 'hidden' }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{ transform: [{ translateX: scrollAnim }] }}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        <Text style={textStyle} numberOfLines={1}>
          {displayTitle}
        </Text>
      </Animated.View>
    </View>
  );
};

const BannerTicker = React.memo(({
  banners,
  locale,
}: {
  banners: Banner[];
  locale: 'en' | 'ko' | 'zh';
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentBannerDuration, setCurrentBannerDuration] = useState(4000);
  const currentBanner = banners[currentIndex];

  const scrollToIndex = useCallback((nextIndex: number) => {
    setCurrentIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (banners.length <= 1) {
      return;
    }

    const timeout = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, currentBannerDuration);

    return () => clearTimeout(timeout);
  }, [banners.length, currentBannerDuration, currentIndex]);

  if (banners.length === 0) {
    return null;
  }

  const titleObj = (currentBanner as any)?.title;
  const bannerTitle = (typeof titleObj === 'string'
    ? titleObj
    : (titleObj && typeof titleObj === 'object'
        ? (titleObj[locale] ?? titleObj.en ?? titleObj.ko ?? titleObj.zh ?? 'Banner')
        : 'Banner')) || 'Banner';

  return (
    <View style={styles.bannerContainer}>
      <BrandIcon width={16} height={16} style={styles.bannerBrandIcon} />
      <View style={[styles.bannerWrapper, styles.bannerScroll, { flex: 1, paddingLeft: 30 }]}>
        <View style={styles.bannerPlaceholder}>
          <BannerMarqueeText
            key={`${currentIndex}-${bannerTitle}`}
            title={String(bannerTitle)}
            textStyle={styles.bannerTitle}
            containerStyle={styles.bannerTitleScroll}
            onDurationChange={setCurrentBannerDuration}
          />
                <TouchableOpacity
                  style={styles.bannerNextButton}
                  onPress={() => scrollToIndex((currentIndex + 1) % banners.length)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bannerNextButtonText}>→</Text>
                </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const AutoBrandCarousel = React.memo(({
  carousels,
  locale,
  widthOverride,
  heightOverride,
}: {
  carousels: Carousel[];
  locale: 'en' | 'ko' | 'zh';
  // When provided, the carousel sizes itself to this width instead of
  // the full screen width. Used by the landscape-tablet 3-column layout
  // where the carousel sits between the Live Channel card and the
  // Flash-Sale / Point promo column.
  widthOverride?: number;
  heightOverride?: number;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const dynWidth = widthOverride ?? (winWidth - SPACING.sm * 2);
  const isTablet = Math.min(winWidth, winHeight) >= 600;
  const brandImgHeight = heightOverride ?? (isTablet ? Math.round(dynWidth * 0.38) : 128);

  useEffect(() => {
    if (carousels.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % carousels.length;
        scrollRef.current?.scrollTo({ x: nextIndex * dynWidth, animated: true });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [carousels.length, dynWidth]);

  if (carousels.length === 0) {
    return (
      <View style={[styles.brandCarouselContainer, { minHeight: 150, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.sectionTitle}>{(translations[locale] as any)?.home?.loadingCarousels || 'Loading carousels...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.brandCarouselContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / dynWidth);
          setCurrentIndex(nextIndex);
        }}
        scrollEventThrottle={16}
      >
        {carousels.map((carousel, carouselIdx: number) => {
          // Pick the right asset for this device, falling back to whichever
          // one the API returned so a missing mobile/desktop variant doesn't
          // produce an empty <Image source={{ uri: '' }} /> on refresh.
          const rawImageUrl =
            (Platform.OS === 'ios' || winWidth < 600
              ? carousel.mobileImage || carousel.desktopImage
              : carousel.desktopImage || carousel.mobileImage) || '';
          // Ask the CDN (Cloudinary or Alibaba) for a thumbnail roughly the
          // size we render so the slide loads as fast as a More-to-Love
          // product card instead of fetching the full desktop/mobile image.
          // The longest edge we need is dynWidth (display width); request
          // pixel-density-aware size by capping at 2× device-independent px.
          const imageUrl = rawImageUrl
            ? buildCdnThumbnailUri(rawImageUrl, Math.min(800, Math.round(dynWidth * 2)), 60)
            : '';

          return (
            <TouchableOpacity
              key={carousel._id || `carousel-${carouselIdx}`}
              style={[styles.brandSlide, { width: dynWidth }]}
              activeOpacity={0.9}
            >
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={[styles.brandImage, { width: dynWidth, height: brandImgHeight }]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.brandImage, { width: dynWidth, height: brandImgHeight, backgroundColor: COLORS.background }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.brandPaginationContainerFixed}>
        <View style={styles.brandPaginationBottomContainer}>
          <View style={styles.brandPagination}>
            {carousels.map((_, dotIndex) => (
              <View
                key={`dot-${dotIndex}`}
                style={[
                  styles.liveDot,
                  currentIndex === dotIndex && styles.brandDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
});

const AutoLiveChannelSection = React.memo(({
  liveChannelPromoCards,
  navigation,
  liveChannelImages,
  selectedPlatform,
  locale,
  middleSlot,
}: {
  liveChannelPromoCards: Array<any>;
  navigation: any;
  liveChannelImages: any[];
  selectedPlatform: string;
  locale: 'en' | 'ko' | 'zh';
  // Optional content rendered between the Live Channel card and the
  // promo-cards column. Used in landscape-tablet layout to slot the
  // brand carousel into the middle, producing a single horizontal row of
  // [Live Channel | Brand Carousel | Flash-Sale + Point].
  middleSlot?: React.ReactNode;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isTablet = Math.min(winWidth, winHeight) >= 600;
  // True only when the device is a tablet AND currently held in landscape.
  // The promo-card images get a separate (larger) size tier for this case
  // because the cards themselves grow wide enough to leave the old
  // tablet-portrait image sizes looking tiny / leaving empty space.
  // Phones and tablet-portrait keep the existing sizes — see user request:
  // sizing change applies ONLY to tablet landscape.
  const isTabletLandscape = isTablet && winWidth > winHeight;
  const contentW = winWidth - SPACING.sm * 2;
  // 3-column landscape-tablet row: ratios fixed at user's request.
  //   Live Channel : Brand Carousel : Promo column = 19% : 54% : 17%
  // Live Channel becomes a perfect square (height = its own width); the
  // other two columns force their height to match for a unified row.
  const hasMiddle = !!middleSlot;
  const liveCardW = hasMiddle
    ? Math.floor(contentW * 0.19)
    : isTablet
      ? Math.floor(contentW * 0.42)
      : 163;
  const liveCardH = hasMiddle
    ? liveCardW // square
    : Math.round(liveCardW * (210 / 163));
  const middleSlotWidth = hasMiddle ? Math.floor(contentW * 0.54) : 0;
  const promoCardWidth = hasMiddle
    ? Math.floor(contentW * 0.17)
    : Math.max(contentW - liveCardW - SPACING.sm, 160);

  // For the 3-column landscape layout, each promo card lays its 3 product
  // images out in a single row of equal squares. Computed from the promo
  // card's own width minus inner padding and the two gaps between the
  // three images.
  const promoEqualImageSize = hasMiddle
    ? Math.max(
        32,
        Math.floor(
          (promoCardWidth - SPACING.sm * 2 - SPACING.xs * 2) / 3,
        ),
      )
    : 0;
  const promoBigImageSize = isTabletLandscape
    ? // Landscape tablet: bigger range so the price-tag image actually
      // fills the card. Cap at 360 to keep aspect ratio sensible on
      // ultra-wide displays.
      Math.max(220, Math.min(Math.floor(promoCardWidth * 0.45), 360))
    : isTablet
      ? Math.max(140, Math.min(Math.floor(promoCardWidth * 0.45), 200))
      : 85;
  const promoSmallImageSize = isTabletLandscape
    ? // Landscape tablet: bigger small images too so the top-row pair
      // matches the new big-image scale.
      Math.max(
        160,
        Math.min(
          Math.floor((promoCardWidth * 0.5 - SPACING.sm - SPACING.xs) / 2),
          220,
        ),
      )
    : isTablet
      ? Math.max(
          90,
          Math.min(
            // Each small image takes ~25% of the promo card width (minus gaps).
            Math.floor((promoCardWidth * 0.5 - SPACING.sm - SPACING.xs) / 2),
            130,
          ),
        )
      : 44;

  useEffect(() => {
    if (liveChannelImages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % liveChannelImages.length;
        scrollRef.current?.scrollTo({
          x: nextIndex * liveCardW,
          animated: true,
        });
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [liveChannelImages.length, liveCardW]);

  return (
    <View
      style={[
        styles.liveChannelContainer,
        // 3-column landscape row: distribute the leftover width into
        // FOUR equal gaps (left edge, between live and carousel,
        // between carousel and promo, right edge). The result is each
        // item sitting centered within its slice of the row — Live
        // Channel centered between the left edge and the carousel,
        // Promo centered between the carousel and the right edge.
        hasMiddle && { justifyContent: 'space-evenly', gap: 0 },
      ]}
    >
      <TouchableOpacity
        style={[styles.liveChannelCard, { width: liveCardW, height: liveCardH }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Live' as never)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.liveChannelImageCarousel}
          contentContainerStyle={{ width: liveChannelImages.length * liveCardW }}
        >
          {liveChannelImages.map((image, index) => (
            <View key={`live-bg-${index}`} style={{ width: liveCardW }}>
              <Image source={image} style={[styles.liveChannelBackgroundImage, { width: liveCardW, height: liveCardH }]} resizeMode="cover" />
            </View>
          ))}
        </ScrollView>

        <View style={styles.liveChannelContent}>
          <View style={styles.liveIconContainer}>
            <View style={styles.liveIcon}>
              <SensorsIcon width={14} height={10} color={COLORS.white} />
            </View>
            <Text style={styles.liveIconText}>{(translations[locale] as any)?.home?.liveChannel || 'LIVE CHANNEL'}</Text>
          </View>

          <View style={styles.livePaginationContainer}>
            <View style={styles.livePagination}>
              {liveChannelImages.map((_, dotIndex) => (
                <View
                  key={`live-dot-${dotIndex}`}
                  style={[
                    styles.liveDot,
                    currentIndex === dotIndex && styles.brandDotActive,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.liveChannelTextContainer}>
            <Text style={styles.liveChannelTitle}>{(translations[locale] as any)?.home?.todaysLive || "TODAY'S"}</Text>
            <Text style={styles.liveChannelSubtitle}>{(translations[locale] as any)?.home?.liveDeals || 'LIVE DEALS'}</Text>
            <TouchableOpacity
              style={styles.watchNowButton}
              onPress={() => navigation.navigate('Live' as never)}
            >
              <Text style={styles.watchNowButtonText}>{(translations[locale] as any)?.home?.watchNow || 'Watch Now'} {">"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Optional middle column for landscape-tablet layout: hosts the
          brand carousel between the Live Channel card and the promo
          stack so the three sections form a single horizontal row.
          Forced to liveCardH so all three columns share the same height. */}
      {middleSlot ? (
        <View style={{ width: middleSlotWidth, height: liveCardH }}>
          {middleSlot}
        </View>
      ) : null}

      <View
        style={[
          styles.promosRightStack,
          hasMiddle
            ? { width: promoCardWidth, height: liveCardH }
            : { flex: 1, width: undefined },
        ]}
      >
        {liveChannelPromoCards.map((card, cardIdx: number) => {
          const promoImages = Array.isArray(card?.images) ? card.images : [];
          const promoTopImages = promoImages.slice(0, 2).filter((img: unknown) => img != null);
          const promoThirdImage = promoImages[2];
          return (
          <TouchableOpacity
            key={card.id || `promo-${cardIdx}`}
            style={[styles.liveChannelPromoCard, { backgroundColor: COLORS.white }]}
            activeOpacity={0.85}
            onPress={() => {
              const pid = card.externalIds?.[0];
              if (card.ids?.[0] && pid != null) {
                navigation.navigate('ProductDetail', {
                  productId: pid,
                  source: selectedPlatform || '1688',
                  country: locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en',
                });
              }
            }}
          >
            <LinearGradient
              colors={[card.backgroundColor, COLORS.transparent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.liveChannelOverlay}
            />
            {hasMiddle ? (
              // ─── Landscape-tablet layout ───
              // Title row at the top (icon + title only — price moved
              // under each image), 3 equally-sized square images in a
              // single row below, with that image's own price label
              // directly underneath each one.
              <View style={{ flex: 1, padding: SPACING.sm }}>
                <View style={styles.promoCardTopRow}>
                  {card.id === 'flash-sale' ? (
                    <BoltIcon width={16} height={16} color="#327FE5" />
                  ) : card.id === 'points' ? (
                    <StarsIcon width={16} height={16} color="#FFB300" />
                  ) : null}
                  <Text style={styles.promoCardTitleSmall}>{card.title}</Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginTop: SPACING.xs,
                    flex: 1,
                  }}
                >
                  {[0, 1, 2].map((idx) => {
                    const img = promoImages[idx];
                    const itemPrice = (card as any).prices?.[idx] ?? card.price;
                    return (
                      <TouchableOpacity
                        key={`${card.id}-eq-${idx}`}
                        activeOpacity={0.7}
                        // Each image+price cell is a single tap target so
                        // the user can tap anywhere in that cell to open
                        // the matching product detail.
                        style={{ alignItems: 'center', width: promoEqualImageSize }}
                        onPress={() => {
                          const pid = card.externalIds?.[idx];
                          if (card.ids?.[idx] && pid != null) {
                            navigation.navigate('ProductDetail', {
                              productId: pid,
                              source: selectedPlatform || '1688',
                              country:
                                locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en',
                            });
                          }
                        }}
                      >
                        {img != null ? (
                          <Image
                            source={img}
                            style={{
                              width: promoEqualImageSize,
                              height: promoEqualImageSize,
                              borderRadius: BORDER_RADIUS.sm,
                            }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: promoEqualImageSize,
                              height: promoEqualImageSize,
                              borderRadius: BORDER_RADIUS.sm,
                              backgroundColor: COLORS.gray[200],
                            }}
                          />
                        )}
                        <Text
                          style={[
                            styles.promoCardPrice,
                            {
                              width: promoEqualImageSize,
                              marginTop: 2,
                              textAlign: 'center',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {itemPrice}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              // ─── Phone / tablet-portrait layout (unchanged) ───
              <View style={styles.promoCardTopRowContainer}>
                <View style={styles.promoCardTopRowIcon}>
                  <View style={styles.promoCardTopRow}>
                    {card.id === 'flash-sale' ? (
                      <BoltIcon width={16} height={16} color="#327FE5" />
                    ) : card.id === 'points' ? (
                      <StarsIcon width={16} height={16} color="#FFB300" />
                    ) : null}
                    <Text style={styles.promoCardTitleSmall}>{card.title}</Text>
                  </View>

                  <TouchableOpacity style={styles.promoCardImages} activeOpacity={0.7}>
                    {promoTopImages.map((img: any, idx: number) => (
                        <TouchableOpacity
                          key={`${card.id}-img-${idx}`}
                          activeOpacity={0.7}
                          onPress={() => {
                            const pid = card.externalIds?.[idx];
                            if (card.ids?.[idx] && pid != null) {
                              navigation.navigate('ProductDetail', {
                                productId: pid,
                                source: selectedPlatform || '1688',
                                country: locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en',
                              });
                            }
                          }}
                        >
                          <Image
                            source={img}
                            style={[
                              styles.promoCardSmallImage,
                              { width: promoSmallImageSize, height: promoSmallImageSize },
                            ]}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                    ))}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.promoCardPriceTag, { marginLeft: 'auto', marginRight: SPACING.sm, marginTop: SPACING.sm }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    const pid = card.externalIds?.[2];
                    if (card.ids?.[2] && pid != null) {
                      navigation.navigate('ProductDetail', {
                        productId: pid,
                        source: selectedPlatform || '1688',
                        country: locale === 'zh' ? 'zh' : locale === 'ko' ? 'ko' : 'en',
                      });
                    }
                  }}
                >
                  {promoThirdImage != null ? (
                  <Image
                    source={promoThirdImage}
                    style={[
                      styles.promoCardSmallImage,
                      { width: promoBigImageSize, height: promoBigImageSize },
                    ]}
                    resizeMode="cover"
                  />
                  ) : (
                  <View
                    style={[
                      styles.promoCardSmallImage,
                      { width: promoBigImageSize, height: promoBigImageSize, backgroundColor: COLORS.gray[200] },
                    ]}
                  />
                  )}
                  <Text style={[styles.promoCardPrice, { width: promoBigImageSize }]}>{card.price}</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { screenWidth: dynScreenWidth, contentWidth: dynContentWidth, isTablet, isLandscape, moreToLoveColumns, gridCardWidth: dynGridCardWidth } = useResponsive();
  // True only on tablet held in landscape — used to switch the three
  // deal blocks (Live Hot / Today's Hot Deals / Best Sellers) from a
  // vertical stack into a single horizontal row, with proportionally
  // smaller cards inside so each block fits within ~1/3 of the screen.
  const isTabletLandscape = isTablet && isLandscape;

  // Recompute dealsCardWidth to match the actual todaysDealsProductsRow
  // style (paddingHorizontal: SPACING.sm + gap: SPACING.sm between 2
  // cards). On landscape tablet we additionally divide by 3 (one column
  // per deal block) so cards stay reasonably sized when the three blocks
  // sit side-by-side. Phones and tablet-portrait keep the original
  // half-screen sizing.
  const dynDealsCardWidth = isTabletLandscape
    ? Math.floor(
        ((dynScreenWidth - SPACING.md * 2 - SPACING.sm * 2) / 3 -
          SPACING.sm * 3) /
          2,
      )
    : Math.floor((dynScreenWidth - SPACING.sm * 3) / 2);
  
  // today's deals category state (used for highlighting)
  const [selectedCategory, setSelectedCategory] = useState<string>('todaysDeals');

  
  const { user, isGuest } = useAuth();
  
  // import icon locally to avoid circular deps

  const { showToast } = useToast();
  
  // Use wishlist status hook to check if products are liked based on external IDs
  const { isProductLiked, refreshExternalIds, addExternalId, removeExternalId } = useWishlistStatus();
  
  // Get locale and platform
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';
  const { selectedPlatform, setSelectedPlatform } = usePlatformStore();
  
  // Add to wishlist mutation
  const { mutate: addToWishlist } = useAddToWishlistMutation({
    onSuccess: async (data) => {
      showToast(t('home.productAddedToWishlist'), 'success');
      // Immediately refresh external IDs to update heart icon color
      await refreshExternalIds();
    },
    onError: (error) => {
      showToast(error || t('home.failedToAddToWishlist'), 'error');
    },
  });

  // Delete from wishlist mutation
  const { mutate: deleteFromWishlist } = useDeleteFromWishlistMutation({
    onSuccess: async (data) => {
      showToast(t('home.productRemovedFromWishlist'), 'success');
      // Immediately update external IDs to update heart icon color
      await refreshExternalIds();
    },
    onError: (error) => {
      showToast(error || t('home.failedToRemoveFromWishlist'), 'error');
    },
  });
  
  // Toggle wishlist function
  const toggleWishlist = async (product: any) => {
    if (!user || isGuest) {
      showToast(t('home.pleaseLogin') || 'Please login first', 'warning');
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
      const imageUrl = getAlibabaThumbnailImageUri(product) || '';
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
  
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [newInGridProducts, setNewInGridProducts] = useState<any[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<any[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [initialLoading, setInitialLoading] = useState(true); // New state for initial loading
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { unreadCount: socketUnreadCount, onUnreadCountUpdated } = useSocket(); // Get total unread count from socket context
  const [unreadCount, setUnreadCount] = useState(0); // Local state for unread count (from REST API)
  const [activeCategoryTab, setActiveCategoryTab] = useState('Woman');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const platforms = ['1688', 'taobao', 'myCompany'];
  
  // Fetch unread counts from REST API when screen comes into focus (throttled)
  const unreadCountRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const FETCH_THROTTLE_MS = 30000; // Only fetch every 30 seconds

  // Layout-first paint: render the structural layout immediately on mount and
  // defer the heavy "More to Love" recommendations grid to the next frame so
  // the user sees the page composition first; images stream in afterwards.
  // Uses requestAnimationFrame (16ms guarantee) instead of InteractionManager
  // (which previously caused fetches to never fire — see ProductDetailScreen).
  const [showHeavyContent, setShowHeavyContent] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShowHeavyContent(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) {
        // Use cached value if recently fetched
        setUnreadCount(unreadCountRef.current);
        return;
      }

      const fetchUnreadCounts = async () => {
        try {
          lastFetchTimeRef.current = now;
          const response = await inquiryApi.getUnreadCounts();
          if (response.success && response.data) {
            unreadCountRef.current = response.data.totalUnread;
            setUnreadCount(response.data.totalUnread);
          }
        } catch (error) {
          // Failed to fetch unread counts - use cached value
          setUnreadCount(unreadCountRef.current);
        }
      };
      fetchUnreadCounts();
    }, []) // Remove onUnreadCountUpdated dependency to prevent frequent calls
  );
  
  // Update unread count from socket events (real-time updates)
  useEffect(() => {
    setUnreadCount(socketUnreadCount);
  }, [socketUnreadCount]);
  
  // Get categories for selected platform (using store instead)
  const getCompanyCategories = () => {
    // Mock data removed - using store instead
    return [];
  };
  
  // removed duplicate definition above
  // const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [useMockData, setUseMockData] = useState(false); // Use API data instead of mock data
  const [imagePickerModalVisible, setImagePickerModalVisible] = useState(false);

  // Recommendations state for "More to Love"
  const [recommendationsProducts, setRecommendationsProducts] = useState<Product[]>([]);
  const [recommendationsOffset, setRecommendationsOffset] = useState(1); // Current page offset
  const [recommendationsHasMore, setRecommendationsHasMore] = useState(true); // Whether more products exist
  const fetchRecommendationsRef = useRef<((country: string, outMemberId?: string, beginPage?: number, pageSize?: number, platform?: string) => Promise<void>) | null>(null);
  const hasInitialFetchRef = useRef<string | null>(null); // Track locale+user combination for initial fetch
  const isRecommendationsRefreshingRef = useRef(false); // Prevent loading during refresh
  const currentRecommendationsPageRef = useRef<number>(1); // Track current page for callbacks
  const isLoadingMoreRecommendationsRef = useRef(false); // Prevent multiple simultaneous loads
  
  // Default categories state
  const [defaultCategories, setDefaultCategories] = useState<any[]>([]);
  // NOTE: selectedCategory defined earlier above component body (for todays deals) is used to highlight the category row

  // banner data fetched from server
  const [banners, setBanners] = useState<Banner[]>([]);

  // carousel data fetched from server
  const [carousels, setCarousels] = useState<Carousel[]>([]);

  // live channel carousel state
  // Live channel background images from assets
  const liveChannelImages = [
    require('../../assets/images/deal1.png'),
    require('../../assets/images/deal2.png'),
    require('../../assets/images/deal3.png'),
    // require('../../assets/images/avatar.png'),
  ];
  // Debug: Log when recommendationsProducts changes (only in dev mode)
  useEffect(() => {
    if (__DEV__) {
      // console.log('More to Love - recommendationsProducts state changed, count:', recommendationsProducts.length);
      if (recommendationsProducts.length > 0) {
        // console.log('More to Love - First product in state:', recommendationsProducts[0]);
      }
    }
  }, [recommendationsProducts]);

  // Recommendations API mutation with infinite scroll support
  const { 
    mutate: fetchRecommendations, 
    isLoading: recommendationsLoading, 
    isError: recommendationsError 
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
          (productData as any).source = selectedPlatform;
          // Keep raw image-related fields so image resolver can resolve if `image` stays empty
          Object.assign(productData as any, {
            imageUrl: item.imageUrl,
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
          productData.image = getAlibabaThumbnailImageUri(productData) || '';
          
          return productData;
        });
        
        // Check pagination - if we got fewer products than the page size we
        // requested for this page, no more pages. First page asks for
        // FEED_INITIAL_PAGE_SIZE; subsequent pages ask for FEED_MORE_PAGE_SIZE.
        const requestedPageSize = currentPage === 1
          ? PAGINATION.FEED_INITIAL_PAGE_SIZE
          : PAGINATION.FEED_MORE_PAGE_SIZE;
        const hasMore = productsArray.length >= requestedPageSize;
        setRecommendationsHasMore(hasMore);

        // If it's the first page, replace products, otherwise append
        // Dedup by external/offer id when appending new pages — the
        // recommendations API can return the same product across pages and
        // duplicates would crash the FlatList with "two children with the
        // same key".
        const productKey = (p: Product): string =>
          ((p as any)?.offerId?.toString?.()) || ((p as any)?.externalId?.toString?.()) || (p?.id?.toString?.()) || '';
        if (currentPage === 1) {
          setRecommendationsProducts(mappedProducts);
        } else {
          setRecommendationsProducts(prev => {
            const seen = new Set(prev.map(productKey).filter(Boolean));
            const fresh = mappedProducts.filter((p: Product) => {
              const k = productKey(p);
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            return [...prev, ...fresh];
          });
        }

        // Pre-warm the NEXT page in the background so the next "load more"
        // resolves from the in-memory cache instead of waiting on the
        // network. Cache key includes beginPage, so this never collides
        // with the current page.
        if (hasMore) {
          const nextPage = currentPage + 1;
          const outMemberId = user?.id?.toString() || 'dferg0001';
          prefetchRecommendations(
            locale,
            outMemberId,
            nextPage,
            PAGINATION.FEED_MORE_PAGE_SIZE,
            '1688',
          ).catch(() => {
            // Best-effort warm-up; ignore failures.
          });
        }
      } else {
        // No products found
        if (currentPage === 1) {
          setRecommendationsProducts([]);
        }
        setRecommendationsHasMore(false);
      }
    },
    onError: (error) => {
      // Only log non-network errors to reduce console noise
      // Network errors are expected when offline and are already handled gracefully
      const isNetworkError = error?.includes('Network error') || error?.includes('connection');
      if (__DEV__ && !isNetworkError) {
        // Error logging in dev mode only
      }
      // Reset loading flag
      isLoadingMoreRecommendationsRef.current = false;
      const currentPage = currentRecommendationsPageRef.current;
      if (currentPage === 1) {
        setRecommendationsProducts([]);
      }
      setRecommendationsHasMore(false);
    },
  });

  // Store fetchRecommendations in ref to prevent dependency issues
  // Use useLayoutEffect to update ref synchronously before other effects run
  useLayoutEffect(() => {
    fetchRecommendationsRef.current = fetchRecommendations;
  }, [fetchRecommendations]);
  
  // Load more recommendations when offset changes (infinite scroll)
  useEffect(() => {
    // Prevent loading more data when refreshing or already loading
    if (isRecommendationsRefreshingRef.current || isLoadingMoreRecommendationsRef.current) {
      return;
    }
    
    if (recommendationsOffset > 1 && fetchRecommendationsRef.current && recommendationsHasMore) {
      isLoadingMoreRecommendationsRef.current = true;
      const outMemberId = user?.id?.toString() || 'dferg0001';
      const platform = '1688'; // Always use 1688 for More to Love products
      currentRecommendationsPageRef.current = recommendationsOffset;
      fetchRecommendationsRef.current(locale, outMemberId, recommendationsOffset, PAGINATION.FEED_MORE_PAGE_SIZE, platform)
        .finally(() => {
          isLoadingMoreRecommendationsRef.current = false;
        });
    }
  }, [recommendationsOffset, locale, user?.id, recommendationsHasMore]);
  
  const [isScrolled, setIsScrolled] = useState(false); // Track if scrolled past threshold
  
  // Update selected category when platform changes
  useEffect(() => {
    // Always default back to Today's Deals when platform switches
    setSelectedCategory('todaysDeals');
  }, [selectedPlatform]);
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const SCROLL_THRESHOLD = 5; // Very fast animated color change
  
  // State for scroll to top button
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = useRef(new Animated.Value(0)).current;
  
  // State for new "New In" products
  const [newInProducts, setNewInProducts] = useState<any[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<any>({});
  const newInScrollRef = useRef<ScrollView>(null);
  
  // Animation values for new in products
  const newInFadeAnim = useRef(new Animated.Value(0)).current;
  const newInScaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // New In Products API mutation
  const { 
    mutate: fetchNewInProducts, 
    isLoading: newInLoading, 
    isError: newInError 
  } = useNewInProductsMutation({
    onSuccess: (data) => {
      // if (__DEV__) {
      //   console.log('fetchNewInProducts onSuccess:', data);
      // }
      const apiData = data?.data || data; // Handle both response.data and direct data
      // console.log('apiData:', apiData);
      if (apiData && apiData.products && Array.isArray(apiData.products)) {
        setNewInProducts(apiData.products);
      }
      if (apiData && apiData.productsByCategory) {
        // if (__DEV__) {
        //   console.log('Setting productsByCategory:', apiData.productsByCategory);
        // }
        setProductsByCategory(apiData.productsByCategory);
      }
    },
    onError: (error) => {
      if (__DEV__) {
        console.log('fetchNewInProducts onError:', error);
      }
      showToast(error || t('home.failedToLoadNewProducts'), 'error');
    },
  });

  // Default categories API mutation
  const { 
    mutate: fetchDefaultCategories, 
    isLoading: isLoadingCategories 
  } = useDefaultCategoriesMutation({
    onSuccess: (data) => {
      if (data && data.categories && Array.isArray(data.categories)) {
        setDefaultCategories(data.categories);
      }
    },
    onError: (error) => {
      // Failed to fetch default categories
    },
  });
  
  // fetch banners once on mount
  const { mutate: fetchBanners } = useBannersMutation({
    onSuccess: (data) => {
      if (!data) return;
      // API may return array directly or { data: array } or { banners: array }
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
          ? (data as any).data
          : Array.isArray((data as any)?.banners)
            ? (data as any).banners
            : [];
      setBanners(list);
      // if (__DEV__) {
      //   console.log('Banners fetched successfully:', list);
      // }
    },
    onError: () => {
      // ignore for now
    },
  });

  // fetch banners once on mount (prevent re-runs)
  const bannersFetchedRef = useRef(false);
  useEffect(() => {
    if (!bannersFetchedRef.current) {
      bannersFetchedRef.current = true;
      fetchBanners();
    }
  }, []); // Empty dependency array - only run once on mount

  // fetch carousels once on mount
  const { mutate: fetchCarousels } = useCarouselsMutation({
    onSuccess: (data) => {
      // API returns object with `carousels` array
      if (__DEV__) {
        // console.log('Carousel API response:', data);
        // console.log('Carousels array:', data?.carousels);
      }
      if (data && Array.isArray(data.carousels)) {
        setCarousels(data.carousels);
      }
    },
    onError: (error) => {
      if (__DEV__) {
        console.log('Carousel API error:', error);
      }
    },
  });

  useEffect(() => {
    fetchCarousels();
  }, []);

  // Live commerce (hot items for Today's Deals)
  const { mutate: fetchLiveCommerce, data: liveCommerceData } = useLiveCommerceMutation();
  useEffect(() => {
    fetchLiveCommerce();
  }, []);

  // Translation function
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  // Map language codes to flag emojis
  const getLanguageFlag = (locale: string) => {
    const flags: { [key: string]: string } = {
      'en': '🇺🇸',
      'ko': '🇰🇷',
      'zh': '🇨🇳',
    };
    return flags[locale] || '🇺🇸';
  };

  const isFetchingProductDetail = false;

  // Helper function to navigate to product detail
  const navigateToProductDetail = async (
    productId: string | number,
    source: string = selectedPlatform,
    country: string = locale,
    productData?: Product,
  ) => {
    // Pass the card payload so ProductDetailScreen renders the image / title
    // / price instantly while it fetches the full detail in the background.
    navigation.navigate('ProductDetail', {
      productId: productId.toString(),
      source: source,
      country: country,
      productData,
    });
  };
  // Helper function to filter mock products by company and category
  const getFilteredMockProducts = (productType: 'newIn' | 'trending' | 'forYou') => {
    // Mock data removed - API removed
    return [];
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch new in products when platform or locale changes (throttled)
  const lastNewInFetchRef = useRef<{ platform: string; locale: string } | null>(null);
  useEffect(() => {
    if (selectedPlatform && locale) {
      const currentKey = { platform: selectedPlatform, locale };
      const lastKey = lastNewInFetchRef.current;
      
      // Only fetch if platform or locale actually changed
      if (!lastKey || lastKey.platform !== currentKey.platform || lastKey.locale !== currentKey.locale) {
        lastNewInFetchRef.current = currentKey;
        
        // For Taobao, still use 1688 API for "New In" products
        const platformForNewIn = selectedPlatform === 'taobao' ? '1688' : selectedPlatform;
        // For Chinese and Korean locales, use 'en' country code instead of 'zh' or 'ko'
        const countryCode = (locale === 'zh' || locale === 'ko') ? 'en' : locale;
        fetchNewInProducts(platformForNewIn, countryCode);
      }
    }
  }, [selectedPlatform, locale]);

  // Fetch default categories when platform changes (throttled)
  const lastCategoriesFetchRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedPlatform && selectedPlatform !== lastCategoriesFetchRef.current) {
      lastCategoriesFetchRef.current = selectedPlatform;
      fetchDefaultCategories(selectedPlatform, true);
    }
  }, [selectedPlatform]);

  // Fetch first page of recommendations on mount and when locale or user changes (throttled)
  const lastRecommendationsFetchRef = useRef<string | null>(null);
  useEffect(() => {
    if (locale && fetchRecommendationsRef.current) {
      const outMemberId = user?.id?.toString() || 'dferg0001';
      const platform = '1688'; // Always use 1688 for More to Love products
      const fetchKey = `${locale}-${outMemberId}-${platform}`;
      
      // Only fetch if locale or user actually changed
      if (fetchKey !== lastRecommendationsFetchRef.current) {
        lastRecommendationsFetchRef.current = fetchKey;
        // Reset pagination state
        setRecommendationsOffset(1);
        setRecommendationsHasMore(true);
        // Clear existing products BEFORE making the API call
        setRecommendationsProducts([]);
        // Fetch first page
        currentRecommendationsPageRef.current = 1;
        fetchRecommendationsRef.current(locale, outMemberId, 1, PAGINATION.FEED_INITIAL_PAGE_SIZE, platform);
      }
    }
    // Only depend on locale and user?.id - not selectedPlatform since we always use 1688
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, user?.id]);


  const loadData = async () => {
    try {
      // Set initial loading state
      if (initialLoading) {
        setLoading(true);
      }
      
      // Set empty stories for now
      setStories([]);
    } catch (error) {
      // Error loading home data
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Drop the splash-time cache so pull-to-refresh actually hits the network.
    invalidateHomeCache();
    // Reset throttle refs so the post-cache useEffects refire instead of
    // short-circuiting on unchanged platform/locale keys.
    lastNewInFetchRef.current = null;
    lastCategoriesFetchRef.current = null;
    lastRecommendationsFetchRef.current = null;
    bannersFetchedRef.current = false;
    // Reset recommendations pagination flags (but keep the existing list of
    // products on screen — clearing them flashed empty cards / blank image
    // boxes during the refresh window. The page-1 fetch below replaces the
    // list atomically when the new data lands).
    isRecommendationsRefreshingRef.current = true;
    setRecommendationsOffset(1);
    setRecommendationsHasMore(true);

    // Re-fire the home APIs in parallel.
    fetchBanners();
    fetchCarousels();
    fetchLiveCommerce();
    if (selectedPlatform) {
      const platformForNewIn = selectedPlatform === 'taobao' ? '1688' : selectedPlatform;
      const countryCode = (locale === 'zh' || locale === 'ko') ? 'en' : locale;
      fetchNewInProducts(platformForNewIn, countryCode);
      fetchDefaultCategories(selectedPlatform, true);
    }

    await loadData();

    // Reload recommendations first page
    if (fetchRecommendationsRef.current && locale) {
      const outMemberId = user?.id?.toString() || 'dferg0001';
      const platform = '1688'; // Always use 1688 for More to Love products
      currentRecommendationsPageRef.current = 1;
      await fetchRecommendationsRef.current(locale, outMemberId, 1, PAGINATION.FEED_INITIAL_PAGE_SIZE, platform);
    }

    isRecommendationsRefreshingRef.current = false;
    setRefreshing(false);
  };

  const handleProductPress = useCallback(
    async (product: Product) => {
      // For "more to love" products, use offerId if available
      const offerId = (product as any).externalId;
      const productIdToUse = offerId || product.id;
      // Get source from product data, fallback to selectedPlatform
      const source = (product as any).source || selectedPlatform || '1688';
      // Pass the product card payload so ProductDetailScreen can paint the
      // image/title/price immediately while the full detail fetches.
      await navigateToProductDetail(productIdToUse, source, locale, product);
    },
    [selectedPlatform, locale, navigateToProductDetail],
  );

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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
        Alert.alert(t('home.error'), response.errorMessage || t('home.failedToTakePhoto'));
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
            base64Data = await convertUriToBase64(response.assets[0].uri);
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
        Alert.alert(t('home.error'), response.errorMessage || t('home.failedToPickImage'));
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
            base64Data = await convertUriToBase64(response.assets[0].uri);
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

  // const handleAddToCart = (product: Product) => {
  //   // For home screen items, variation ID is 0
  //   // addToCart(product, 1, undefined, undefined, 0);
  // };

  const handleNewInProductPress = async (product: any) => {
    // For new in products, use externalId or id for navigation
    const productId = product.externalId || product.id?.toString() || product._id || '';
    const productPlatform = product.source || product.platform || selectedPlatform;
    await navigateToProductDetail(productId, productPlatform, locale);
  };

  const handleImageSearch = async () => {
    // Navigate to camera screen
    navigation.navigate('ImageSearchCamera' as never);
  };


  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" />
          {/* Top Row: Menu Button - Logo (Centered) - Notification Icon */}
          <View style={styles.headerTop}>
            <View style={styles.menuButtonContainer}>
              <TouchableOpacity
                style={styles.platformButton}
                onPress={() => {
                  // Open platform menu modal
                  // For now, just show the button - can add modal later if needed
                }}
              >
                <Image source={LogoImage} style={{ width: 40, height: 40 }} resizeMode="contain" />
              </TouchableOpacity>
            </View>
            <View style={styles.logoContainer}>
              <Text style={styles.logoTitle}>{t('home.logo')}</Text>
              <Text style={styles.logoText}>{t('home.logoText')}</Text>
            </View>
            {/* <View style={styles.headerIcons}>
              <TouchableOpacity 
                // style={styles.headerIcon}
                onPress={() => navigation.navigate('LanguageSettings' as never)}
              >
                <Text style={styles.flagText}>{getLanguageFlag(locale)}</Text>
              </TouchableOpacity>
              <NotificationBadge
                customIcon={<HeadsetMicIcon width={24} height={24} color={COLORS.text.primary} />}
                count={unreadCount}
                badgeColor={COLORS.red}
                onPress={() => {
                  navigation.navigate('CustomerService' as never);
                }}
              />
            </View> */}
          </View>
          {/* Search Button Row */}
          <View style={styles.searchButtonContainer}>
            <SearchButton
              placeholder={t('category.searchPlaceholder') || 'Search products...'}
              onPress={() => navigation.navigate('Search' as never)}
              onCameraPress={handleImageSearch}
              style={styles.searchButtonStyle}
              isHomepage={true}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderCategories = () => {
    // leave gap for banner by having simple return; banner rendered separately inside scroll view
    if (isLoadingCategories) {
      return (
        <View style={styles.categoriesContainer}>
          <Text style={styles.categoriesLoadingText}>{t('home.loading') || 'Loading...'}</Text>
        </View>
      );
    }

    if (!defaultCategories || defaultCategories.length === 0) {
      return null;
    }

    return (
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          {/* Today's Deals item always shows first and uses active color by default */}
          {(() => {
            const isTodaySelected = selectedCategory === 'todaysDeals';
            return (
              <TouchableOpacity
                key="todays-deals"
                style={[styles.categoryItem, isTodaySelected && styles.categoryItemActive]}
                onPress={() => {
                  setSelectedCategory('todaysDeals');
                  navigation.navigate('ProductDiscovery', {
                    categoryName: t('home.todaysDeals'),
                    categoryId: '',
                    subCategoryName: t('home.todaysDeals'),
                    source: selectedPlatform || '1688',
                  });
                }}
              >
                <SellIcon
                  width={16}
                  height={16}
                  color={isTodaySelected ? COLORS.red : COLORS.text.primary}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isTodaySelected && styles.categoryTextActive,
                    { marginLeft: SPACING.xs },
                  ]}
                >
                  {t('home.todaysDeals')}
                </Text>
              </TouchableOpacity>
            );
          })()}

          {defaultCategories.map((category, catIndex: number) => {
            const categoryName = category.name?.[locale] || category.name?.en || category.name || 'Category';
            const isActive = selectedCategory === categoryName;
            return (
              <TouchableOpacity
                key={category._id || category.externalId || `cat-${catIndex}`}
                style={[styles.categoryItem, isActive && styles.categoryItemActive]}
                onPress={() => {
                  setSelectedCategory(categoryName);
                  // Navigate to ProductDiscovery screen with category name as search word
                  navigation.navigate('ProductDiscovery', {
                    categoryName: categoryName,
                    categoryId: category._id || category.externalId,
                    subCategoryName: categoryName, // Use category name as search word
                    source: selectedPlatform || '1688',
                  });
                }}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{categoryName}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // Store category tab layouts for auto-scroll
  const categoryTabLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});
  const categoryScrollViewWidth = useRef(0);

  const renderNewInCards = () => {
    // Add a safety check to ensure products is an array
    if (!Array.isArray(newInProducts) || newInProducts.length === 0) {
      if (newInLoading) {
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.newIn')}</Text>
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t('home.loading')}</Text>
            </View>
          </View>
        );
      }
      return null;
    }
    
    // Group products into pages of 3 items each
    const itemsPerPage = 3;
    const pages: any[][] = [];
    for (let i = 0; i < newInProducts.length; i += itemsPerPage) {
      pages.push(newInProducts.slice(i, i + itemsPerPage));
    }
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.newIn')}</Text>
        <Animated.View
          style={{
            opacity: newInFadeAnim,
            transform: [{ scale: newInScaleAnim }],
          }}
        >
          <ScrollView 
            ref={newInScrollRef}
            horizontal 
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.newInContainer}
            scrollEventThrottle={16}
          >
          {pages.map((pageProducts, pageIndex) => (
            <View key={`page-${pageIndex}`} style={styles.newInPage}>
              {pageProducts.map((product: any, productIdx: number) => {
                // Use discount already calculated in mapping
                const price = product.price || 0;
                const originalPrice = product.originalPrice || price;
                const discount = product.discount || 0;
                
                // Convert to Product type
                const resolvedImg = getAlibabaThumbnailImageUri(product);
                const productData: Product = {
                  id: product.id?.toString() || product.externalId?.toString() || '',
                  externalId: product.externalId?.toString() || product.id?.toString() || '',
                  offerId: product.externalId?.toString() || product.id?.toString() || '',
                  name: product.name || '',
                  image: resolvedImg,
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
                  rating: product.rating || 0,
                  reviewCount: product.ratingCount || 0,
                  rating_count: product.ratingCount || 0,
                  inStock: true,
                  stockCount: 0,
                  tags: [],
                  isNew: true,
                  isFeatured: false,
                  isOnSale: discount > 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  orderCount: product.orderCount || 0,
                };
                
                // Preserve externalId and source for navigation
                if (product.externalId) {
                  (productData as any).offerId = product.externalId;
                }
                (productData as any).source = product.source || selectedPlatform;
                
                const handleLike = async () => {
                  if (!user || isGuest) {
                    Alert.alert('', t('home.pleaseLogin'));
                    return;
                  }
                  try {
                    await toggleWishlist(productData);
                  } catch (error) {
                    // Error toggling wishlist
                  }
                };
                
                return (
                  <View key={`newin-${product.id || `${pageIndex}-${productIdx}`}`} style={styles.newInCardWrapper}>
                    <TouchableOpacity
                      style={styles.newInCard}
                      onPress={() => handleNewInProductPress(product)}
                    >
                      <Image
                        source={resolvedImg ? { uri: resolvedImg } : undefined}
                        style={styles.newInImage}
                        resizeMode="cover"
                      />
                      {discount > 0 && (
                        <View style={styles.newInDiscountBadge}>
                          <Text style={styles.newInDiscountText}>-{discount}%</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.newInLikeButton}
                        onPress={handleLike}
                      >
                        <Icon
                          name={isProductLiked(productData) ? 'heart' : 'heart-outline'}
                          size={20}
                          color={isProductLiked(productData) ? COLORS.red : COLORS.white}
                        />
                      </TouchableOpacity>
                      <View style={styles.newInInfo}>
                        <Text style={styles.newInName} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <View style={styles.newInPriceContainer}>
                          {originalPrice > price && (
                            <Text style={styles.newInOriginalPrice}>{formatPriceKRW(originalPrice)}</Text>
                          )}
                          <Text style={styles.newInPrice}>{formatPriceKRW(price)}</Text>
                        </View>
                        {product.rating > 0 && (
                          <View style={styles.newInRating}>
                            <Icon name="star" size={12} color={COLORS.warning} />
                            <Text style={styles.newInRatingText}>
                              {product.rating.toFixed(1)} ({product.ratingCount || 0})
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  const slideWidth = screenWidth - SPACING.sm*2 ; // Total width minus horizontal padding and brand icon space

  const renderBanners = () => {
    return <BannerTicker banners={banners} locale={locale} />;
  };

  const renderBrandCarousel = () => {
    const carouselList = Array.isArray(carousels) && carousels.length > 0 ? carousels : [];
    return <AutoBrandCarousel carousels={carouselList} locale={locale} />;
  };
  // Unique random indices within array length; no duplicates per array (for promo cards + popular categories)
  const newInRandomIndices = useMemo(
    () => getUniqueRandomIndices(newInProducts?.length ?? 0, 8),
    [newInProducts?.length]
  );
  const recRandomIndices = useMemo(
    () => getUniqueRandomIndices(recommendationsProducts?.length ?? 0, 10),
    [recommendationsProducts?.length]
  );

  const homeGridPx = IMAGE_CONFIG.HOME_GRID_IMAGE_PIXEL;

  // Promo cards data (Flash Sale: newIn 2,3,4 + Points: newIn 5,6,7)
  const liveChannelPromoCards = [
    {
      id: 'flash-sale',
      title: t('home.flashSale'),
      backgroundColor: '#88DBFF',
      price: `₩${newInProducts?.[4]?.price ?? 0}`,
      // Per-image prices so the landscape-tablet promo card can show a
      // price under EACH of its three product thumbnails (matching the
      // ids/images/externalIds index order: 2, 3, 4).
      prices: [
        `₩${newInProducts?.[2]?.price ?? 0}`,
        `₩${newInProducts?.[3]?.price ?? 0}`,
        `₩${newInProducts?.[4]?.price ?? 0}`,
      ],
      images: [
        getAlibabaThumbnailImageUri(newInProducts?.[2], homeGridPx)
          ? { uri: getAlibabaThumbnailImageUri(newInProducts[2], homeGridPx)! }
          : require('../../assets/images/deal1.png'),
        getAlibabaThumbnailImageUri(newInProducts?.[3], homeGridPx)
          ? { uri: getAlibabaThumbnailImageUri(newInProducts[3], homeGridPx)! }
          : require('../../assets/images/deal2.png'),
        getAlibabaThumbnailImageUri(newInProducts?.[4], homeGridPx)
          ? { uri: getAlibabaThumbnailImageUri(newInProducts[4], homeGridPx)! }
          : require('../../assets/images/deal3.png'),
      ],
      ids: [newInProducts?.[2]?._id, newInProducts?.[3]?._id, newInProducts?.[4]?._id],
      externalIds: [newInProducts?.[2]?.externalId, newInProducts?.[3]?.externalId, newInProducts?.[4]?.externalId],
    },
    {
      id: 'points',
      title: t('home.points'),
      backgroundColor: '#FFF27D',
      price: `₩${newInProducts?.[7]?.price ?? 0}`,
      prices: [
        `₩${newInProducts?.[5]?.price ?? 0}`,
        `₩${newInProducts?.[6]?.price ?? 0}`,
        `₩${newInProducts?.[7]?.price ?? 0}`,
      ],
      images: [
        getAlibabaThumbnailImageUri(newInProducts?.[5], homeGridPx)
          ? { uri: getAlibabaThumbnailImageUri(newInProducts[5], homeGridPx)! }
          : require('../../assets/images/deal1.png'),
        getAlibabaThumbnailImageUri(newInProducts?.[6], homeGridPx)
          ? { uri: getAlibabaThumbnailImageUri(newInProducts[6], homeGridPx)! }
          : require('../../assets/images/deal2.png'),
        getAlibabaThumbnailImageUri(newInProducts?.[7], homeGridPx)
          ? { uri: getAlibabaThumbnailImageUri(newInProducts[7], homeGridPx)! }
          : require('../../assets/images/deal3.png'),
      ],
      ids: [newInProducts?.[5]?._id, newInProducts?.[6]?._id, newInProducts?.[7]?._id],
      externalIds: [newInProducts?.[5]?.externalId, newInProducts?.[6]?.externalId, newInProducts?.[7]?.externalId],
    },
  ];

  const renderLiveChannelSection = () => {
    console.log('liveChannelPromoCards', liveChannelPromoCards);
    // Landscape-tablet: slot the brand carousel into the middle so the row
    // becomes [Live Channel | Brand Carousel | Flash-Sale + Point]. The
    // standalone brand-carousel render in the main return is skipped in
    // this mode so the carousel doesn't appear twice. Width and height
    // mirror the values AutoLiveChannelSection computes internally so all
    // three columns line up at the same height (Live Channel is square).
    const carouselList = Array.isArray(carousels) && carousels.length > 0 ? carousels : [];
    const liveChannelContentW = dynScreenWidth - SPACING.sm * 2;
    const middleCarouselWidth = Math.floor(liveChannelContentW * 0.54);
    const middleCarouselHeight = Math.floor(liveChannelContentW * 0.19);
    return (
      <AutoLiveChannelSection
        liveChannelPromoCards={liveChannelPromoCards}
        navigation={navigation}
        liveChannelImages={liveChannelImages}
        selectedPlatform={selectedPlatform}
        locale={locale}
        middleSlot={
          isTabletLandscape && carouselList.length > 0 ? (
            <AutoBrandCarousel
              carousels={carouselList}
              locale={locale}
              widthOverride={middleCarouselWidth}
              heightOverride={middleCarouselHeight}
            />
          ) : null
        }
      />
    );
  };

  const renderPromoCards = () => {
    return (
      <View style={styles.promoCardsContainer}>
        {/* Live On Card */}
        <TouchableOpacity style={styles.promoCard} activeOpacity={0.9}>
          <Image
            source={{ uri: 'https://res.cloudinary.com/dkdt9sum4/image/upload/v1766567627/live_on_bg_tndc5g.jpg' }}
            style={styles.promoCardBackground}
            resizeMode="cover"
          />
          {/* Radial gradient overlay effect - Blue */}
          <View style={styles.promoCardGradientContainer}>
            <Svg width={width - SPACING.md * 2} height={280} style={StyleSheet.absoluteFillObject}>
              <Defs>
                <SvgRadialGradient id="redGradient" cx="20%" cy="25%" r="80%">
                  <Stop offset="0%" stopColor="#0048FF" stopOpacity="0" />
                  <Stop offset="30%" stopColor="#0048FF" stopOpacity="0.2" />
                  <Stop offset="60%" stopColor="#0048FF" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#0048FF" stopOpacity="0.8" />
                </SvgRadialGradient>
                <Mask id="redMask">
                  <Rect width="100%" height="100%" fill="white" />
                  <Rect 
                    x={SPACING.md} 
                    y={60} 
                    width={width - SPACING.md * 4} 
                    height={160} 
                    rx={BORDER_RADIUS.md} 
                    fill="black" 
                  />
                </Mask>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#redGradient)" mask="url(#redMask)" />
            </Svg>
          </View>
          {/* Inner rectangle - just border */}
          <View style={styles.promoCardInner} />
          {/* Content in outer rectangle */}
          <View style={styles.promoCardContent}>
            {/* Top row: Title and 3 dots */}
            <View style={styles.promoCardHeader}>
              <Text style={styles.promoCardTitle}>{t('home.liveOn')}</Text>
              <TouchableOpacity>
                <Icon name="ellipsis-horizontal" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            {/* Bottom row: Text and arrow button */}
            <View style={styles.promoCardFooter}>
              <Text style={styles.promoCardText}>{t('home.upTo50Off')}</Text>
              <TouchableOpacity style={styles.promoCardButton}>
                <Icon name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {/* Coupon Card */}
        <TouchableOpacity style={styles.promoCard} activeOpacity={0.9}>
          <Image
            source={{ uri: 'https://res.cloudinary.com/dkdt9sum4/image/upload/v1766567627/coupon_sy7qod.jpg' }}
            style={styles.promoCardBackground}
            resizeMode="cover"
          />
          {/* Radial gradient overlay effect - Red */}
          <View style={styles.promoCardGradientContainer}>
            <Svg width={width - SPACING.md * 2} height={280} style={StyleSheet.absoluteFillObject}>
              <Defs>
                <SvgRadialGradient id="redGradient" cx="20%" cy="25%" r="80%">
                  <Stop offset="0%" stopColor="#FB00FF" stopOpacity="0" />
                  <Stop offset="30%" stopColor="#FB00FF" stopOpacity="0" />
                  <Stop offset="60%" stopColor="#FB00FF" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#FB00FF" stopOpacity="0.6" />
                </SvgRadialGradient>
                <Mask id="redMask">
                  <Rect width="100%" height="100%" fill="white" />
                  <Rect 
                    x={SPACING.md} 
                    y={60} 
                    width={width - SPACING.md * 4} 
                    height={160} 
                    rx={BORDER_RADIUS.md} 
                    fill="black" 
                  />
                </Mask>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#redGradient)" mask="url(#redMask)" />
            </Svg>
          </View>
          {/* Inner rectangle - just border */}
          <View style={styles.promoCardInner} />
          {/* Content in outer rectangle */}
          <View style={styles.promoCardContent}>
            {/* Top row: Title and 3 dots */}
            <View style={styles.promoCardHeader}>
              <Text style={styles.promoCardTitle}>{t('home.coupon')}</Text>
              <TouchableOpacity>
                <Icon name="ellipsis-horizontal" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            {/* Bottom row: Text and arrow button */}
            <View style={styles.promoCardFooter}>
              <Text style={styles.promoCardText}>{t('home.upTo50Off')}</Text>
              <TouchableOpacity style={styles.promoCardButton}>
                <Icon name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Map live-commerce popularItem to Product (for navigation)
  const mapPopularItemToProduct = useCallback((item: any): Product => {
    const p = item.product;
    const name = p
      ? (locale === 'ko' ? (p.titleKo || p.titleEn || p.titleZh)
        : locale === 'zh' ? (p.titleZh || p.titleEn || p.titleKo)
        : (p.titleEn || p.titleKo || p.titleZh)) || ''
      : '';
    const price = p?.promotionPrice ?? p?.price ?? 0;
    const originalPrice = p?.price ?? 0;
    const discount = originalPrice > price && originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
    return {
      id: item.productId || p?.id || item.id || '',
      externalId: p?.offerId?.toString() || '',
      offerId: p?.offerId?.toString() || '',
      rating_count: item.reviewNumbers || 0,
      name: name || 'Product',
      description: '',
      image: getAlibabaThumbnailImageUri({ ...item, product: p }) || '',
      price: Number(price),
      originalPrice: originalPrice > 0 ? Number(originalPrice) : undefined,
      discount,
      category: { id: '', name: '', icon: '', image: '', subcategories: [] },
      subcategory: '',
      brand: '',
      seller: {
        id: item.seller?.id || '',
        name: item.seller?.nickname || '',
        avatar: item.seller?.picUrl || '',
        rating: 0, reviewCount: 0, isVerified: false, followersCount: 0, description: '', location: '', joinedDate: new Date(),
      },
      rating: item.reviewScore || 0,
      reviewCount: item.reviewNumbers || 0,
      inStock: true,
      stockCount: 0,
      tags: [],
      isNew: false,
      isFeatured: false,
      isOnSale: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }, [locale]);

  const renderTodaysDeals = () => {
    const popularItems = liveCommerceData?.popularItems;
    const hotItems = Array.isArray(popularItems) && popularItems.length > 0
      ? popularItems.slice(0, 2)
      : (newInProducts.length >= 10 ? [newInProducts[8], newInProducts[9]] : []);

    const todaysHotProducts = newInProducts.length >= 13
      ? [newInProducts[11], newInProducts[12]].filter(Boolean)
      : [];
    const bestSellerProducts = newInProducts.length >= 16
      ? [newInProducts[14], newInProducts[15]].filter(Boolean)
      : [];

    // Live Hot Item card: light blue gradient, "Live now" + sensor icon + point, image, avatar/name/views, name/price
    const renderLiveHotCard = (item: any, index: number) => {
      const p = item.product;
      const subject = item.subject;
      const subjectName = subject
        ? (locale === 'ko' ? (subject.ko || subject.en || subject.zh)
          : locale === 'zh' ? (subject.zh || subject.en || subject.ko)
          : (subject.en || subject.ko || subject.zh)) || ''
        : '';
      const productName = subjectName || (p
        ? (locale === 'ko' ? (p.titleKo || p.titleEn || p.titleZh)
          : locale === 'zh' ? (p.titleZh || p.titleEn || p.titleKo)
          : (p.titleEn || p.titleKo || p.titleZh)) || ''
        : (item.name || ''));
      const rawPrice = item.price ?? p?.promotionPrice ?? p?.price ?? 0;
      const price = typeof rawPrice === 'string' ? Number(rawPrice) || 0 : rawPrice;
      const totalViews = item.onlineViews || item.itemsSold || Number(item.soldOut) || 0;
      const productId = item.productId || p?.id || item._id || item.id || '';
      const sellerName = item.seller?.nickname || item.companyName || '';
      const sellerAvatarRaw = item.seller?.picUrl || '';
      const itemImageUri = getAlibabaThumbnailImageUri(item, homeGridPx);

      return (
        <TouchableOpacity
          key={item.id || productId || `live-hot-${index}`}
          style={[styles.todaysDealsProductWrap, { width: dynDealsCardWidth }]}
          activeOpacity={0.9}
          onPress={() => productId && navigateToProductDetail(productId, 'live-commerce', locale)}
        >
          <View style={[styles.liveHotUserRow, { width: dynDealsCardWidth }]}>
            {itemImageUri ? (
              <FastImage
                source={{ uri: itemImageUri, priority: FastImage.priority.normal }}
                style={[styles.liveHotImage, { width: dynDealsCardWidth, height: dynDealsCardWidth }]}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <Image
                source={require('../../assets/images/deal1.png')}
                style={[styles.liveHotImage, { width: dynDealsCardWidth, height: dynDealsCardWidth }]}
                resizeMode="cover"
              />
            )}
            <View style={[styles.liveHotLiveRow, { width: dynDealsCardWidth }]}>
              <View style={styles.liveHotLiveRowIconContainer}>
                <View style={styles.liveHotLiveRowIcon}>
                  <View style={styles.liveHotLiveRowIconInner}>
                    <SensorsIcon width={16} height={16} color="#FFDD00" />
                  </View>
                  <Text style={styles.liveHotLiveText}>{item.status === 'live' ? t('home.liveNow') : item.liveTitle || t('home.liveNow')}</Text>
                </View>
                <TouchableOpacity style={styles.liveHotPointBtn} onPress={() => {}}>
                  <Text style={styles.liveHotPointBtnText}>{t('home.point')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.liveHotLiveRowUserContainer}>
                <Image
                  source={
                    sellerAvatarRaw
                      ? { uri: getAlibabaThumbnailImageUri({ imageUrl: sellerAvatarRaw }, 64) }
                      : { uri: `https://via.placeholder.com/40?text=${(sellerName || 'S').charAt(0)}` }
                  }
                  style={styles.liveHotAvatar}
                />
                <View style={styles.liveHotUserNameContainer}>
                  <Text style={styles.liveHotUserName} numberOfLines={1}>{sellerName || t('home.seller')}</Text>
                  <Text style={styles.liveHotViews}>{t('home.totalViews')}: {totalViews.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </View>
          <Text style={[styles.liveHotProductName, { width: dynDealsCardWidth }]} numberOfLines={2}>{productName}</Text>
          <Text style={[styles.liveHotPrice, { width: dynDealsCardWidth }]}>{formatPriceKRW(price)}</Text>
        </TouchableOpacity>
      );
    };

    const renderDealProductCard = (product: Product, badgeSource: any) => {
      const dealImg = getAlibabaThumbnailImageUri(product, homeGridPx);
      return (
      <TouchableOpacity
        key={product.id || product.externalId}
        style={[styles.todaysDealsProductWrap, { width: dynDealsCardWidth }]}
        activeOpacity={0.9}
        onPress={() => handleProductPress(product)}
      >
        <View style={[styles.dealProductCard, { width: dynDealsCardWidth }]}>
          <View style={[styles.dealProductImageWrap, { width: dynDealsCardWidth }]}>
            {badgeSource && (
              <Image source={badgeSource} style={[styles.dealProductBadge, { width: dynDealsCardWidth }]} resizeMode="contain" />
            )}
            {dealImg ? (
              <FastImage
                source={{ uri: dealImg, priority: FastImage.priority.normal }}
                style={[styles.dealProductImage, { width: dynDealsCardWidth }]}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <Image
                source={require('../../assets/images/deal1.png')}
                style={[styles.dealProductImage, { width: dynDealsCardWidth }]}
                resizeMode="cover"
              />
            )}
          </View>
          <Text style={styles.dealProductName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.dealProductPrice}>{formatPriceKRW(product.price)}</Text>
        </View>
      </TouchableOpacity>
    );
    };

    const renderDealBlock = (title: string, subtitle: string, color: string, textColor: string, content: React.ReactNode) => {
      if (!content) return null;
      return (
        <View style={styles.todaysDealsBlock}>
          <Text style={[styles.todaysDealsBlockTitleContainer, {borderTopColor: color}]}></Text>
          <Text style={[styles.todaysDealsBlockTitle, {zIndex: 2}]}>{title}</Text>
          <Text style={[styles.todaysDealsBlockSubtitle, {color: textColor, zIndex: 2}]}>{subtitle}</Text>
          <View style={styles.todaysDealsProductsRow}>
            {content}
          </View>
        </View>
      );
    };

    const hasAny = hotItems.length > 0 || todaysHotProducts.length > 0 || bestSellerProducts.length > 0;
    if (!hasAny) return null;

    return (
      <View style={styles.todaysDealsContainer}>
        <Text style={styles.todaysDealsSectionTitle}>{t('home.todaysDealsSection')}</Text>
        {/* Landscape tablet: lay the three deal blocks side-by-side
            (each ~1/3 of the row width). Phones / tablet-portrait keep
            the existing vertical stack. */}
        <View style={isTabletLandscape ? styles.todaysDealsBlocksRow : undefined}>
          {hotItems.length > 0 && (
            <View
              style={[
                styles.todaysDealsBlock,
                isTabletLandscape && styles.todaysDealsBlockOneThird,
              ]}
            >
              <LinearGradient
                colors={['#D0E3FF', COLORS.transparent]}
                style={styles.liveHotCardGradient}
              />
              {renderDealBlock(
                t('home.liveHotItems'),
                t('home.liveHotItemsSub'),
                "#327FE5",
                "#4082D8",
                hotItems.map((item, idx) => renderLiveHotCard(item, idx))
              )}
            </View>
          )}
          {todaysHotProducts.length > 0 && (
            <View
              style={[
                styles.todaysDealsBlock,
                isTabletLandscape && styles.todaysDealsBlockOneThird,
              ]}
            >
              <LinearGradient
                colors={['#FFDACA', COLORS.transparent]}
                style={styles.liveHotCardGradient}
              />
              {renderDealBlock(
                t('home.todaysHotDeals'),
                t('home.todaysHotDealsSub'),
                '#FF0000',
                "#EB5656",
                todaysHotProducts.map((p) => renderDealProductCard(p, require('../../assets/images/welcomedeal.png')))
              )}
            </View>
          )}
          {bestSellerProducts.length > 0 && (
            <View
              style={[
                styles.todaysDealsBlock,
                isTabletLandscape && styles.todaysDealsBlockOneThird,
              ]}
            >
              <LinearGradient
                colors={['#FFF4B0', COLORS.transparent]}
                style={styles.liveHotCardGradient}
              />
              {renderDealBlock(
                t('home.bestSellers'),
                t('home.bestSellersSub'),
                '#FFB200',
                "#D9A324",
                bestSellerProducts.map((p) => renderDealProductCard(p, require('../../assets/images/bestseller.png')))
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPopularCategories = () => {
    // Use productsByCategory for popular categories
    const categoryKeys = Object.keys(productsByCategory || {});
    
    if (categoryKeys.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.popularCategories')}</Text>
          <Text>{t('home.loadingCategories')}</Text>
        </View>
      );
    }
    const popularCategories = categoryKeys.slice(0, 2).map((categoryKey, index) => {
      const categoryProducts = productsByCategory[categoryKey] || [];
      // if (__DEV__) {
      //   console.log(`Category ${categoryKey}:`, categoryProducts.length, 'products');
      // }
      return {
        title: categoryKey.replace('_', ' ').toUpperCase(), // Use category key as title
        items: categoryProducts.slice(0, 4).map((product: any) => {
          const uri = getAlibabaThumbnailImageUri(product);
          return {
            id: product._id || product.externalId || '',
            platform: product.platform || '1688',
            price: `₩${product.price}`,
            image: uri ? { uri } : undefined,
          };
        })
      };
    });

    // if (__DEV__) {
    //   console.log('popularCategories:', popularCategories);
    // }
      // { id: '2', platform: '1688', name: 'Taobao💄', categoryName: 'Beauty', image: require('../../assets/icons/taobao.png'), color: "#FFF6FF" },
      // { id: '3', platform: '1688', name: 'Vip🪀', categoryName: 'Toys', image: require('../../assets/icons/vip.png'), color: '#FFF8ED' },
      // { id: '4', platform: '1688', name: 'VVIC🌵', categoryName: 'Garden', image: require('../../assets/icons/vvic.png'), color: '#F5FFF5'},
      // { id: '5', platform: '1688', name: 'WSY👟', categoryName: 'Shoes', image: require('../../assets/icons/wsy.png'), color: '#F4F4F4' },
      // { id: '6', platform: '1688', name: 'Company mall🛋️', categoryName: 'Home', image: require('../../assets/icons/companymall.png'), color: '#F1FEFF' },
      // { id: '7', platform: '1688', name: 'Company mall🛋️', categoryName: 'Home', image: require('../../assets/icons/companymall.png'), color: '#F1FEFF' },
      // { id: '8', platform: '1688', name: 'Company mall🛋️', categoryName: 'Home', image: require('../../assets/icons/companymall.png'), color: '#F1FEFF' },
    // ];

    // Calculate width for 3 items per row
    const itemWidth = (width - SPACING.md * 2 - SPACING.sm * 2) / 3;

    return (
      <View style={styles.section}>
        <View style={styles.popularCategoriesTitle}>
          <Text style={styles.popularText}>{t('home.popular')}</Text>
          <Text style={styles.categoriesText}>{t('home.categories')}</Text>
          <Text style={styles.fireIcon}>🔥</Text>
        </View>
        <View style={styles.popularCategoriesContainer}>
          {popularCategories.map((item, index) => (
            <View key={item.title ?? `popular-cat-${index}`} style={styles.popularCategoriesSubContainer}>
              <Text style={[styles.categoriesText, {fontSize: FONTS.sizes.xs}]}>🔥{item.title}</Text>
              <View style={styles.popularCategoryImageContainer}>
                {item.items && item.items.length > 0 ? item.items.map((category, catIdx: number) => (
                  <TouchableOpacity
                    key={category.id || `cat-${index}-${catIdx}`}
                    style={[styles.popularCategoryItem]}
                    onPress={() => {
                      navigateToProductDetail(category.id, category.platform, locale);
                    }}
                  >              
                    <View style={styles.promoCardPriceTag}>
                      <Text style={styles.popularCategoryPlatform}>{category.platform}</Text>
                      {category.image && (
                        <Image
                          source={category.image}
                          style={[styles.promoCardSmallImage, {width: 85, height: 85}]}
                          resizeMode="cover"
                        />
                      )}
                      <Text style={styles.promoCardPrice}>{category.price}</Text>
                    </View>
                  </TouchableOpacity>
                )) : (
                  <Text>{t('home.noItemsIn').replace('{category}', item.title)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTrendingProducts = () => {
    // Use new in products from API
    const productsToShow = useMockData 
      ? getFilteredMockProducts('newIn')
      : newInProducts;
    
    if (!Array.isArray(productsToShow) || productsToShow.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.newIn')}</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trendingProductsContainer}
        >
          {productsToShow.map((product: any) => {
            if (!product || !product.id) {
              return null;
            }
            
            // Parse variation data if it exists
            let price = product.price || 0;
            const productImage = getAlibabaThumbnailImageUri(product);

            // Convert to Product type for display
            const productData: Product = {
              id: product.id.toString(),
              name: product.name,
              image: productImage,
              externalId: product.externalId?.toString() || '',
              offerId: product.offerId?.toString() || '',
              price: price,
              originalPrice: product.originalPrice,
              discount: product.discount,
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
              rating: product.rating || 0,
              reviewCount: product.ratingCount || 0,
              rating_count: product.ratingCount || 0,
              inStock: true,
              stockCount: 0,
              tags: [],
              isNew: true,
              isFeatured: false,
              isOnSale: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              orderCount: 0,
            };
            
            const handleLike = async () => {
              if (!user || isGuest) {
                Alert.alert('', t('home.pleaseLogin'));
                return;
              }
              try {
                await toggleWishlist(productData);
              } catch (error) {
                // Error toggling wishlist
              }
            };
            
            return (
              <ProductCard
                key={`newin-${product.id}`}
                product={productData}
                variant="newIn"
                onPress={() => handleNewInProductPress(product)}
                onLikePress={handleLike}
                isLiked={isProductLiked(productData)}
                showLikeButton={true}
                showDiscountBadge={true}
                showRating={true}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // Memoize products array to prevent unnecessary re-renders
  const memoizedRecommendationsProducts = useMemo(() => recommendationsProducts, [recommendationsProducts]);

  // Track wishlist changes for extraData - use a hash of liked product IDs in the current list
  // This is more efficient than recalculating for all products and only updates when relevant products change
  const wishlistExtraData = useMemo(() => {
    // Create a simple hash of liked product IDs in the current recommendations list
    // This will change when wishlist status of products in this list changes
    return memoizedRecommendationsProducts
      .filter(p => {
        const id = (p as any).offerId?.toString() || (p as any).externalId?.toString() || p.id?.toString() || '';
        return id && isProductLiked(p);
      })
      .map(p => {
        const id = (p as any).offerId?.toString() || (p as any).externalId?.toString() || p.id?.toString() || '';
        return id;
      })
      .sort()
      .join('|');
  }, [memoizedRecommendationsProducts, isProductLiked]);

  // Memoize render item for better performance
  const renderMoreToLoveItem = useCallback(({ item: product, index }: { item: Product; index: number }) => {
            if (!product || !product.id) {
              return null;
            }
            
            const handleLike = async () => {
              if (!user || isGuest) {
                Alert.alert('', t('home.pleaseLogin'));
                return;
              }
              try {
                await toggleWishlist(product);
              } catch (error) {
                // Error toggling wishlist
              }
            };
            return (
              <ProductCard
                key={`moretolove-${product.id || index}`}
                product={product}
                variant="moreToLove"
                cardWidth={dynGridCardWidth}
                onPress={() => handleProductPress(product)}
                onLikePress={handleLike}
                isLiked={isProductLiked(product)}
                showLikeButton={true}
                showDiscountBadge={true}
                showRating={true}
              />
            );
  }, [user, isGuest, toggleWishlist, handleProductPress, isProductLiked, dynGridCardWidth]);

  // Memoize keyExtractor for better performance
  const keyExtractorMoreToLove = useCallback((item: Product, index: number) => {
    const id = (item as any)?.offerId?.toString() || (item as any)?.externalId?.toString() || item?.id?.toString() || `index-${index}`;
    return `moretolove-${id}`;
  }, []);

  // Show a spinner + "Loading more..." while page N+1 is fetching. Even
  // though we pre-warm the next page in onSuccess, the warm-up isn't always
  // resolved by the time the user scrolls to the bottom — and on cache miss
  // / slow network the user otherwise sees nothing happening.
  const renderMoreToLoveFooter = useCallback(() => {
    if (!recommendationsLoading || memoizedRecommendationsProducts.length === 0) {
      return null;
    }
    return (
      <View style={styles.moreToLoveFooter}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.moreToLoveFooterText}>{t('home.loadingMore')}</Text>
      </View>
    );
  }, [recommendationsLoading, memoizedRecommendationsProducts.length, t]);

  const renderMoreToLove = () => {
    // Use memoized recommendations products
    const productsToDisplay = memoizedRecommendationsProducts;
    // Show loading state if fetching
    if (recommendationsLoading && productsToDisplay.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.moreToLove')}</Text>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('home.loading')}</Text>
          </View>
        </View>
      );
    }
    
    // Show error state if there's an error
    if (recommendationsError && productsToDisplay.length === 0) {
      return null; // Don't show error, just return null
    }
    
    if (!Array.isArray(productsToDisplay) || productsToDisplay.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.moreToLove')}</Text>
        <FlatList
          key={`moretolove-cols-${moreToLoveColumns}`}
          data={productsToDisplay}
          renderItem={renderMoreToLoveItem}
          keyExtractor={keyExtractorMoreToLove}
          numColumns={moreToLoveColumns}
          scrollEnabled={false}
          nestedScrollEnabled={true}
          columnWrapperStyle={styles.newInGridContainer}
          // Tightened virtualization settings: render fewer cards at once and
          // let Android drop off-screen cells from the view tree to keep memory
          // and decode cost down on long lists.
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={10}
          updateCellsBatchingPeriod={80}
          extraData={wishlistExtraData}
          ListFooterComponent={renderMoreToLoveFooter}
        />
      </View>
    );
  };

  // Handle scroll event to detect when user reaches the end
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        // Safety check for event
        if (!event || !event.nativeEvent) return;
        
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        
        // Safety checks for scroll properties
        if (!layoutMeasurement || !contentOffset || !contentSize) return;
        
        // Show/hide scroll to top button based on scroll position
        const scrollPosition = contentOffset.y;
        const scrollHeight = contentSize.height;
        const screenHeight = layoutMeasurement.height;
        
        // Update isScrolled state based on threshold
        if (scrollPosition > SCROLL_THRESHOLD && !isScrolled) {
          setIsScrolled(true);
        } else if (scrollPosition <= SCROLL_THRESHOLD && isScrolled) {
          setIsScrolled(false);
        }
        
        // Trigger the next page well before the user actually reaches the
        // bottom (~one viewport ahead) so the swap to the new items feels
        // instant. Combined with the page-N+1 pre-warm in onSuccess, the
        // request usually resolves from cache by the time we get here.
        const distanceFromBottom = scrollHeight - scrollPosition - screenHeight;
        const loadMoreThreshold = Math.max(600, screenHeight);
        if (distanceFromBottom < loadMoreThreshold && recommendationsHasMore && !recommendationsLoading && !isRecommendationsRefreshingRef.current && !isLoadingMoreRecommendationsRef.current) {
          // Trigger loading more recommendations
          setRecommendationsOffset(prev => prev + 1);
        }
        
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
        
      }
    }
  );

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>{t('home.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.red, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBackgroundFixed}
        pointerEvents="none"
      />
      <View style={styles.fixedTopBars}>
        {renderHeader()}
        {renderCategories()}
        {/* {renderCategoryTabs()} */}
        {renderBanners()}
      </View>
      
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <View style={styles.contentWrapper}>
          {/* {renderQuickCategories()} */}
          {/* Heavy image-bearing sections (brand carousel, live channels,
              today's deals, more-to-love) all defer to the next frame so
              that on first paint the user sees the page structure (header,
              categories, banner ticker) immediately. Images stream in on
              the second frame. */}
          {/* Brand carousel: full-width in phone / tablet-portrait;
              skipped here in tablet-landscape because it's slotted into
              the middle of the Live Channel section so the row reads
              [Live Channel | Brand Carousel | Flash-Sale + Point]. */}
          {showHeavyContent && !isTabletLandscape && renderBrandCarousel()}
          {showHeavyContent && renderLiveChannelSection()}
          {/* {renderTrendingProducts()} */}
          {/* {renderPopularCategories()} */}
          {/* {renderPromoCards()} */}
          {showHeavyContent && renderTodaysDeals()}
          {/* {renderNewInCards()} */}
          {showHeavyContent && renderMoreToLove()}
        </View>
      </Animated.ScrollView>
      
      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <Animated.View
          style={[
            styles.scrollToTopButton,
            { opacity: scrollToTopOpacity }
          ]}
        >
          <TouchableOpacity
            onPress={scrollToTop}
            style={styles.scrollToTopTouchable}
            activeOpacity={0.8}
          >
            <Icon name="chevron-up" size={28} color={COLORS.black} />
          </TouchableOpacity>
        </Animated.View>
      )}
      
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
    backgroundColor: COLORS.background,
  },
  gradientBackgroundFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 650, // Shorter gradient coverage
    zIndex: 0,
  },
  gradientFill: {
    flex: 1,
  },
  scrollView: {
    // flex: 1,
    minHeight: '100%',
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  fixedTopBars: {
    backgroundColor: 'transparent',
    zIndex: 10,
    // marginBottom: -80,
  },
  headerPlaceholder: {
    backgroundColor: COLORS.white,
  },
  contentWrapper: {
    backgroundColor: 'transparent',
    // minHeight: '100%',
    marginBottom: 150,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    fontWeight: '500',
    marginTop: SPACING.md,
  },
  header: {
    zIndex: 10,
    paddingHorizontal: SPACING.sm,
    paddingTop: Platform.OS === 'ios' ? 30 : 20,
    paddingBottom: SPACING.sm,
  },
  headerContent: {
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: SPACING.sm,
  },
  menuButtonContainer: {
    // width: 80, // Fixed width to balance with right side
    alignItems: 'flex-start',
  },
  logoContainer: {
    // flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    // minHeight: 40, // Ensure minimum height to prevent disappearing
    // minWidth: 120, // Ensure minimum width to prevent disappearing
  },
  appName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  logo: {
    width: 120,
    height: 40,
    minWidth: 120, // Ensure minimum width
    minHeight: 40, // Ensure minimum height
  },
  headerPlatformMenu: {
    marginLeft: SPACING.md,
  },
  headerSpacer: {
    flex: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    padding: SPACING.xs,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    height: 36,
  },
  flagText: {
    fontSize: 24,
  },
  searchButtonContainer: {
    width: '100%',
    flexDirection: 'row',
  },
  searchButtonStyle: {
    flex: 1,
  },
  iconButton: {
    padding: SPACING.xs,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  platformButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
  },
  logoTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '900',
    color: COLORS.white,
  },
  logoText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    color: COLORS.white,
  },
  categoryTabsContainer: {
    backgroundColor: 'transparent',
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
    zIndex: 9,
  },
  categoryTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  categoryScrollView: {
    flex: 1,
  },
  categoryTabs: {
    paddingHorizontal: SPACING.sm,
  },
  categoryTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    // marginRight: SPACING.sm,
    position: 'relative',
  },
  categoryTabText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: '400',
  },
  activeCategoryTabText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  categoryUnderline: {
    position: 'absolute',
    bottom: 0,
    left: SPACING.md,
    right: SPACING.md,
    height: 4,
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
  quickCategoriesContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },
  quickCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
  },
  quickCategoryItem: {
    width: (width - SPACING.lg * 2 - SPACING.sm * 4) / 5,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  quickCategoryImage: {
    width: (width - SPACING.md * 2 - SPACING.sm * 4) / 5,
    height: (width - SPACING.md * 2 - SPACING.sm * 4) / 5,
    borderRadius: 6,
    marginBottom: SPACING.xs,
  },
  quickCategoryName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    // backgroundColor: COLORS.background,
    
    paddingVertical: 8,
    paddingBottom: 50,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.smmd,
    textAlign: 'center',
  },
  newInContainer: {
    // No padding here, handled by page container
  },
  newInPage: {
    width: width,
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
  },
  newInCardWrapper: {
    width: NEW_IN_CARD_WIDTH,
    flexShrink: 0,
  },
  newInCard: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    position: 'relative',
  },
  newInImage: {
    width: '100%',
    height: NEW_IN_CARD_HEIGHT,
    borderRadius: 8,
  },
  newInDiscountBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: COLORS.red,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newInDiscountText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  newInLikeButton: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newInInfo: {
    padding: SPACING.xs,
  },
  newInName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    minHeight: 36,
  },
  newInPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  newInPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  newInOriginalPrice: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray[400],
    textDecorationLine: 'line-through',
  },
  newInRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newInRatingText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray[500],
  },
  newInOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // height: 48,
    paddingHorizontal: SPACING.md,
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  newInTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '400',
    color: COLORS.text.primary,
  },
  newInTitleOverlay: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    color: COLORS.white,
  },
  newInPreviewRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  previewOuterCircle: {
    width: (width - SPACING.md * 2 - SPACING.sm * 2) / 4,
    height: (width - SPACING.md * 2 - SPACING.sm * 2) / 4,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginRight: SPACING.md,
  },
  previewOuterCircleGray: {
    width: (width - SPACING.md * 2 - SPACING.sm * 2) / 4,
    height: (width - SPACING.md * 2 - SPACING.sm * 2) / 4,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginRight: SPACING.md,
  },
  previewInnerCircle: {
    width: (width - SPACING.md * 3 - SPACING.sm * 5) / 4,
    height: (width - SPACING.md * 3 - SPACING.sm * 5) / 4,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInnerCircleGray: {
    width: (width - SPACING.md * 3 - SPACING.sm * 5) / 4,
    height: (width - SPACING.md * 3 - SPACING.sm * 5) / 4,
    borderRadius: 50,
    backgroundColor: COLORS.gray[50],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  brandCarouselContainer: {
    backgroundColor: 'transparent',
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    position: 'relative',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  brandSlide: {
    width: width,
    // paddingHorizontal: SPACING.md,
    position: 'relative',
    borderRadius: BORDER_RADIUS.md,
  },
  brandImage: {
    width: width,
    height: 128,
    borderRadius: BORDER_RADIUS.md,
    // borderRadius: BORDER_RADIUS.lg,
  },
  brandPaginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandPaginationContainerFixed: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // paddingVertical: SPACING.xs,
  },
  brandPaginationBottomContainer: {
    width: 76,
    height: 13,
    flexDirection: 'row',
  },
  brandPaginationBackground: {
    backgroundColor: COLORS.black,
    width : 7,
    height: 13
  },
  brandPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.black,
    borderBottomLeftRadius: 6.5,
    borderBottomRightRadius: 6.5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF80',
    marginHorizontal: 4,
  },
  brandDotActive: {
    backgroundColor: COLORS.white,
    width: 8,
  },
  eventIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  eventIcon: {
  },
  trendingProductsContainer: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  trendingProductCard: {
    width: GRID_CARD_WIDTH,
    paddingHorizontal: SPACING.xs,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    // padding: SPACING.sm,
    // ...SHADOWS.md,
  },
  trendingImageWrap: { position: 'relative' },
  trendingProductImage: {
    width: GRID_CARD_WIDTH - SPACING.sm * 2,
    height: (GRID_CARD_WIDTH - SPACING.sm * 2) * 1.2,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    marginRight: 0,
  },
  discountBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  discountText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  trendingHeartBtn: {
    position: 'absolute',
    right: 8,
    bottom: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  trendingHeartBtnActive: {
    position: 'absolute',
    right: 8,
    bottom: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    // backgroundColor: COLORS.red,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  trendingProductInfo: {
    flex: 1,
  },
  trendingProductName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  trendingProductPrice: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  trendingProductRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
   newInGridContainer: {
    width: '100%',
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
   },
   newInGridCard: {
     width: GRID_CARD_WIDTH,
     marginBottom: SPACING.md,
     backgroundColor: COLORS.white,
     borderRadius: 12,
   },
   newInGridImage: {
     width: GRID_CARD_WIDTH - SPACING.sm * 2,
     height: (GRID_CARD_WIDTH - SPACING.sm * 2) * 1.2,
     borderRadius: 8,
     marginBottom: SPACING.sm,
   },
  ratingText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  soldText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  playIconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },

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
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
    elevation: 8,
  },
  categoriesContainer: {
    paddingVertical: SPACING.xs,
    // paddingHorizontal: SPACING.md,
    backgroundColor: 'transparent',
  },
  categoriesScrollContent: {
    paddingLeft: SPACING.sm,
    // paddingRight: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryItem: {
    backgroundColor: COLORS.gray[100],
    marginRight: SPACING.sm,
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryItemActive: {
    // backgroundColor: COLORS.red + '20', // light red background for active
  },
  categoryText: {
    fontSize: FONTS.sizes.xsm,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
  categoryTextActive: {
    color: COLORS.red,
    fontWeight: '700',
  },
  categoriesLoadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  // banner area shown below categories
  bannerContainer: {
    // width: '90%',
    marginTop: SPACING.sm,
    backgroundColor: COLORS.black,
    height: 24,
    marginHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  bannerScroll: {
    // flex: 1,
    // width: width - SPACING.sm * 2, // total width minus horizontal padding, icon, and button
  },
  bannerWrapper: {
    paddingRight: SPACING.sm,
  },
  bannerBrandIcon: {
    position: 'absolute',
    left: SPACING.sm,
    // transform: [{ translateY: -20 }],
    zIndex: 5,
  },
  bannerPlaceholder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  bannerTitleScroll: {
    flex: 1,
    minWidth: 60,
    maxHeight: 24,
    justifyContent: 'center',
  },
  bannerTitleScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingRight: SPACING.xs,
  },
  bannerNextButton: {
  },
  bannerNextButtonText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 24,
  },
  bannerTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    color: COLORS.white,
    lineHeight: 24,
    paddingRight: 24,
  },
  popularCategoriesTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  popularText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '900',
    color: COLORS.red,
  },
  categoriesText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '900',
    color: COLORS.text.primary,
  },
  fireIcon: {
    fontSize: FONTS.sizes.xl,
  },
  popularCategoriesContainer: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
    width: '100%',
  },
  popularCategoriesSubContainer: {
    flexDirection: 'column', 
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    width: '100%',
  },
  popularCategoryImageContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  popularCategoryItem: {
    alignItems: 'center',
    // marginBottom: SPACING.md,
  },
  popularCategoryImage: {
    resizeMode: 'contain',
    borderRadius: BORDER_RADIUS.md,
    // marginBottom: SPACING.xs,
  },
  popularCategoryPlatform: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.text.red,
    marginTop: SPACING.sm,
    marginVertical: SPACING.xs / 2,
    textAlign: 'left',
  },
  popularCategoryName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  promoCardsContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  promoCard: {
    height: 280,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  promoCardBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  promoCardGradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  promoCardInner: {
    position: 'absolute',
    top: 60,
    left: '50%',
    marginLeft: -(width - SPACING.md * 4) / 2, // Half of width (240/2)
    width: width - SPACING.md * 4,
    height: 160,
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  promoCardContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  promoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoCardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  promoCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#FFFFFF33',
  },
  promoCardText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    flex: 1,
  },
  promoCardButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    // backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },

  // Live Channel Section Styles
  liveChannelContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  liveChannelCard: {
    // flex: 0.6,
    height: 210,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#FFD9B3',
    position: 'relative',
    width: 163,
  },
  liveChannelImageCarousel: {
    // position: 'absolute',
    // width: '100%',
    // height: '100%',
  },
  liveChannelBackgroundImage: {
    width: 163,
    height: 210,
  },
  liveChannelOverlay: {
    position: 'absolute',
    width: '100%',
    height: '50%',
    borderRadius: BORDER_RADIUS.md,
  },
  liveChannelContent: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    padding: SPACING.smmd,
    justifyContent: 'space-between',
  },
  liveIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  liveIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIconText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '900',
    color: COLORS.black,
    width: '50%',
  },
  liveChannelTextContainer: {
    marginBottom: SPACING.sm,
  },
  liveChannelTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 20,
  },
  liveChannelSubtitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '900',
    color: '#FF0000',
    marginBottom: SPACING.sm,
  },
  watchNowButton: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.md,
  },
  watchNowButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.black,
  },
  livePaginationContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderColor: COLORS.white,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs / 2,
    backgroundColor: '#0000001A',
  },
  livePaginationContainerFixed: {
    flexDirection: 'row',
    // justifyContent: 'center',
    // alignItems: 'center',
    // paddingVertical: SPACING.xs,
  },
  livePagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promosRightStack: {
    // flex: 0.4,
    gap: SPACING.sm,
    justifyContent: 'space-between',    
    width: '55%',
  },
  liveChannelPromoCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    // padding: SPACING.sm,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  promoCardTopRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    width: '100%',
  },
  promoCardTopRowIcon: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    width: '50%',
    paddingTop: SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  promoCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.smmd,
  },
  promoCardIcon: {
    fontSize: FONTS.sizes.xs,
  },
  promoCardTitleSmall: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.black,
    flex: 1,
  },
  promoCardImages: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    flex: 1,
  },
  promoCardSmallImage: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
  },
  promoCardPriceTag: {
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  promoCardPrice: {
    backgroundColor: COLORS.red,
    position: 'absolute',
    bottom: 0,
    width: 85,
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderBottomRightRadius: BORDER_RADIUS.sm,
  },

  todaysDealsContainer: {
    // paddingHorizontal: SPACING.md,
    // paddingVertical: SPACING.md,
  },
  todaysDealsSectionTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  todaysDealsBlock: {
    marginBottom: SPACING.lg,
    // backgroundColor: COLORS.background,
    position: 'relative',
  },
  // Landscape-tablet only: lays the three deal blocks side-by-side
  // (Live Hot / Today's Hot Deals / Best Sellers).
  todaysDealsBlocksRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  // Each block fills 1/3 of the row above. Combined with the smaller
  // dynDealsCardWidth computed in the component body, the inner cards
  // shrink to fit.
  todaysDealsBlockOneThird: {
    flex: 1,
    marginBottom: 0,
  },
  todaysDealsBlockTitleContainer: {
    left: 10,
    height: 1,
    width: 100,
    zIndex: 2,
    borderTopWidth: 5,
    // borderTopColor: 'rgba(255, 47, 47, 0.5)',
    padding: SPACING.md,
    maxHeight: 5,
    position: 'absolute',
  },
  todaysDealsBlockTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
    marginLeft: SPACING.sm,
  },
  todaysDealsBlockSubtitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    marginBottom: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  todaysDealsProductsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.sm,
  },
  todaysDealsProductWrap: {
    width: GRID_CARD_WIDTH,
    zIndex: 2,
    gap: SPACING.xs,
  },
  // Live Hot Item card
  liveHotCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    padding: SPACING.xs,
    height: 210,
    zIndex: 1,
  },
  liveHotLiveRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: SPACING.xs,
    width: GRID_CARD_WIDTH,
    borderRadius: 8,
    position: 'absolute',
    overflow: 'hidden',
    bottom: -4,
  },
  liveHotLiveRowIconContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    gap: 4,
  },
  liveHotLiveRowIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.black,
    borderRadius: BORDER_RADIUS.full,
  },
  liveHotLiveRowIconInner: {
    width: 24,
    height: 18,
    backgroundColor: '#FF0000',
    borderRadius: BORDER_RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveHotLiveText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.white,
    marginRight: SPACING.xs,
  },
  liveHotPointBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FF0000',
    borderRadius: 8,
  },
  liveHotPointBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.white,
  },
  liveHotImage: {
    width: GRID_CARD_WIDTH,
    height: GRID_CARD_WIDTH,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[200],
    
  },
  liveHotLiveRowUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#00000080',
    width: '100%',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomLeftRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
  },
  liveHotUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: 6,
    width: GRID_CARD_WIDTH,
    position: 'relative',
    overflow: 'hidden',
  },
  liveHotAvatar: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    // backgroundColor: COLORS.white,
  },
  liveHotUserNameContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  liveHotUserName: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  liveHotViews: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    color: '#AAAAAA',
  },
  liveHotProductName: {
    fontSize: 12,
    color: COLORS.text.primary,
    marginTop: 4,
    width: GRID_CARD_WIDTH,
  },
  liveHotPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.red,
    marginTop: 2,
    width: GRID_CARD_WIDTH,
  },
  // Today's Hot Deals / Best Sellers product card
  dealProductCard: {
    width: GRID_CARD_WIDTH,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  dealProductImageWrap: {
    width: GRID_CARD_WIDTH,
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  dealProductBadge: {
    width: GRID_CARD_WIDTH,
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 2,
  },
  dealProductImage: {
    width: GRID_CARD_WIDTH,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
  },
  dealProductName: {
    fontSize: 12,
    color: COLORS.text.primary,
    marginTop: SPACING.xs,
    paddingHorizontal: 2,
  },
  dealProductPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.red,
    marginTop: 2,
    paddingHorizontal: 2,
    paddingBottom: SPACING.xs,
  },
  todaysItemsContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  todaysItemsTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  todaysItemsCards: {
    gap: SPACING.md,
  },
  todaysItemCard: {
    height: 240,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  todaysItemCardBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  todaysItemGradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  todaysItemImagesContainer: {
    position: 'absolute',
    top: 65,
    left: SPACING.md,
    right: SPACING.md,
    height: width - SPACING.md * 2,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  todaysItemImagesGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.smmd,
  },
  todaysItemImagesRow: {
    flexDirection: 'row',
    gap: SPACING.smmd,
  },
  todaysItemImage: {
    borderRadius: BORDER_RADIUS.lg,
  },
  todaysItemImage2x2: {
    width: (width - SPACING.md * 4 - SPACING.smmd) / 2,
    height: (width - SPACING.md * 4) / 2,
  },
  todaysItemImageRow: {
    flex: 1,
    height: (width - SPACING.md * 4) / 2,
  },
  todaysItemContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  todaysItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todaysItemTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.white,
  },
  todaysItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF33',
  },
  todaysItemText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    flex: 1,
  },
  todaysItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    // backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  moreToLoveFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  moreToLoveFooterText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
});

export default HomeScreen;
