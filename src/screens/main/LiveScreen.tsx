import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Linking,
  PanResponder,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import WebView from 'react-native-webview';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Text from '../../components/Text';
import LanguageButton from '../../components/LanguageButton';
import { API_BASE_URL, COLORS, FONTS, SPACING, BORDER_RADIUS, SCREEN_WIDTH } from '../../constants';
import { useAppSelector } from '../../store/hooks';
import { useLiveCommerceMutation } from '../../hooks/useLiveCommerceMutation';
import { useTranslation } from '../../hooks/useTranslation';
import SearchIcon from '../../assets/icons/SearchIcon';
import StarIcon from '../../assets/icons/StarIcon';
import ArrowDropDownIcon from '../../assets/icons/ArrowDropDownIcon';
import BrandIcon from '../../assets/icons/BrandIcon';
import LiveIcon from '../../assets/icons/LiveIcon';
import SensorsIcon from '../../assets/icons/SensorsIcon';
import SellerMarkIcon from '../../assets/icons/SellerMarkIcon';
import PartnerShareIcon from '../../assets/icons/PartnerShareIcon';
import LiveSellerPillsMenuIcon from '../../assets/icons/LiveSellerPillsMenuIcon';
import LiveSellerPillsNextLabelIcon from '../../assets/icons/LiveSellerPillsNextLabelIcon';
import LiveCarouselBottomFade, {
  LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_H,
  LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_W,
} from '../../assets/icons/LiveCarouselBottomFade';
import LiveViewingBatonSvg, {
  LIVE_VIEWING_BATON_DESIGN_H,
  LIVE_VIEWING_BATON_DESIGN_W,
} from '../../assets/icons/LiveViewingBatonSvg';
import { formatPriceKRW } from '../../utils/i18nHelpers';
import { productsApi } from '../../services/productsApi';

const CAROUSEL_WIDTH = SCREEN_WIDTH - SPACING.sm * 2;
const CAROUSEL_HEIGHT = 420;

/** Popular Items horizontal cards — ×1.2 vs base, then ×1.2 again (effective ×1.44 vs 187×337) */
const POPULAR_CARD_SCALE = 1.2 * 1.2;
const POPULAR_CARD_W = Math.round(187 * POPULAR_CARD_SCALE);
const POPULAR_IMAGE_H = Math.round(337 * POPULAR_CARD_SCALE);
/** Readability scrim: bottom 2/3 of product image (matches design intent) */
const POPULAR_IMAGE_GRADIENT_H = Math.round((POPULAR_IMAGE_H * 2) / 3);

/**
 * Popular card overlay stack: absolute `bottom` anchors measured from card bottom.
 * Strip → seller → title → review/sold line → stars (larger `bottom` = higher on card).
 */
const POPULAR_STRIP_BOTTOM = Math.round(10 * POPULAR_CARD_SCALE);
const POPULAR_STACK_GAP = SPACING.smmd;
const POPULAR_STRIP_BLOCK_H = 88;
const POPULAR_SELLER_BLOCK_H = 58;
const POPULAR_TITLE_BLOCK_H = 34;
/** Single-line review + sold counts between title and stars */
const POPULAR_META_BLOCK_H = 18;
const POPULAR_SELLER_BOTTOM =
  POPULAR_STRIP_BOTTOM + POPULAR_STRIP_BLOCK_H + POPULAR_STACK_GAP;
const POPULAR_TITLE_BOTTOM =
  POPULAR_SELLER_BOTTOM + POPULAR_SELLER_BLOCK_H + POPULAR_STACK_GAP;
/** Bottom edge of review/sold row (sits in the gap above the title). */
const POPULAR_RATING_BOTTOM =
  POPULAR_TITLE_BOTTOM + POPULAR_TITLE_BLOCK_H + POPULAR_STACK_GAP;
/** Bottom edge of stars row when a meta line is shown above it */
const POPULAR_STARS_BOTTOM =
  POPULAR_RATING_BOTTOM + POPULAR_META_BLOCK_H + POPULAR_STACK_GAP;

/** Live seller pills — pill length (width) additionally ×0.9 vs scaled base */
const SELLER_PILL_CONTENT_SCALE = 1.1;
const SELLER_PILL_LENGTH_SCALE = 1.1;
const LIVE_SELLER_PILL_W = Math.round(166 * SELLER_PILL_LENGTH_SCALE * 0.9);
const LIVE_SELLER_PILL_H = Math.round(40 * SELLER_PILL_CONTENT_SCALE);
const SELLER_PILL_AVATAR = Math.round(28 * SELLER_PILL_CONTENT_SCALE);
const SELLER_PILL_PAD_L = Math.round(4 * SELLER_PILL_CONTENT_SCALE);
const SELLER_PILL_PAD_R = Math.round(8 * SELLER_PILL_CONTENT_SCALE);
const SELLER_PILL_AVATAR_GAP = Math.round(6 * SELLER_PILL_CONTENT_SCALE);
const SELLER_PILL_FONT_SIZE = 12 * SELLER_PILL_CONTENT_SCALE;
const SELLER_PILL_LINE_HEIGHT = Math.round(16 * SELLER_PILL_CONTENT_SCALE);

/** Trailing “next” control — tap height ×0.95 vs scaled base */
const NEXT_BATON_ICON_SIZE = Math.round(24 * SELLER_PILL_CONTENT_SCALE);
const NEXT_BATON_WIDTH = Math.round(44 * SELLER_PILL_LENGTH_SCALE);
const NEXT_BATON_HEIGHT = Math.round(44 * SELLER_PILL_CONTENT_SCALE * 0.95);
/** Decorative “다음” label SVG (49×9 design), scaled to match pill row */
const NEXT_BATON_LABEL_W = Math.round(49 * SELLER_PILL_CONTENT_SCALE);
const NEXT_BATON_LABEL_H = Math.round(9 * SELLER_PILL_CONTENT_SCALE);

/** Max pills when using top sellers fallback (no rows marked live on schedule) */
const LIVE_SELLER_PILL_FALLBACK_LIMIT = 48;

const asArray = (value: any): any[] => (Array.isArray(value) ? value : []);

/** `sellerLiveLink` from live-commerce reel (e.g. TikTok); ensures https scheme. */
const normalizeSellerLiveUrl = (raw?: string | null): string | null => {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
};

const pickSellerLiveLink = (item: any): string | null =>
  normalizeSellerLiveUrl(
    item?.sellerLiveLink ?? item?.liveSellerLink ?? item?.externalLiveUrl ?? null,
  );

const getLocalizedTitle = (item: any, locale: 'en' | 'ko' | 'zh') => {
  if (!item) return '';
  if (locale === 'ko') return item.titleKo || item.title || item.liveTitle || item.product?.titleKo || item.product?.titleEn || item.product?.titleZh || item.productTitle?.ko || item.productTitle?.en || item.productTitle?.zh || '';
  if (locale === 'zh') return item.titleZh || item.title || item.liveTitle || item.product?.titleZh || item.product?.titleEn || item.product?.titleKo || item.productTitle?.zh || item.productTitle?.en || item.productTitle?.ko || '';
  return item.titleEn || item.title || item.liveTitle || item.product?.titleEn || item.product?.titleKo || item.product?.titleZh || item.productTitle?.en || item.productTitle?.ko || item.productTitle?.zh || '';
};

const getSellerData = (item: any) => {
  // liveReels has `seller` as a plain string name (e.g. "홍길동")
  if (typeof item?.seller === 'string') {
    return {
      name: item.seller,
      avatar: item.sellerAvatar || item.sellerPicUrl || 'https://via.placeholder.com/48.png?text=S',
    };
  }
  const seller = item?.seller || item;
  return {
    name: seller?.nickname || seller?.userName || seller?.name || item?.sellerName || 'Live Seller',
    avatar: seller?.picUrl || seller?.avatar || item?.sellerAvatar || 'https://via.placeholder.com/48.png?text=S',
  };
};

// Build a Date from liveReels fields (date="YYYY-MM-DD", time="HH:MM") or fall back to startAt.
const parseReelDateTime = (dateStr?: string, timeStr?: string): Date | null => {
  if (!dateStr) return null;
  const iso = timeStr ? `${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}` : `${dateStr}T00:00:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const localeToTag = (locale: 'en' | 'ko' | 'zh') =>
  locale === 'ko' ? 'ko-KR' : locale === 'zh' ? 'zh-CN' : 'en-US';

const escapeHtmlAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Inline video player backed by a WebView HTML5 <video>.
// Only the currently-visible carousel page mounts this so multiple videos
// don't try to decode in parallel.
const ReelVideoPlayer: React.FC<{ videoUrl: string; posterUrl?: string; style?: any }> = ({
  videoUrl,
  posterUrl,
  style,
}) => {
  const src = escapeHtmlAttr(videoUrl);
  const poster = posterUrl ? escapeHtmlAttr(posterUrl) : '';
  // Audio-playback strategy:
  //   1. Try unmuted autoplay (works on Android with mediaPlaybackRequiresUserAction=false).
  //   2. If the browser blocks it (iOS is strict), fall back to muted autoplay so the
  //      user still sees motion, and show an overlay hinting to tap.
  //   3. Any tap inside the WebView unmutes and resumes playback, satisfying the
  //      user-gesture requirement for sound on iOS.
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden;}
video{width:100%;height:100%;object-fit:cover;display:block;background:#000;}
#hint{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);color:#fff;font:600 14px -apple-system,system-ui,sans-serif;text-align:center;}
#hint.show{display:flex;}
</style></head><body>
<video id="v" src="${src}"${poster ? ` poster="${poster}"` : ''} autoplay loop playsinline webkit-playsinline preload="auto"></video>
<div id="hint">🔊 Tap to unmute</div>
<script>
(function(){
  var v=document.getElementById('v'),h=document.getElementById('hint');
  function tryPlay(){
    v.muted=false;
    var p=v.play();
    if(p&&p.catch){p.catch(function(){
      v.muted=true;
      v.play().catch(function(){});
      h.classList.add('show');
    });}
  }
  tryPlay();
  document.body.addEventListener('click',function(){
    v.muted=false;
    h.classList.remove('show');
    v.play().catch(function(){});
  });
})();
</script>
</body></html>`;

  return (
    <WebView
      source={{ html, baseUrl: 'https://todaymall.co.kr' }}
      style={style}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      androidLayerType="hardware"
      automaticallyAdjustContentInsets={false}
      originWhitelist={['*']}
    />
  );
};

const getViewerCount = (item: any) => {
  return item?.watchUserCount ?? item?.onlineViews ?? item?.viewerCount ?? item?.watchingCount ?? item?.viewers ?? 0;
};

// ─── Header ───────────────────────────────────────────────
const LiveHeader: React.FC<{ onSearchPress?: () => void }> = ({ onSearchPress }) => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <View style={styles.broadcastIconContainer}>
        {/* <Text style={styles.broadcastIcon}>(( ))</Text> */}
        <SensorsIcon width={24} height={24} />
      </View>
      <View>
        <Text style={styles.headerTitle}>LIVE</Text>
        <Text style={styles.headerSubtitle}>CHANNAL</Text>
      </View>
    </View>
    <LanguageButton />
  </View>
);

// ─── Search Bar ───────────────────────────────────────────
type LiveSearchMode = 'sellers' | 'products';

const SearchBar: React.FC<{
  searchText: string;
  onChangeText: (t: string) => void;
  onSearch: (mode: LiveSearchMode) => void;
  t: (key: string) => string;
}> = ({ searchText, onChangeText, onSearch, t }) => {
  // Currently-selected search target. Driven by the dropdown menu; the
  // search button (and Enter on the input) routes via this mode. Default
  // is Product Search per spec — sellers is an opt-in.
  const [searchMode, setSearchMode] = useState<LiveSearchMode>('products');
  // Two-item menu visibility. Tap the dropdown trigger to open/close.
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const modeLabel =
    searchMode === 'sellers'
      ? t('live.searchModeSeller') || 'Seller Search'
      : t('live.searchModeProduct') || 'Product Search';

  const pickMode = (m: LiveSearchMode) => {
    setSearchMode(m);
    setDropdownOpen(false);
  };

  return (
    <View style={styles.searchBarContainer}>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          style={styles.sellerDropdown}
          onPress={() => setDropdownOpen((o) => !o)}
          activeOpacity={0.8}
        >
          <Text style={styles.sellerDropdownText}>{modeLabel}</Text>
          <ArrowDropDownIcon width={8} height={8} color={COLORS.white} />
        </TouchableOpacity>

        {/* Two-item menu rendered as an absolute child so it doesn't push
            the rest of the search bar around. Tap an item to switch the
            search mode; tapping the trigger again closes the menu. */}
        {dropdownOpen && (
          <View style={styles.sellerDropdownMenu}>
            <TouchableOpacity
              style={[
                styles.sellerDropdownMenuItem,
                searchMode === 'sellers' && styles.sellerDropdownMenuItemActive,
              ]}
              onPress={() => pickMode('sellers')}
              activeOpacity={0.7}
            >
              <Text style={styles.sellerDropdownMenuItemText}>
                {t('live.searchModeSeller') || 'Seller Search'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sellerDropdownMenuItem,
                searchMode === 'products' && styles.sellerDropdownMenuItemActive,
              ]}
              onPress={() => pickMode('products')}
              activeOpacity={0.7}
            >
              <Text style={styles.sellerDropdownMenuItemText}>
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
          onChangeText={onChangeText}
          onSubmitEditing={() => onSearch(searchMode)}
        />
      </View>
      <TouchableOpacity style={styles.searchButton} onPress={() => onSearch(searchMode)}>
        <Text style={styles.searchButtonText}>{t('common.search')}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Live seller pills (below search) — gradient pill + avatar / LIVE badge ─
const LiveSellerPill: React.FC<{ seller: any; onPress?: () => void }> = ({ seller, onPress }) => {
  const sellerData = seller?.seller || seller;
  const name = sellerData?.nickname || sellerData?.userName || sellerData?.name || 'Seller';
  const avatar = sellerData?.picUrl || sellerData?.avatar || 'https://via.placeholder.com/36.png?text=S';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.sellerPillTouchable}>
      <View style={styles.sellerPillBorderWrap}>
        <LinearGradient
          colors={['#FFFF00', '#FFFFFF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.sellerPillGradientFill}
        />
        <View style={styles.sellerPillInnerRow}>
          <View style={styles.sellerPillIconRing}>
            <Image source={{ uri: avatar }} style={styles.sellerPillAvatarImg} />
            <View style={styles.sellerPillRedOverlay} />
          </View>
          <View style={styles.sellerPillNameDecorRow}>
            <View style={styles.sellerPillTextWrap}>
              <Text
                style={[styles.sellerPillName, Platform.OS === 'android' && styles.sellerPillNameAndroid]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {name}
              </Text>
            </View>
            <View pointerEvents="none" style={styles.sellerPillDecorLabel}>
              <LiveSellerPillsNextLabelIcon
                width={NEXT_BATON_LABEL_W}
                height={NEXT_BATON_LABEL_H}
                color={COLORS.text.primary}
              />
            </View>
          </View>
          <View style={styles.sellerPillTailSpacer} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Notice Banner (same style as homepage) ──────────────
const NoticeBanner: React.FC<{ text?: string; t: (key: string) => string }> = ({ text, t }) => (
  <View style={styles.noticeBanner}>
    <BrandIcon width={16} height={16} style={styles.noticeBrandIcon} />
    <View style={styles.noticeBannerContent}>
      <Text style={styles.noticeText} numberOfLines={1}>
        {text ||
          t('live.importantNoticeFallback') ||
          '[Important Notice] Regarding the issue of modifying the time'}
      </Text>
    </View>
    <TouchableOpacity style={styles.noticeNextButton} activeOpacity={0.7}>
      <Text style={styles.noticeNextButtonText}>→</Text>
    </TouchableOpacity>
  </View>
);

/** Watch Live CTA — baton SVG chrome; label + 👉 emoji per design */
const WatchLiveBatonButton: React.FC<{
  onPress: () => void;
  label: string;
}> = ({ onPress, label }) => {
  const [svgSize, setSvgSize] = useState({ w: LIVE_VIEWING_BATON_DESIGN_W, h: LIVE_VIEWING_BATON_DESIGN_H });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={styles.watchLiveBatonWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setSvgSize({ w: width, h: height });
          }
        }}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LiveViewingBatonSvg width={svgSize.w} height={svgSize.h} />
        </View>
        <View style={styles.watchLiveBatonInner} accessible={false}>
          <Text style={styles.watchLiveBatonEmoji}>👉</Text>
          <Text style={styles.watchLiveBatonTitle}>{label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Featured Live Carousel ──────────────────────────────
const FeaturedLiveCarousel: React.FC<{
  items: any[];
  locale: 'en' | 'ko' | 'zh';
  t: (key: string) => string;
  isScreenFocused: boolean;
  containerWidth?: number;
  containerStyle?: any;
  onWatchLivePress?: (url: string) => void;
}> = ({ items, locale, t, isScreenFocused, containerWidth, containerStyle, onWatchLivePress }) => {
  const itemWidth = containerWidth ?? CAROUSEL_WIDTH;
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<FlatList>(null);
  const onScroll = useCallback((event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / itemWidth);
    setActiveIndex(index);
  }, [itemWidth]);

  const displayItems = items.length > 0 ? items : [null]; // Show placeholder if empty

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const sellerData = getSellerData(item);
    const viewers = getViewerCount(item);
    const title = item ? getLocalizedTitle(item, locale) : 'Celebrate LIVE Fest 2025 winners LIVE Fest 2025 winners';
    // Thumbnail / poster for the reel card (shown when the card is not the
    // active video slide, or while the WebView video loads).
    const imageUrl = item?.imageUrl || item?.product?.imageUrl || item?.thumbnailUrl || '';

    const tag = localeToTag(locale);
    // liveReels format: item.date + item.timeFrom/timeTo
    const reelStart = parseReelDateTime(item?.date, item?.timeFrom);
    const reelEnd = parseReelDateTime(item?.date, item?.timeTo);
    // Schedule format fallback: item.startAt
    const startAt = reelStart ?? (item?.startAt ? new Date(item.startAt) : new Date());
    const endAt = reelEnd ?? new Date(startAt.getTime() + 110 * 60000);

    const dateStr = startAt.toLocaleDateString(tag, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeStr = `${startAt.toLocaleTimeString(tag, timeOpts)} - ${endAt.toLocaleTimeString(tag, timeOpts)}`;
    const status = item?.status || item?.currentLiveStatus || 'live';
    const sellerLiveUrl = item ? pickSellerLiveLink(item) : null;
    const hasSellerLiveLink = !!(sellerLiveUrl && onWatchLivePress);

    const carouselBottomFadeHeight =
      (itemWidth * LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_H) / LIVE_CAROUSEL_BOTTOM_FADE_DESIGN_W;

    return (
      <View style={[styles.carouselItem, { width: itemWidth }]}>
        {/* Seller info bar */}
        <View style={styles.carouselSellerBar}>
          <Image source={{ uri: sellerData.avatar }} style={styles.carouselSellerAvatar} />
          <View style={styles.carouselSellerInfo}>
            <Text style={styles.carouselSellerName}>{sellerData.name}</Text>
            <Text style={styles.carouselViewers}>{t('live.watchingNow').replace('{count}', viewers.toLocaleString())}</Text>
          </View>
        </View>

        <View style={styles.carouselMediaBlock}>
          {/* Active card with `videoUrl`: play only while this screen is focused. */}
          {item?.videoUrl && index === activeIndex && isScreenFocused ? (
            <ReelVideoPlayer
              videoUrl={item.videoUrl}
              posterUrl={imageUrl || undefined}
              style={styles.carouselImage}
            />
          ) : imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.carouselImage} resizeMode="cover" />
          ) : (
            <View style={[styles.carouselImage, { backgroundColor: COLORS.gray[200] }]} />
          )}
          <View
            pointerEvents="none"
            style={[styles.carouselBottomFadeWrap, { height: carouselBottomFadeHeight }]}
          >
            <LiveCarouselBottomFade
              width={itemWidth}
              height={carouselBottomFadeHeight}
              gradientId={`live-carousel-bottom-fade-${index}`}
            />
          </View>
        </View>

        {/* LIVE NOW badge */}
        {status?.toLowerCase() === 'live' && (
          <View style={styles.liveNowBadge}>
            <View style={styles.liveNowDot} />
            <Text style={styles.liveNowText}>{t('live.liveNow')}</Text>
          </View>
        )}

        {/* Event info */}
        <View style={styles.carouselEventInfo}>
          <Text style={styles.carouselEventTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.carouselEventDate}>{dateStr}</Text>
          <Text style={styles.carouselEventTime}>{timeStr}</Text>
        </View>

        {hasSellerLiveLink && sellerLiveUrl && (
          <View style={[styles.carouselWatchButtonContainer, { width: itemWidth }]}>
            <WatchLiveBatonButton
              onPress={() => onWatchLivePress?.(sellerLiveUrl)}
              label={t('live.watchLiveStream')}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.carouselContainer, containerStyle]}>
      <FlatList
        ref={scrollRef}
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={(_, i) => `carousel-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 0 }}
      />
      {/* Pagination dots - same style as homepage */}
      {displayItems.length > 1 && (
        <View style={styles.paginationContainer}>
          <View style={styles.paginationPill}>
            {displayItems.map((_, i) => (
              <View
                key={i}
                style={[styles.paginationDot, i === activeIndex && styles.paginationDotActive]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Schedule Item ────────────────────────────────────────
const ScheduleItem: React.FC<{ item: any; locale: 'en' | 'ko' | 'zh' }> = ({ item, locale }) => {
  const sellerData = getSellerData(item);
  const title = getLocalizedTitle(item, locale) || 'Live title here';
  const viewers = getViewerCount(item);
  const status = item.status || item.currentLiveStatus || 'scheduled';
  const isLive = status?.toLowerCase() === 'live';

  const BASE_AVATAR = 44;
  const avatarSize = isLive ? Math.round(BASE_AVATAR * 1.2) : BASE_AVATAR; // live: 53px

  // scheduled 항목은 날짜/시간 문자열을 부제목으로 표시
  const tag = localeToTag(locale);
  const reelStart = parseReelDateTime(item?.date, item?.timeFrom);
  const reelEnd   = parseReelDateTime(item?.date, item?.timeTo);
  const startAt   = reelStart ?? (item?.startAt ? new Date(item.startAt) : null);
  const endAt     = reelEnd   ?? (startAt ? new Date(startAt.getTime() + 110 * 60000) : null);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const dateTimeText = startAt
    ? `${startAt.toLocaleDateString(tag, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ${startAt.toLocaleTimeString(tag, timeOpts)}${endAt ? ` – ${endAt.toLocaleTimeString(tag, timeOpts)}` : ''}`
    : title;

  const subtitle = isLive ? title : dateTimeText;

  return (
    <View style={styles.scheduleItemRow}>
      <View style={[
        styles.scheduleAvatarWrapper,
        { width: avatarSize, height: avatarSize },
        isLive && { borderWidth: 2, borderColor: '#FF0000', borderRadius: avatarSize / 2 },
      ]}>
        <Image source={{ uri: sellerData.avatar }} style={[styles.scheduleAvatar, { width: avatarSize, height: avatarSize }]} />
        {isLive && (
          <View style={styles.scheduleLiveDot}>
            <Text style={styles.scheduleLiveDotText}>LIVE</Text>
          </View>
        )}
      </View>
      <View style={styles.scheduleItemInfo}>
        <Text style={styles.scheduleItemName} numberOfLines={1}>{sellerData.name}</Text>
        <Text style={styles.scheduleItemTitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.scheduleItemRight}>
        <Text style={styles.scheduleItemViewers}>{viewers}</Text>
        <Text style={styles.scheduleItemViewersLabel}>watching</Text>
      </View>
    </View>
  );
};

// ─── Top Seller Item ──────────────────────────────────────
const TopSellerItem: React.FC<{ seller: any; onPress?: () => void }> = ({ seller, onPress }) => {
  const { t } = useTranslation();
  const sellerObj = seller?.seller || seller;
  const name = sellerObj?.nickname || sellerObj?.userName || sellerObj?.name || seller?.sellerName || 'Seller';
  const avatar = sellerObj?.picUrl || sellerObj?.avatar || seller?.sellerAvatar || 'https://via.placeholder.com/60.png?text=S';
  const totalSold = seller?.totalItemsSold ?? sellerObj?.totalItemsSold ?? seller?.totalSold ?? 0;
  const viewers = seller?.onlineViews ?? sellerObj?.onlineViews ?? seller?.viewerCount ?? sellerObj?.viewerCount ?? 0;

  return (
    <TouchableOpacity style={styles.topSellerItem} activeOpacity={0.7} onPress={onPress}>
      <Image source={{ uri: avatar }} style={styles.topSellerAvatar} />
      <View style={styles.topSellerInfo}>
        <Text style={styles.topSellerName} numberOfLines={1}>{name}</Text>
        <Text style={styles.topSellerSold}>{t('live.soldLabel')}: <Text style={styles.topSellerSoldBold}>{totalSold.toLocaleString()}</Text></Text>
        <Text style={styles.topSellerSold}>{t('live.liveLabel')}: <Text style={styles.topSellerSoldBold}>{viewers.toLocaleString()}</Text></Text>
      </View>
    </TouchableOpacity>
  );
};

const POPULAR_RATING_STAR_SIZE = 14;
const POPULAR_RATING_STAR_COLOR = '#FFDD00';

/**
 * Maps average score (0–5) to full + optional half yellow star.
 * Fraction ≥ 0.75 rounds up one full star; any other positive fraction adds one half star.
 */
const getPopularCardStarParts = (score: number): { full: number; half: boolean } => {
  const s = Math.min(5, Math.max(0, Number(score) || 0));
  let full = Math.floor(s + 1e-9);
  const frac = s - full;
  if (frac >= 0.75 && full < 5) {
    return { full: full + 1, half: false };
  }
  if (frac > 0.001 && full < 5) {
    return { full, half: true };
  }
  return { full, half: false };
};

// ─── Popular Item Card ────────────────────────────────────
const PopularItemCard: React.FC<{ item: any; locale: 'en' | 'ko' | 'zh'; rank?: number; onPress?: () => void; t: (key: string) => string }> = ({ item, locale, rank, onPress, t }) => {
  const product = item.product || {};
  const seller = getSellerData(item);
  const title = getLocalizedTitle(item, locale);
  const image = item.imageUrl || product.imageUrl || 'https://via.placeholder.com/280x350.png?text=ITEM';
  const price = item.price ?? item.originalPrice ?? product.promotionPrice ?? product.price ?? 0;
  const reviewScore = item.reviewScore ?? 0;
  const reviews = item.reviewNumbers ?? 0;
  const soldCount = item.itemsSold ?? 0;
  const totalViews = item.onlineViews ?? 0;

  return (
    <TouchableOpacity style={styles.popularCard} activeOpacity={0.8} onPress={onPress}>
      {/* Product image with rank badge */}
      <View style={styles.popularImageContainer}>
        <Image source={{ uri: image }} style={styles.popularImage} resizeMode="cover" />
        <View style={styles.popularImageGradientOverlay} pointerEvents="none">
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.92)']}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {rank != null && (
          <View style={styles.rankBadge}>
            <SellerMarkIcon width={77} height={72} />
            <View style={styles.rankTextContainer}>
              <View style={styles.rankBadgeTop}>
                <Text style={styles.rankBadgeLabel}>BEST</Text>
                <Text style={styles.rankBadgeLabelSub}>SELLERS</Text>
              </View>
              <Text style={styles.rankBadgeNumber}>{rank}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Stars + score — only when there are reviews (yellow / half-yellow only, no empty stars) */}
      {reviews > 0 && (
        <View
          style={[
            styles.popularRatingStarsShell,
            (reviews > 0 || soldCount > 0) ? styles.popularRatingStarsShellWithMeta : null,
          ]}
        >
          <View style={styles.popularRatingStarsInner}>
            {(() => {
              const { full, half } = getPopularCardStarParts(reviewScore);
              const nodes: React.ReactNode[] = [];
              for (let i = 0; i < full; i++) {
                nodes.push(
                  <StarIcon
                    key={`popular-star-${i}`}
                    width={POPULAR_RATING_STAR_SIZE}
                    height={POPULAR_RATING_STAR_SIZE}
                    color={POPULAR_RATING_STAR_COLOR}
                  />,
                );
              }
              if (half) {
                nodes.push(
                  <View
                    key="popular-star-half"
                    style={{
                      width: POPULAR_RATING_STAR_SIZE / 2,
                      height: POPULAR_RATING_STAR_SIZE,
                      overflow: 'hidden',
                    }}
                  >
                    <StarIcon
                      width={POPULAR_RATING_STAR_SIZE}
                      height={POPULAR_RATING_STAR_SIZE}
                      color={POPULAR_RATING_STAR_COLOR}
                    />
                  </View>,
                );
              }
              return nodes;
            })()}
          </View>
          <Text style={styles.popularRatingText}>
            {reviewScore > 0 ? reviewScore.toFixed(1) : '0.0'}
          </Text>
        </View>
      )}

      {/* Review / sold — one line between stars and product title */}
      {(reviews > 0 || soldCount > 0) && (
        <View style={styles.popularReviewSoldRow}>
          {reviews > 0 && (
            <Text style={styles.popularReviewCount} numberOfLines={1} ellipsizeMode="tail">
              {t('product.reviewsCount').replace('{count}', reviews.toLocaleString())}
            </Text>
          )}
          {soldCount > 0 && (
            <Text style={styles.popularSoldCount} numberOfLines={1} ellipsizeMode="tail">
              {reviews > 0 ? ' | ' : ''}
              {t('product.soldCount').replace('{count}', `${soldCount.toLocaleString()}+`)}
            </Text>
          )}
        </View>
      )}

      {/* Title */}
      <Text style={styles.popularTitle} numberOfLines={1}>{title}</Text>

      {/* Seller info */}
      <View style={styles.popularSellerRow}>
        <View style={{flexDirection: 'row', gap: SPACING.xs, alignItems: 'center'}}>
          <Image source={{ uri: seller.avatar }} style={styles.popularSellerAvatar} />
          <Text style={styles.popularSellerName} numberOfLines={1}>{seller.name}</Text>
          <View style={{flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end'}}>
            <Text style={styles.popularTotalViews}>{totalViews.toLocaleString()}</Text>
            <Text style={styles.popularTotalViewsLabel}>Total Views</Text>
          </View>
        </View>
      </View>

      {/* Bottom product strip */}
      <View style={styles.popularBottomStrip}>
        <Image source={{ uri: product.imageUrl || image }} style={styles.popularStripAvatar} />
        <View style={{flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', width: '72%'}}>
          <Text style={styles.popularStripTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.popularBottomStripPriceRow}>
            <View><View><Text style={styles.popularStripPrice} numberOfLines={1}>{formatPriceKRW(price)}</Text></View>
            <Text style={styles.popularStripShopNow} numberOfLines={1}>{t('live.shopNow').replace('{arrow}', '>')}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Point Partner Seller Card ────────────────────────────
const PARTNER_PRODUCTS_PER_PAGE = 3;

const normalizeListingImageUri = (raw: unknown): string => {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\/\//.test(s)) return `https:${s}`;
  return s;
};

/** Turn root-relative CDN paths (e.g. `/Dream/...`) into absolute URLs the Image component can load. */
const resolvePartnerMediaUrl = (raw: string): string => {
  const s = normalizeListingImageUri(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) {
    try {
      const origin = new URL(API_BASE_URL).origin;
      return `${origin}${s}`;
    } catch {
      return s;
    }
  }
  return s;
};

/** Last-resort: find any string that looks like an image URL inside nested payloads (CMS / "Dream" folder paths, etc.). */
const scrapeImageUrlFromUnknown = (obj: unknown, depth = 0): string => {
  if (obj == null || depth > 6) return '';
  if (typeof obj === 'string') {
    const t = obj.trim();
    if (
      t.length > 8 &&
      (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(t) ||
        /^https?:\/\//i.test(t) ||
        /^\/\//.test(t) ||
        (t.startsWith('/') && /dream|upload|static|image|media|img|files|assets/i.test(t)))
    ) {
      return normalizeListingImageUri(t);
    }
    return '';
  }
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const found = scrapeImageUrlFromUnknown(el, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const found = scrapeImageUrlFromUnknown(v, depth + 1);
      if (found) return found;
    }
  }
  return '';
};

const uniquePartnerProductsById = (list: any[]): any[] => {
  const seen = new Set<string>();
  const out: any[] = [];
  list.forEach((item, i) => {
    const k = String(item?.productId ?? item?.id ?? item?._id ?? item?.offerId ?? `i-${i}`);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(item);
  });
  return out;
};

/** Resolves product image for live-status rows and own-mall rows (API field names vary). */
const pickPartnerListingImage = (prod: any): string => {
  if (!prod || typeof prod !== 'object') return '';
  const nested = prod.product || prod.productData || {};
  const fromImages =
    Array.isArray(prod.images) && prod.images.length > 0
      ? prod.images[0]
      : Array.isArray(nested.images) && nested.images.length > 0
        ? nested.images[0]
        : '';
  const u =
    prod.productImageUrl ||
    prod.imageUrl ||
    prod.image ||
    prod.mediaUrl ||
    prod.thumbnail ||
    prod.coverImage ||
    prod.picUrl ||
    prod.picture ||
    prod.photo ||
    nested.imageUrl ||
    nested.main_image_url ||
    nested.image ||
    prod.main_image_url ||
    fromImages;
  const rawStr = typeof u === 'string' ? u : (u as any)?.url || '';
  const primary = normalizeListingImageUri(rawStr);
  if (primary) return resolvePartnerMediaUrl(primary);
  const scraped = scrapeImageUrlFromUnknown(prod);
  return resolvePartnerMediaUrl(scraped);
};

const PointPartnerSellerCard: React.FC<{
  seller: any;
  sellerKey: string;
  locale: 'en' | 'ko' | 'zh';
  onPress?: () => void;
  onProductPress?: (product: any) => void;
  t: (key: string) => string;
  cardStyle?: any;
}> = ({ seller, sellerKey, locale, onPress, onProductPress, t, cardStyle }) => {
  /** Inner width for the product strip (card width minus horizontal padding). Used so paging works on first paint. */
  const stripWidthFromStyle = useMemo(() => {
    const w = typeof cardStyle?.width === 'number' ? cardStyle.width : 0;
    return w > 0 ? Math.max(0, w - SPACING.md * 2) : 0;
  }, [cardStyle?.width]);
  const name = seller.userName || seller.nickname || 'Seller';
  const avatar = seller.picUrl || 'https://via.placeholder.com/80.png?text=S';
  const followers = (() => {
    const raw =
      seller.followCount ??
      seller.followerCount ??
      seller.followersCount ??
      seller.totalFollowers ??
      (typeof seller.followers === 'number' ? seller.followers : undefined);
    if (raw == null || raw === '') return 0;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isFinite(n) ? n : 0;
  })();
  const totalSales = seller.totalItemsSold ?? seller.totalSales ?? seller.salesCount ?? 0;
  const isLive = seller.currentLiveStatus === 'live';
  const sellerId = seller?._id || seller?.id || seller?.sellerId || '';

  // Fetch the same products used by `LiveSellerDetailScreen` so the
  // Point Partner preview shows the complete listing (not the truncated
  // embedded `currentLiveStatuses` payload).
  const [liveSellerPreviewProducts, setLiveSellerPreviewProducts] = useState<any[] | null>(null);
  const [isFetchingLiveSellerPreviewProducts, setIsFetchingLiveSellerPreviewProducts] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setIsFetchingLiveSellerPreviewProducts(true);
        // Limit preview thumbnails to reduce network + keep UI stable.
        const response = await productsApi.getLiveCommerceSellerDetail(sellerId, { page: 1, pageSize: 9 });
        if (cancelled) return;
        if (response?.success && response?.data) {
          const items = (response.data.items || []).slice(0, 9);
          const mappedProducts = items.map((item: any) => {
            const product = item?.product || item?.productData || {};
            const title =
              locale === 'ko'
                ? product?.titleKo || product?.titleEn || product?.titleZh || item?.liveTitle || item?.title || ''
                : locale === 'zh'
                  ? product?.titleZh || product?.titleEn || product?.titleKo || item?.liveTitle || item?.title || ''
                  : product?.titleEn || product?.titleKo || product?.titleZh || item?.liveTitle || item?.title || '';

            const rawPrice = product?.price ?? product?.salePrice ?? item?.price ?? 0;
            const price = parseFloat(String(rawPrice || 0)) || 0;

            const image =
              product?.imageUrl ||
              product?.image ||
              item?.imageUrl ||
              item?.image ||
              item?.mediaUrl ||
              '';

            const id = item?.productId || product?.id || item?.id || '';
            return {
              id,
              externalId: item?.productId || product?.id || item?.id || '',
              productId: item?.productId,
              title,
              liveTitle: title,
              image,
              imageUrl: image,
              price,
              originalPrice: price,
              raw: item,
            };
          });
          setLiveSellerPreviewProducts(mappedProducts);
        }
      } catch {
        // Keep embedded fallback when the preview fetch fails.
      } finally {
        if (!cancelled) setIsFetchingLiveSellerPreviewProducts(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sellerId, locale]);

  const rawLiveStatuses: any[] = Array.isArray(seller.currentLiveStatuses) ? seller.currentLiveStatuses : [];
  const ownMallProducts: any[] = Array.isArray(seller.liveOwnMallProducts) ? seller.liveOwnMallProducts : [];
  /** CMS / alternate buckets (e.g. `dream` folder payloads) when `currentLiveStatuses` is empty. */
  const dream = (seller as any)?.dream;
  const dreamListed: any[] = [];
  if (dream && typeof dream === 'object') {
    if (Array.isArray(dream.products)) dreamListed.push(...dream.products);
    if (Array.isArray(dream.items)) dreamListed.push(...dream.items);
  }
  const fallbackStrip = uniquePartnerProductsById([
    ...(Array.isArray(seller.products) ? seller.products : []),
    ...(Array.isArray(seller.liveProducts) ? seller.liveProducts : []),
    ...(Array.isArray((seller as any).pointProducts) ? (seller as any).pointProducts : []),
    ...(Array.isArray((seller as any).dreamProducts) ? (seller as any).dreamProducts : []),
    ...dreamListed,
  ]);
  /** Pager: live-status rows → own-mall → generic seller product lists (products / dream / etc.). */
  const embeddedCarouselProducts =
    rawLiveStatuses.length > 0
      ? rawLiveStatuses
      : ownMallProducts.length > 0
        ? ownMallProducts
        : fallbackStrip;
  const carouselProducts =
    liveSellerPreviewProducts && liveSellerPreviewProducts.length > 0
      ? liveSellerPreviewProducts
      : embeddedCarouselProducts;
  /** Second horizontal strip only when both streams exist (avoid duplicating own-mall in pager + strip). */
  const showOwnMallSecondaryStrip = rawLiveStatuses.length > 0 && ownMallProducts.length > 0;
  const externalLink = seller.sellerLiveLink || seller.liveSellerLink || seller.externalLiveUrl || null;
  const liveChannelLink = seller.liveChannelLink || null;

  const localizedTitle = (prod: any): string => {
    const tt = prod?.productTitle;
    if (tt && typeof tt === 'object') {
      if (locale === 'ko') return tt.ko || tt.en || tt.zh || '';
      if (locale === 'zh') return tt.zh || tt.en || tt.ko || '';
      return tt.en || tt.ko || tt.zh || '';
    }
    return prod?.liveTitle || prod?.title || '';
  };
  const productPrice = (prod: any): number => prod?.price ?? prod?.productPrice ?? 0;

  const pages: any[][] = [];
  for (let i = 0; i < carouselProducts.length; i += PARTNER_PRODUCTS_PER_PAGE) {
    pages.push(carouselProducts.slice(i, i + PARTNER_PRODUCTS_PER_PAGE));
  }
  // Always render at least one page so empty state still occupies the same vertical space.
  if (pages.length === 0) pages.push([]);

  const [activePage, setActivePage] = useState(0);
  const [pageWidth, setPageWidth] = useState(stripWidthFromStyle);
  useEffect(() => {
    if (stripWidthFromStyle > 0) setPageWidth(stripWidthFromStyle);
  }, [stripWidthFromStyle]);
  const onProductsLayout = (e: any) => {
    const w = e?.nativeEvent?.layout?.width ?? 0;
    if (w > 0) setPageWidth((pw) => (Math.abs(w - pw) > 0.5 ? w : pw));
  };
  const onProductsScroll = (e: any) => {
    if (!pageWidth) return;
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const next = Math.round(x / pageWidth);
    if (next !== activePage) setActivePage(next);
  };

  const openExternal = () => {
    if (!externalLink) return;
    const url = /^https?:\/\//i.test(externalLink) ? externalLink : `https://${externalLink}`;
    Linking.openURL(url).catch(() => undefined);
  };

  const openLiveChannel = () => {
    if (!liveChannelLink) return;
    const url = /^https?:\/\//i.test(liveChannelLink) ? liveChannelLink : `https://${liveChannelLink}`;
    Linking.openURL(url).catch(() => undefined);
  };

  // ─── Own-mall products row: 2-up horizontal with manual draggable bar ───
  const ownMallScrollRef = useRef<ScrollView | null>(null);
  const [ownMallRowWidth, setOwnMallRowWidth] = useState(0);
  const [ownMallScrollX, setOwnMallScrollX] = useState(0);
  const ownMallContentWidth = useMemo(() => {
    if (!ownMallRowWidth || ownMallProducts.length === 0 || !showOwnMallSecondaryStrip) return 0;
    const cellWidth = (ownMallRowWidth - SPACING.sm) / 2;
    return cellWidth * ownMallProducts.length + SPACING.sm * (ownMallProducts.length - 1);
  }, [ownMallRowWidth, ownMallProducts.length, showOwnMallSecondaryStrip]);
  const ownMallMaxScroll = Math.max(0, ownMallContentWidth - ownMallRowWidth);
  const ownMallTrackWidth = ownMallRowWidth;
  const ownMallThumbWidth = useMemo(() => {
    if (!ownMallContentWidth || !ownMallTrackWidth) return 0;
    const ratio = Math.min(1, ownMallTrackWidth / ownMallContentWidth);
    return Math.max(24, ownMallTrackWidth * ratio);
  }, [ownMallContentWidth, ownMallTrackWidth]);
  const ownMallThumbMax = Math.max(0, ownMallTrackWidth - ownMallThumbWidth);
  const ownMallThumbX = ownMallMaxScroll > 0
    ? (ownMallScrollX / ownMallMaxScroll) * ownMallThumbMax
    : 0;
  const dragStartThumbX = useRef(0);
  const ownMallPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartThumbX.current = ownMallThumbX;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!ownMallThumbMax || !ownMallMaxScroll) return;
        const nextThumb = Math.max(
          0,
          Math.min(ownMallThumbMax, dragStartThumbX.current + gesture.dx),
        );
        const nextScroll = (nextThumb / ownMallThumbMax) * ownMallMaxScroll;
        ownMallScrollRef.current?.scrollTo({ x: nextScroll, animated: false });
      },
    }),
  ).current;

  const partnerRowGap = SPACING.xs;
  const partnerCellW =
    pageWidth > 0
      ? (pageWidth - partnerRowGap * (PARTNER_PRODUCTS_PER_PAGE - 1)) / PARTNER_PRODUCTS_PER_PAGE
      : 0;
  /** ~52px-class thumb ×1.5, capped so three columns still fit the pager width (card row grows with image). */
  // Image scale: bump by 1.2x relative to the previous tuned size.
  const PARTNER_THUMB_SCALE = 1.8;
  const partnerThumbBase =
    partnerCellW > 0 ? Math.max(28, Math.min(52, Math.floor(partnerCellW) - 4)) : 44;
  const partnerThumbSz =
    partnerCellW > 0
      ? Math.round(Math.min(partnerThumbBase * PARTNER_THUMB_SCALE, partnerCellW - 2))
      : Math.round(44 * PARTNER_THUMB_SCALE);
  // Keep the card height closely coupled to thumbnail size so the "image area"
  // visually drives the layout (less empty space under the image).
  const partnerProductRowMinHeight = Math.round(partnerThumbSz + 34);

  return (
    <View style={[styles.partnerCard, cardStyle]} collapsable={false}>
      {/* Header only: full-card TouchableOpacity blocks horizontal ScrollView inside parent ScrollView. */}
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} accessibilityRole="button">
        <View style={styles.partnerTopRow}>
          <View style={styles.partnerAvatarWrapper}>
            <View style={[styles.partnerAvatarRing, isLive && styles.partnerAvatarRingLive]}>
              <Image source={{ uri: avatar }} style={styles.partnerAvatar} />
            </View>
            {isLive && (
              <>
                <View style={styles.partnerLiveBadge}>
                  <Text style={styles.partnerLiveBadgeText}>LIVE</Text>
                </View>
                <View style={styles.partnerLiveCaption}>
                  <Text style={styles.partnerLiveCaptionText} numberOfLines={1}>
                    {t('live.liveNow')}
                  </Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.partnerIdentity}>
            <Text style={styles.partnerName} numberOfLines={1}>{name}</Text>
            <Text style={styles.partnerStats} numberOfLines={1}>
              {t('live.followers')} {followers}  |  {t('live.totalSales')} {totalSales}
            </Text>
          </View>
          {externalLink && (
            <TouchableOpacity
              onPress={openExternal}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.partnerSocialBtn}
            >
              <Text style={styles.partnerSocialGlyph}>♪</Text>
            </TouchableOpacity>
          )}
          {liveChannelLink && (
            <TouchableOpacity
              onPress={openLiveChannel}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <PartnerShareIcon width={40} height={40} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Products carousel: 3 per page, swipe horizontally when more than one page */}
      <View
        style={[styles.partnerProductsWrap, { width: '100%', minHeight: partnerProductRowMinHeight }]}
        onLayout={onProductsLayout}
      >
        {pageWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled={Platform.OS === 'android'}
            removeClippedSubviews={false}
            showsHorizontalScrollIndicator={false}
            onScroll={onProductsScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            keyboardShouldPersistTaps="handled"
          >
            {pages.map((page, pageIdx) => (
              <View
                key={`${sellerKey}-page-${pageIdx}`}
                style={[
                  styles.partnerProductsPage,
                  { width: pageWidth, gap: partnerRowGap, minHeight: partnerProductRowMinHeight },
                ]}
              >
                {page.map((prod: any, idx: number) => {
                  const title = localizedTitle(prod);
                  const img = pickPartnerListingImage(prod);
                  const cellKey = `${sellerKey}-p${pageIdx}-c${idx}-${String(prod?.productId ?? prod?.id ?? prod?._id ?? prod?.offerId ?? 'x')}`;
                  return (
                    <TouchableOpacity
                      key={cellKey}
                      activeOpacity={0.9}
                      onPress={() => onProductPress?.(prod)}
                      accessibilityRole="button"
                      style={[
                        styles.partnerProductCell,
                        partnerCellW > 0 && {
                          width: partnerCellW,
                          maxWidth: partnerCellW,
                          flexGrow: 0,
                          flexShrink: 0,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: img || 'https://via.placeholder.com/80x80.png?text=P' }}
                        style={[styles.partnerProductImageLg, { width: partnerThumbSz, height: partnerThumbSz }]}
                        resizeMode="cover"
                      />
                      <View style={styles.partnerProductCellInfo}>
                        <Text style={styles.partnerProductCellTitle} numberOfLines={1}>
                          {title || t('live.products')}
                        </Text>
                        <Text style={styles.partnerProductCellPrice}>
                          {formatPriceKRW(productPrice(prod))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {/* Pad short last page so dots stay aligned and layout is uniform */}
                {Array.from({ length: PARTNER_PRODUCTS_PER_PAGE - page.length }).map((_, i) => (
                  <View
                    key={`${sellerKey}-pad-${pageIdx}-${i}`}
                    style={[
                      styles.partnerProductCell,
                      partnerCellW > 0 && {
                        width: partnerCellW,
                        maxWidth: partnerCellW,
                        flexGrow: 0,
                        flexShrink: 0,
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Pagination dots */}
      {pages.length > 1 && (
        <View style={styles.partnerDotsRow}>
          {pages.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[styles.partnerDot, i === activePage && styles.partnerDotActive]}
            />
          ))}
        </View>
      )}

      {/* Own-mall product images: 2-up horizontal row (only when live-status row also exists — otherwise pager uses own-mall). */}
      {showOwnMallSecondaryStrip && (
        <View
          style={styles.ownMallRowWrap}
          onLayout={(e) => {
            const w = e?.nativeEvent?.layout?.width ?? 0;
            if (w && w !== ownMallRowWidth) setOwnMallRowWidth(w);
          }}
        >
          {ownMallRowWidth > 0 && (
            <ScrollView
              ref={ownMallScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => setOwnMallScrollX(e.nativeEvent.contentOffset.x)}
              contentContainerStyle={styles.ownMallContent}
            >
              {ownMallProducts.map((prod: any, idx: number) => {
                const img = pickPartnerListingImage(prod);
                const cellWidth = (ownMallRowWidth - SPACING.sm) / 2;
                const imageSize = cellWidth * 0.7;
                return (
                  <TouchableOpacity
                    key={`${sellerKey}-om-${String(prod?.id ?? prod?._id ?? prod?.offerId ?? idx)}`}
                    activeOpacity={0.85}
                    onPress={() => onProductPress?.(prod)}
                    style={{
                      width: cellWidth,
                      alignItems: 'center',
                      marginRight: idx === ownMallProducts.length - 1 ? 0 : SPACING.sm,
                    }}
                  >
                    <Image
                      source={{ uri: img || 'https://via.placeholder.com/80x80.png?text=P' }}
                      style={[
                        styles.ownMallProductImage,
                        { width: imageSize, height: imageSize },
                      ]}
                      resizeMode="cover"
                    />
                    <Text style={styles.ownMallProductPrice} numberOfLines={1}>
                      {formatPriceKRW(prod?.price ?? 0)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {ownMallMaxScroll > 0 && (
            <View style={styles.ownMallBarTrack}>
              <View
                {...ownMallPan.panHandlers}
                style={[
                  styles.ownMallBarThumb,
                  { width: ownMallThumbWidth, transform: [{ translateX: ownMallThumbX }] },
                ]}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Tablet Top Seller Row ────────────────────────────────
const TabletTopSellerRow: React.FC<{ seller: any; rank: number; onPress?: () => void }> = ({ seller, rank, onPress }) => {
  const sellerObj = seller?.seller || seller;
  const name = sellerObj?.nickname || sellerObj?.userName || sellerObj?.name || seller?.sellerName || 'Seller';
  const avatar = sellerObj?.picUrl || sellerObj?.avatar || seller?.sellerAvatar || 'https://via.placeholder.com/40.png?text=S';
  const totalSold = seller?.totalItemsSold ?? sellerObj?.totalItemsSold ?? seller?.totalSold ?? 0;
  return (
    <TouchableOpacity style={styles.tabletTSRow} activeOpacity={0.7} onPress={onPress}>
      <Image source={{ uri: avatar }} style={styles.tabletTSAvatar} />
      <Text style={styles.tabletTSName} numberOfLines={1}>{name}</Text>
      <Text style={styles.tabletTSSold}>{totalSold.toLocaleString()}</Text>
      <View style={styles.tabletTSBadge}>
        <Text style={styles.tabletTSBadgeText}>🏆 #{rank}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────
const LiveScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isScreenFocused = useIsFocused();
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const { width: dynWidth, height: dynHeight } = useWindowDimensions();
  const isTablet = dynWidth >= 600;
  /** Upright tablet: carousel full width; schedule + top seller in one horizontal row (~40% each). */
  const isTabletPortrait = isTablet && dynWidth < dynHeight;
  const TABLET_PORTRAIT_VISIBLE_ROWS = 5;
  const TABLET_PORTRAIT_SCHEDULE_ROW_PX = 66;
  const TABLET_PORTRAIT_TOP_SELLER_ROW_PX = 48;
  const tabletPortraitScheduleScrollMax =
    TABLET_PORTRAIT_VISIBLE_ROWS * TABLET_PORTRAIT_SCHEDULE_ROW_PX;
  const tabletPortraitTopSellerScrollMax =
    TABLET_PORTRAIT_VISIBLE_ROWS * TABLET_PORTRAIT_TOP_SELLER_ROW_PX;
  // Tablet flex ratio: schedule(2) : topSeller(2) : carousel(7) = 11 units total
  const tabletTotalWidth = dynWidth - SPACING.sm * 2; // outer horizontal margin
  const availWidth = tabletTotalWidth - SPACING.sm * 2; // subtract 2 inter-panel gaps
  const tabletCarouselWidth = Math.floor(availWidth * 7 / 11);
  const tabletCarouselWidthPortrait = Math.floor(tabletTotalWidth);

  // Point Partner Seller grid: 2 columns on tablet, 1 on phone (wide horizontal card layout).
  const PARTNER_COLS = isTablet ? 2 : 1;
  const partnerCardWidth = Math.floor(
    (dynWidth - SPACING.md * 2 - SPACING.smmd * (PARTNER_COLS - 1)) / PARTNER_COLS,
  );

  const {
    mutate: fetchLiveCommerce,
    data: liveCommerceData,
    isLoading,
    isError,
    error,
  } = useLiveCommerceMutation();

  useEffect(() => {
    fetchLiveCommerce();
  }, [fetchLiveCommerce]);

  const schedule = useMemo(
    () => asArray(liveCommerceData?.liveStreamSchedule).length > 0
      ? asArray(liveCommerceData?.liveStreamSchedule)
      : asArray(liveCommerceData?.schedule),
    [liveCommerceData]
  );
  const liveReels = useMemo(() => asArray(liveCommerceData?.liveReels), [liveCommerceData]);
  const topSellers = useMemo(
    () => asArray(liveCommerceData?.topSellers).length > 0
      ? asArray(liveCommerceData?.topSellers)
      : asArray(liveCommerceData?.top10Sellers),
    [liveCommerceData]
  );
  const pointPartnerSellers = useMemo(
    () => asArray(liveCommerceData?.pointSellers).length > 0
      ? asArray(liveCommerceData?.pointSellers)
      : asArray(liveCommerceData?.pointPartnerSellers),
    [liveCommerceData]
  );
  const popularItems = useMemo(() => asArray(liveCommerceData?.popularItems), [liveCommerceData]);
  // Featured carousel shows liveReels first; falls back to schedule when liveReels is empty.
  const featuredItems = useMemo(() => (liveReels.length > 0 ? liveReels : schedule), [liveReels, schedule]);

  // Derive live sellers for pills: prefer schedule rows marked live; otherwise top sellers.
  const liveSellers = useMemo(() => {
    const live = schedule.filter((s: any) =>
      (s.status || s.currentLiveStatus || '').toLowerCase() === 'live'
    );
    if (live.length > 0) return live;
    return topSellers.slice(0, LIVE_SELLER_PILL_FALLBACK_LIMIT);
  }, [schedule, topSellers]);

  const liveSellerPillRows = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const s of liveSellers) {
      const o = s.seller || s;
      const id = o?._id || o?.id;
      if (!id) continue;
      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [liveSellers]);

  const liveNowCount = useMemo(() => {
    return schedule.filter((s: any) =>
      (s.status || s.currentLiveStatus || '').toLowerCase() === 'live'
    ).length;
  }, [schedule]);

  const onRefresh = () => fetchLiveCommerce();

  const openSellerLiveWeb = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  // Layout-first paint: render header + search + featured carousel immediately
  // and defer the three heavy seller/product lists (Top Seller, Popular
  // Items, Point Partner) to the next frame so the user sees the page
  // composition first; their images stream in afterwards. Uses
  // requestAnimationFrame instead of InteractionManager (see ProductDetail).
  const [showHeavyContent, setShowHeavyContent] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShowHeavyContent(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Tablet 3-panel height equalizer: measure each panel's natural height, then
  // lock all three to the minimum so the smallest card defines the row height.
  const tabletPanelNaturalHeights = useRef<(number | null)[]>([null, null, null]);
  const tabletMinHeightLocked = useRef(false);
  const [tabletMinHeight, setTabletMinHeight] = useState<number | undefined>();
  const handleTabletPanelLayout = (index: number) => (e: any) => {
    if (isTabletPortrait) return;
    if (tabletMinHeightLocked.current) return;
    tabletPanelNaturalHeights.current[index] = e.nativeEvent.layout.height;
    if (tabletPanelNaturalHeights.current.every(h => h !== null)) {
      tabletMinHeightLocked.current = true;
      setTabletMinHeight(Math.min(...(tabletPanelNaturalHeights.current as number[])));
    }
  };

  useEffect(() => {
    tabletPanelNaturalHeights.current = [null, null, null];
    tabletMinHeightLocked.current = false;
    setTabletMinHeight(undefined);
  }, [isTabletPortrait]);

  const tabletSchedulePanelEl =
    !isTabletPortrait && schedule.length > 0 ? (
      <View
        key="live-tablet-schedule"
        style={[
          styles.section,
          styles.tabletSchedulePanel,
          tabletMinHeight ? { height: tabletMinHeight } : {},
        ]}
        onLayout={handleTabletPanelLayout(0)}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('live.liveStreamSchedule')}</Text>
          {liveNowCount > 0 && (
            <Text style={styles.liveNowCountText}>
              {liveNowCount}{' '}
              <Text style={{ color: COLORS.text.secondary }}>{t('live.liveNowStatus')}</Text>
            </Text>
          )}
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {schedule.map((item: any, i: number) => (
            <ScheduleItem key={item._id || item.id || i} item={item} locale={locale} />
          ))}
        </ScrollView>
      </View>
    ) : null;

  const tabletTopSellerPanelEl =
    !isTabletPortrait && topSellers.length > 0 ? (
      <View
        key="live-tablet-topseller"
        style={[
          styles.section,
          styles.tabletTopSellerPanel,
          tabletMinHeight ? { height: tabletMinHeight } : {},
        ]}
        onLayout={handleTabletPanelLayout(1)}
      >
        <View style={styles.topSellerHeader}>
          <Text style={styles.sectionTitle}>{t('live.topSeller')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {topSellers.map((seller: any, i: number) => (
            <TabletTopSellerRow
              key={seller._id || i}
              seller={seller}
              rank={i + 1}
              onPress={() =>
                navigation.navigate('LiveSellerDetail', {
                  sellerId: seller._id || seller.id || '',
                  sellerName: seller.nickname || seller.userName || '',
                  source: 'ownmall',
                })
              }
            />
          ))}
        </ScrollView>
      </View>
    ) : null;

  const tabletPortraitScheduleTopRowEl =
    isTabletPortrait && (schedule.length > 0 || topSellers.length > 0) ? (
      <View key="live-tablet-schedule-top-portrait" style={styles.tabletPortraitScheduleTopRow}>
        {schedule.length > 0 && (
          <View
            style={[
              styles.section,
              styles.tabletSchedulePanel,
              styles.tabletPortraitHalfCard,
              topSellers.length === 0 && styles.tabletPortraitHalfCardOnly,
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {t('live.liveStreamSchedule')}
              </Text>
              {liveNowCount > 0 && (
                <Text style={styles.liveNowCountText} numberOfLines={1}>
                  {liveNowCount}{' '}
                  <Text style={{ color: COLORS.text.secondary }}>{t('live.liveNowStatus')}</Text>
                </Text>
              )}
            </View>
            <ScrollView
              style={{ maxHeight: tabletPortraitScheduleScrollMax }}
              contentContainerStyle={styles.tabletPortraitScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {schedule.map((item: any, i: number) => (
                <ScheduleItem key={item._id || item.id || i} item={item} locale={locale} />
              ))}
            </ScrollView>
          </View>
        )}
        {topSellers.length > 0 && (
          <View
            style={[
              styles.section,
              styles.tabletTopSellerPanel,
              styles.tabletPortraitHalfCard,
              schedule.length === 0 && styles.tabletPortraitHalfCardOnly,
            ]}
          >
            <View style={styles.topSellerHeader}>
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {t('live.topSeller')}
              </Text>
            </View>
            <ScrollView
              style={{ maxHeight: tabletPortraitTopSellerScrollMax }}
              contentContainerStyle={styles.tabletPortraitScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {topSellers.map((seller: any, i: number) => (
                <TabletTopSellerRow
                  key={seller._id || i}
                  seller={seller}
                  rank={i + 1}
                  onPress={() =>
                    navigation.navigate('LiveSellerDetail', {
                      sellerId: seller._id || seller.id || '',
                      sellerName: seller.nickname || seller.userName || '',
                      source: 'ownmall',
                    })
                  }
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    ) : null;

  const tabletCarouselPanelEl =
    featuredItems.length > 0 ? (
      <View
        key="live-tablet-carousel"
        style={[
          styles.tabletCarouselPanel,
          isTabletPortrait && styles.tabletSegmentPortrait,
          !isTabletPortrait && tabletMinHeight
            ? { height: tabletMinHeight, overflow: 'hidden' }
            : {},
        ]}
        onLayout={handleTabletPanelLayout(2)}
      >
        <FeaturedLiveCarousel
          items={featuredItems.slice(0, 5)}
          locale={locale}
          t={t}
          isScreenFocused={isScreenFocused}
          containerWidth={isTabletPortrait ? tabletCarouselWidthPortrait : tabletCarouselWidth}
          containerStyle={{ marginTop: 0, marginHorizontal: 0 }}
          onWatchLivePress={openSellerLiveWeb}
        />
      </View>
    ) : null;

  const tabletPanelsLandscape = [tabletSchedulePanelEl, tabletTopSellerPanelEl, tabletCarouselPanelEl];
  const tabletPanelsPortrait = [tabletCarouselPanelEl, tabletPortraitScheduleTopRowEl];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Gradient background - same as homepage */}
      <LinearGradient
        colors={['#FF0000', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBackgroundFixed}
        pointerEvents="none"
      />

      {/* Red Header */}
      <LiveHeader onSearchPress={() => navigation.navigate('LiveSellerSearch')} />

      {/* Fixed sub-header (search + notice), not scrolled */}
      <View style={styles.fixedHeaderSubSection}>
        <SearchBar
          searchText={searchText}
          onChangeText={setSearchText}
          // Routes by the dropdown's current mode. The receiving screen
          // (LiveSellerSearchScreen) reads `searchMode` and renders its
          // own dropdown with the same selection so the user keeps
          // context across navigation. Default mode is 'products'.
          onSearch={(mode) =>
            navigation.navigate('LiveSellerSearch', {
              query: searchText,
              searchMode: mode,
            })
          }
          t={t}
        />
        {liveCommerceData && liveSellerPillRows.length > 0 && (
          <View style={styles.sellerPillsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sellerPillsScroll}
              contentContainerStyle={styles.sellerPillsContent}
              nestedScrollEnabled
              directionalLockEnabled
              keyboardShouldPersistTaps="handled"
            >
              {liveSellerPillRows.map((s: any, i: number) => {
                const sellerObj = s.seller || s;
                const sid = String(sellerObj._id || sellerObj.id || '');
                return (
                  <LiveSellerPill
                    key={s._id || s.id || sid || i}
                    seller={sellerObj}
                    onPress={() =>
                      navigation.navigate('LiveSellerDetail', {
                        sellerId: sid,
                        sellerName: sellerObj.nickname || sellerObj.userName || '',
                        source: 'ownmall',
                      })
                    }
                  />
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.sellerPillsNextBtn}
              onPress={() =>
                navigation.navigate('LiveSellerSearch', {
                  query: '',
                  searchMode: 'sellers',
                })
              }
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('live.sellerPillsNext')}
            >
              <LiveSellerPillsMenuIcon width={NEXT_BATON_ICON_SIZE} height={NEXT_BATON_ICON_SIZE} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
        {/* <NoticeBanner t={t} /> */}
      </View>

      {/* Initial-load spinner: shown the first time the user lands on Live
          while the live-commerce request is in flight and we have no data
          yet. Once data arrives the ScrollView takes over; subsequent
          refreshes are surfaced via the RefreshControl spinner instead. */}
      {!liveCommerceData && isLoading ? (
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color={COLORS.white} />
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Error */}
        {isError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || t('live.failedToLoadLiveCommerceData')}</Text>
          </View>
        )}

        {/* Featured Live Carousel — top of scroll on mobile; tablet uses 3-panel row below */}
        {!isTablet && (
          showHeavyContent ? (
            featuredItems.length > 0 && (
              <FeaturedLiveCarousel
                items={featuredItems.slice(0, 5)}
                locale={locale}
                t={t}
                isScreenFocused={isScreenFocused}
                onWatchLivePress={openSellerLiveWeb}
              />
            )
          ) : (
            <View style={liveSkeletonStyles.featuredPlaceholder} />
          )
        )}

        {/* Defer frame: schedule skeleton under the carousel placeholder */}
        {!isTablet && !showHeavyContent && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('live.liveStreamSchedule')}</Text>
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={liveSkeletonStyles.scheduleRow} />
            ))}
          </View>
        )}
        {showHeavyContent && !isTablet && schedule.length > 0 && topSellers.length > 0 && (
          <View style={styles.mobileScheduleTopSellerColumn}>
            <View style={[styles.section, styles.mobileScheduleTopSellerSection]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t('live.liveStreamSchedule')}</Text>
                {liveNowCount > 0 && (
                  <Text style={styles.liveNowCountText}>
                    {liveNowCount}{' '}
                    <Text style={{ color: COLORS.text.secondary }}>{t('live.liveNowStatus')}</Text>
                  </Text>
                )}
              </View>
              {schedule.slice(0, 6).map((item: any, i: number) => (
                <ScheduleItem key={item._id || item.id || i} item={item} locale={locale} />
              ))}
            </View>
            <View style={[styles.section, styles.mobileScheduleTopSellerSection]}>
              <View style={styles.topSellerHeader}>
                <Text style={styles.sectionTitle}>{t('live.topSeller')}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topSellerRowContent}
              >
                {topSellers.slice(0, 10).map((seller: any, i: number) => (
                  <TopSellerItem
                    key={seller._id || i}
                    seller={seller}
                    onPress={() => navigation.navigate('LiveSellerDetail', {
                      sellerId: seller._id || seller.id || '',
                      sellerName: seller.nickname || seller.userName || '',
                      source: 'ownmall',
                    })}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        )}
        {showHeavyContent && !isTablet && schedule.length > 0 && topSellers.length === 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('live.liveStreamSchedule')}</Text>
              {liveNowCount > 0 && (
                <Text style={styles.liveNowCountText}>
                  {liveNowCount}{' '}
                  <Text style={{ color: COLORS.text.secondary }}>{t('live.liveNowStatus')}</Text>
                </Text>
              )}
            </View>
            {schedule.slice(0, 6).map((item: any, i: number) => (
              <ScheduleItem key={item._id || item.id || i} item={item} locale={locale} />
            ))}
          </View>
        )}
        {showHeavyContent && !isTablet && schedule.length === 0 && liveCommerceData && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('live.liveStreamSchedule')}</Text>
            </View>
            <Text style={styles.liveStreamScheduleEmptyText}>{t('live.liveStreamScheduleEmpty')}</Text>
          </View>
        )}
        {showHeavyContent && !isTablet && topSellers.length > 0 && schedule.length === 0 && (
          <View style={styles.section}>
            <View style={styles.topSellerHeader}>
              <Text style={styles.sectionTitle}>{t('live.topSeller')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topSellerRowContent}
            >
              {topSellers.slice(0, 10).map((seller: any, i: number) => (
                <TopSellerItem
                  key={seller._id || i}
                  seller={seller}
                  onPress={() => navigation.navigate('LiveSellerDetail', {
                    sellerId: seller._id || seller.id || '',
                    sellerName: seller.nickname || seller.userName || '',
                    source: 'ownmall',
                  })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {showHeavyContent ? (
          <>
            {/* Tablet: landscape = Schedule | Top Seller | Carousel; portrait = Carousel then row(Schedule | Top Seller), ~40% cards, ~5 rows + scroll */}
            {isTablet && (
              <View
                style={[
                  styles.tabletPanelRow,
                  isTabletPortrait && styles.tabletPanelRowPortrait,
                ]}
              >
                {(isTabletPortrait ? tabletPanelsPortrait : tabletPanelsLandscape).filter(Boolean)}
              </View>
            )}

            {/* Popular Items */}
            {popularItems.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { marginVertical: SPACING.sm }]}>{t('live.popularItems')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.popularScroll}
                >
                  {popularItems.map((item: any, i: number) => (
                    <PopularItemCard
                      key={item.id || i}
                      item={item}
                      locale={locale}
                      rank={i + 1}
                      onPress={() => {
                        const productId = item.offerId || item.productNo || item.productId || item.product?.id || item.id || '';
                        const liveCodeParam =
                          item.liveCode ||
                          item.live_code ||
                          item.liveCommerceCode ||
                          item.product?.liveCode ||
                          item.product?.live_code ||
                          item.offerId ||
                          item.product?.offerId ||
                          undefined;
                        if (productId) {
                          navigation.navigate('ProductDetail', {
                            productId,
                            source: 'live-commerce',
                            ...(liveCodeParam != null && liveCodeParam !== ''
                              ? { liveCode: String(liveCodeParam) }
                              : {}),
                          });
                        }
                      }}
                      t={t}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Point Partner Seller */}
            {pointPartnerSellers.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { marginVertical: SPACING.sm }]}>{t('live.pointPartnerSeller')}</Text>
                <View style={styles.partnerGrid}>
                  {pointPartnerSellers.map((seller: any, i: number) => (
                    <PointPartnerSellerCard
                      key={seller._id || i}
                      sellerKey={String(seller._id ?? seller.id ?? `partner-${i}`)}
                      seller={seller}
                      locale={locale}
                      onPress={() => navigation.navigate('LiveSellerDetail', {
                        sellerId: seller._id || seller.id || '',
                        sellerName: seller.userName || seller.nickname || '',
                        source: 'ownmall',
                      })}
                      onProductPress={(prod) => {
                        const productId = prod?.offerId || prod?.productNo || prod?.productId || prod?.id || '';
                        const liveCodeParam =
                          prod?.liveCode ||
                          prod?.live_code ||
                          prod?.liveCommerceCode ||
                          prod?.product?.liveCode ||
                          prod?.offerId ||
                          prod?.product?.offerId ||
                          undefined;
                        if (productId) {
                          navigation.navigate('ProductDetail', {
                            productId,
                            source: 'live-commerce',
                            ...(liveCodeParam != null && liveCodeParam !== ''
                              ? { liveCode: String(liveCodeParam) }
                              : {}),
                          });
                        }
                      }}
                      t={t}
                      cardStyle={{ width: partnerCardWidth }}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          // Skeleton sections — render the morphological structure of each
          // grid (titles + gray boxes shaped like real items) so the user
          // sees the page composition during the one-frame defer window.
          // Sizes match the real components below to avoid layout shift.
          <>
            <View style={styles.section}>
              <View style={styles.topSellerHeader}>
                <Text style={styles.sectionTitle}>{t('live.topSeller')}</Text>
              </View>
              <View style={liveSkeletonStyles.topSellerRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <View key={i} style={liveSkeletonStyles.topSellerAvatar} />
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.sectionTitle, { marginVertical: SPACING.sm }]}>{t('live.popularItems')}</Text>
              <View style={liveSkeletonStyles.popularRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={liveSkeletonStyles.popularCard} />
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.sectionTitle, { marginVertical: SPACING.sm }]}>{t('live.pointPartnerSeller')}</Text>
              <View style={styles.partnerGrid}>
                {Array.from({ length: PARTNER_COLS }).map((_, i) => (
                  <View key={i} style={[liveSkeletonStyles.partnerCard, { width: partnerCardWidth }]} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Gradient background
  gradientBackgroundFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 650,
    zIndex: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.smmd,
    zIndex: 1,
    alignItems: 'flex-end',
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
  broadcastIcon: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
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

  fixedHeaderSubSection: {
    backgroundColor: 'transparent',
    zIndex: 2,
    bottom: 0,
  },

  /** Pills scroll left/center; trailing control stays pinned on the right */
  sellerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.xs,
    paddingBottom: SPACING.sm / 2,
    minHeight: LIVE_SELLER_PILL_H + 4,
  },
  sellerPillsScroll: {
    flex: 1,
    minWidth: 0,
  },
  /**
   * Do NOT use flexGrow:fillWidth here — it stretches content to the viewport and
   * breaks horizontal scrolling when there are many pills. Keep intrinsic row width.
   */
  sellerPillsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.xs,
  },
  sellerPillTouchable: {
    marginRight: SPACING.sm,
  },
  sellerPillBorderWrap: {
    width: LIVE_SELLER_PILL_W,
    height: LIVE_SELLER_PILL_H,
    borderRadius: LIVE_SELLER_PILL_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
    position: 'relative',
  },
  sellerPillGradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  sellerPillInnerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SELLER_PILL_PAD_L,
    paddingRight: SELLER_PILL_PAD_R,
  },
  sellerPillIconRing: {
    width: SELLER_PILL_AVATAR,
    height: SELLER_PILL_AVATAR,
    borderRadius: SELLER_PILL_AVATAR / 2,
    overflow: 'hidden',
    marginRight: SELLER_PILL_AVATAR_GAP,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sellerPillAvatarImg: {
    width: SELLER_PILL_AVATAR,
    height: SELLER_PILL_AVATAR,
    borderRadius: SELLER_PILL_AVATAR / 2,
  },
  sellerPillRedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 0, 0, 0.6)',
    borderRadius: SELLER_PILL_AVATAR / 2,
  },
  /** Keeps seller name + trailing graphic adjacent; extra pill width goes in tailSpacer */
  sellerPillNameDecorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  sellerPillTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    maxHeight: LIVE_SELLER_PILL_H,
  },
  /** “다음” vector art — tight to name; display-only */
  sellerPillDecorLabel: {
    justifyContent: 'center',
    marginLeft: 6,
    flexShrink: 0,
  },
  sellerPillTailSpacer: {
    flex: 1,
    minWidth: 0,
    minHeight: 1,
  },
  sellerPillName: {
    fontSize: SELLER_PILL_FONT_SIZE,
    fontWeight: '700',
    color: COLORS.text.primary,
    lineHeight: SELLER_PILL_LINE_HEIGHT,
  },
  sellerPillNameAndroid: {
    includeFontPadding: false,
  },
  /** Fixed right: menu icon — seller search (same as before decorative label move) */
  sellerPillsNextBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: NEXT_BATON_WIDTH,
    height: NEXT_BATON_HEIGHT,
    marginLeft: SPACING.xs,
  },

  scrollContent: {
    paddingBottom: SPACING.xl,
  },

  initialLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
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
  // Two-item menu opened by tapping the seller dropdown. Absolutely
  // positioned so it overlays the row below without affecting layout;
  // elevation/zIndex put it above the search input.
  sellerDropdownMenu: {
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
  sellerDropdownMenuItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sellerDropdownMenuItemActive: {
    backgroundColor: COLORS.gray[100],
  },
  sellerDropdownMenuItemText: {
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
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Notice Banner
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    height: 24,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.smmd,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  noticeBrandIcon: {
    position: 'absolute',
    left: SPACING.sm,
    zIndex: 5,
  },
  noticeBannerContent: {
    flex: 1,
    paddingLeft: 30,
    justifyContent: 'center',
    maxHeight: 24,
  },
  noticeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '400',
    color: COLORS.white,
    lineHeight: 24,
    paddingRight: 24,
  },
  noticeNextButton: {
    paddingHorizontal: SPACING.sm,
  },
  noticeNextButtonText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 24,
  },

  // Carousel
  carouselContainer: {
    marginTop: SPACING.smmd / 2,
    marginHorizontal: SPACING.sm,
  },
  carouselItem: {
    width: CAROUSEL_WIDTH,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.transparent,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.black,
  },
  carouselMediaBlock: {
    width: '100%',
    height: 470,
    position: 'relative',
  },
  carouselBottomFadeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  carouselSellerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.smmd,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderTopLeftRadius: BORDER_RADIUS.xl - 2,
    borderTopRightRadius: BORDER_RADIUS.xl - 2,
  },
  carouselSellerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.white,
    marginRight: SPACING.sm,
  },
  carouselSellerInfo: {
    flex: 1,
  },
  carouselSellerName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
  },
  carouselViewers: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    opacity: 0.9,
  },
  watchLiveBatonWrap: {
    position: 'relative',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.md,
  },
  watchLiveBatonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    zIndex: 1,
    gap: SPACING.xs,
  },
  watchLiveBatonEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  watchLiveBatonTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  carouselImage: {
    width: '100%',
    height: 470,
  },
  liveNowBadge: {
    position: 'absolute',
    top: 65,
    left: SPACING.smmd,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    zIndex: 10,
  },
  liveNowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: 6,
  },
  liveNowText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '800',
    color: COLORS.white,
  },
  carouselEventInfo: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.smmd,
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  carouselEventTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '900',
    color: COLORS.white,
    lineHeight: 26,
  },
  carouselEventDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    marginTop: SPACING.xs,
  },
  carouselEventTime: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
  },
  carouselWatchButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: CAROUSEL_WIDTH,
  },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationPill: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.black,
    borderBottomLeftRadius: 6.5,
    borderBottomRightRadius: 6.5,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF80',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: COLORS.white,
  },

  // Section
  section: {
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.smmd,
    paddingHorizontal: SPACING.sm,
  },
  /** When schedule + top seller both show on phone, one column so card widths match */
  mobileScheduleTopSellerColumn: {
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  mobileScheduleTopSellerSection: {
    marginHorizontal: 0,
    marginTop: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.smmd,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '900',
    color: COLORS.text.primary,
    marginHorizontal: SPACING.sm,
    fontFamily: FONTS.families.black,
  },
  liveStreamScheduleEmptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.smmd,
    marginTop: -SPACING.xs,
  },
  liveNowCountText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: '#FF0000',
  },

  // Schedule list
  scheduleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.smmd,
  },
  scheduleAvatarWrapper: {
    position: 'relative',
    marginRight: SPACING.smmd,
    overflow: 'hidden',
  },
  scheduleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gray[200],
  },
  scheduleLiveDot: {
    position: 'absolute',
    top: -1,
    left: 6,
    right: 6,
    backgroundColor: '#FF0000',
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    paddingVertical: 1,
  },
  scheduleLiveDotText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.white,
  },
  scheduleItemInfo: {
    flex: 1,
  },
  scheduleItemName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  scheduleItemTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  scheduleItemRight: {
    alignItems: 'flex-end',
  },
  scheduleItemViewers: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  scheduleItemViewersLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
  },

  // Top Seller
  topSellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.smmd,
  },
  topSellerRowsContainer: {
    gap: SPACING.smmd,
  },
  topSellerRowContent: {
    paddingHorizontal: SPACING.md,
  },
  topSellerItem: {
    alignItems: 'center',
    marginRight: SPACING.lg,
    flexDirection: 'row',
    maxWidth: 200,
    gap: SPACING.sm,
  },
  topSellerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.gray[200],
    marginBottom: SPACING.xs,
  },
  topSellerInfo: {
    alignItems: 'flex-start',
  },
  topSellerName: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '800',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  topSellerSold: {
    fontSize: 11,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  topSellerSoldBold: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Popular Items
  popularScroll: {
    paddingHorizontal: SPACING.sm,
  },
  popularCard: {
    width: POPULAR_CARD_W,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.transparent,
    marginRight: SPACING.smmd,
  },
  popularImageContainer: {
    position: 'relative',
  },
  popularImage: {
    marginTop: 8,
    width: '100%',
    height: POPULAR_IMAGE_H,
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.lg,
  },
  popularImageGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: POPULAR_IMAGE_GRADIENT_H,
    borderBottomLeftRadius: BORDER_RADIUS.lg,
    borderBottomRightRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    zIndex: 2,
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    right: Math.round(20 * POPULAR_CARD_SCALE),
    alignItems: 'center',
    zIndex: 10,
  },
  rankTextContainer: {
    position: 'absolute',
    top: 0,
  },
  rankBadgeTop: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: 2,
    borderTopLeftRadius: BORDER_RADIUS.sm,
    borderTopRightRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  rankBadgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFDD00',
  },
  rankBadgeLabelSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFDD00',
  },
  rankBadgeNumber: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '900',
    color: COLORS.white,
    paddingHorizontal: SPACING.smmd,
    paddingBottom: SPACING.xs,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
    borderBottomRightRadius: BORDER_RADIUS.sm,
    textAlign: 'center',
    overflow: 'hidden',
  },
  popularReviewSoldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    paddingHorizontal: SPACING.smmd,
    position: 'absolute',
    bottom: POPULAR_RATING_BOTTOM - 15,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  popularRatingStarsShell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.smmd,
    paddingTop: SPACING.xs,
    position: 'absolute',
    bottom: POPULAR_RATING_BOTTOM - 15,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  popularRatingStarsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  popularRatingStarsShellWithMeta: {
    bottom: POPULAR_STARS_BOTTOM - 15,
  },
  popularRatingText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 4,
  },
  popularReviewCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    flexShrink: 1,
  },
  popularSoldCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    flexShrink: 1,
  },
  popularTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.white,
    paddingHorizontal: SPACING.smmd,
    position: 'absolute',
    bottom: POPULAR_TITLE_BOTTOM - 15,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  popularSellerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: SPACING.smmd,
    paddingTop: SPACING.smmd,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    position: 'absolute',
    bottom: POPULAR_SELLER_BOTTOM - 15,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  popularSellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.gray[200],
  },
  popularSellerName: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.white,
    flex: 1,
  },
  popularTotalViews: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'right',
  },
  popularTotalViewsLabel: {
    fontSize: 10,
    color: COLORS.white,
    textAlign: 'right',
  },
  popularBottomStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: SPACING.smmd,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    position: 'absolute',
    bottom: POPULAR_STRIP_BOTTOM,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  popularStripAvatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.gray[200],
  },
  popularStripTitle: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
  },
  popularBottomStripPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: SPACING.xs,
  },
  popularStripPrice: {
    flex: 1,
    minWidth: 0,
    fontSize: FONTS.sizes.md,
    fontWeight: '900',
    color: COLORS.white,
  },
  popularStripShopNow: {
    flexShrink: 0,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.red,
  },

  // Point Partner Seller
  partnerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.smmd,
  },
  partnerCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.smmd,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  partnerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.smmd,
  },
  partnerAvatarWrapper: {
    width: 64,
    alignItems: 'center',
  },
  partnerAvatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  partnerAvatarRingLive: {
    borderColor: '#FF0000',
  },
  partnerAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  partnerLiveBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: '#FF0000',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  partnerLiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
  },
  partnerLiveCaption: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#FF0000',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  partnerLiveCaptionText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.white,
  },
  partnerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  partnerName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  partnerStats: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  partnerSocialBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerSocialGlyph: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  partnerProductsWrap: {
    marginTop: SPACING.smmd,
  },
  partnerProductsPage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  partnerProductCell: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
    gap: 2,
  },
  partnerProductImageLg: {
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray[200],
  },
  partnerProductCellInfo: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
  },
  partnerProductCellTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  partnerProductCellPrice: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginTop: 0,
    textAlign: 'center',
  },
  partnerDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  partnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gray[300],
  },
  partnerDotActive: {
    backgroundColor: COLORS.text.primary,
  },
  ownMallRowWrap: {
    marginTop: SPACING.smmd,
  },
  ownMallContent: {
    flexDirection: 'row',
  },
  ownMallProductImage: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[200],
  },
  ownMallProductPrice: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    fontWeight: '800',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  ownMallBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray[200],
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  ownMallBarThumb: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.text.primary,
  },

  // Tablet 3-panel horizontal layout
  tabletPanelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.lg / 2,
    marginHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  tabletPanelRowPortrait: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  tabletSegmentPortrait: {
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 0,
  },
  tabletPortraitScheduleTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    gap: SPACING.smmd,
  },
  tabletPortraitHalfCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    marginTop: 0,
    marginHorizontal: 0,
  },
  tabletPortraitHalfCardOnly: {
    flex: 1,
    flexBasis: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  tabletPortraitScrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xs,
  },
  tabletSchedulePanel: {
    flex: 2,
    flexBasis: 0,
    minWidth: 0,
    marginTop: 0,
    marginHorizontal: 0,
  },
  tabletTopSellerPanel: {
    flex: 2,
    flexBasis: 0,
    minWidth: 0,
    marginTop: 0,
    marginHorizontal: 0,
  },
  tabletCarouselPanel: {
    flex: 7,
  },
  tabletTSRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xssm,
    gap: SPACING.xs,
  },
  tabletTSAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[200],
  },
  tabletTSName: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  tabletTSSold: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
  },
  tabletTSBadge: {
    backgroundColor: '#FFDD00',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  tabletTSBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text.primary,
  },

  // Empty & Error states
  emptyState: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  errorContainer: {
    padding: SPACING.md,
    backgroundColor: '#FFE5E5',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  errorText: {
    color: '#D00000',
    fontWeight: '700',
  },

  sellerLiveWebRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  sellerLiveWebHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  sellerLiveWebCloseBtn: {
    minWidth: 72,
  },
  sellerLiveWebCloseText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sellerLiveWebTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  sellerLiveWebHeaderSpacer: {
    minWidth: 72,
  },
  sellerLiveWebView: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});

// Skeleton placeholder styles — render the morphological shape of each
// section (gray boxes sized like real items) during the one-frame defer
// window before showHeavyContent flips to true. Sizes mirror the real
// styles above so swapping in the real components causes no layout shift.
const liveSkeletonStyles = StyleSheet.create({
  // Featured carousel: matches CAROUSEL_HEIGHT (420)
  featuredPlaceholder: {
    height: CAROUSEL_HEIGHT,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.smmd / 2,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray[100],
  },
  // Schedule rows (~ScheduleItem height) during defer frame
  scheduleRow: {
    height: 56,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[200],
  },
  // Top Seller row: 5 circle avatars matching topSellerAvatar (60x60)
  topSellerRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
  },
  topSellerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.gray[200],
    marginRight: SPACING.lg,
  },
  // Popular Items row: skeleton matches POPULAR_CARD_W × POPULAR_IMAGE_H
  popularRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
  },
  popularCard: {
    width: POPULAR_CARD_W,
    height: POPULAR_IMAGE_H,
    marginTop: 8,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray[200],
    marginRight: SPACING.smmd,
  },
  // Partner grid: 4 cards in 2 columns matching partnerCard width formula
  partnerCard: {
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.smmd) / 2,
    height: 162,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray[100],
  },
});

export default LiveScreen;
