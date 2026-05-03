import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../components/Icon';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { COLORS, FONTS, SPACING, BORDER_RADIUS, BACK_NAVIGATION_HIT_SLOP } from '../../../constants';
import { useAppSelector } from '../../../store/hooks';
import { translations } from '../../../i18n/translations';
import { useSocket } from '../../../context/SocketContext';
import { inquiryApi } from '../../../services/inquiryApi';

const CustomerServiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';
  const { onMessageReceived, onUnreadCountUpdated, unreadCount } = useSocket();
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  // Keep this hook to preserve stable hook ordering across fast refresh
  // after the search input was removed from UI.
  const [searchQuery] = useState('');
  
  // Translation function
  const t = (key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    if (typeof value === 'string' && params) {
      Object.keys(params).forEach((paramKey) => {
        value = value.replace(`{${paramKey}}`, String(params[paramKey]));
      });
    }
    return value || key;
  };

  // Fetch unread counts when screen comes into focus using REST API
  useFocusEffect(
    React.useCallback(() => {
      const fetchUnreadCounts = async () => {
        try {
          const response = await inquiryApi.getUnreadCounts();
          if (response.success && response.data) {
            setTotalUnreadCount(response.data.totalUnread);
            // Note: onUnreadCountUpdated is a callback registration function, not a direct update function
            // The socket context will handle updates via its own event listeners
          }
        } catch (error) {
          // console.error('Failed to fetch unread counts:', error);
        }
      };
      fetchUnreadCounts();
    }, [])
  );

  // Update total unread count from socket context
  useEffect(() => {
    setTotalUnreadCount(unreadCount);
  }, [unreadCount]);

  // Listen to socket events for new messages
  useEffect(() => {
    const handleMessageReceived = (data: { 
      message: any; 
      inquiryId: string; 
      unreadCount?: number; 
      totalUnreadCount?: number;
    }) => {
      // Update total unread count when new message arrives
      if (data.totalUnreadCount !== undefined) {
        setTotalUnreadCount(data.totalUnreadCount);
      }
    };

    const handleUnreadCountUpdated = (count: number) => {
      setTotalUnreadCount(count);
    };

    onMessageReceived(handleMessageReceived);
    onUnreadCountUpdated(handleUnreadCountUpdated);

    // Cleanup
    return () => {
      // Cleanup handled by socket context
    };
  }, [onMessageReceived, onUnreadCountUpdated]);

  const handlePhoneCall = () => {
    const phoneNumber = '070-7792-6663';
    const phoneUrl = Platform.OS === 'ios' ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;
    Linking.openURL(phoneUrl);
  };

  const handleKakaoTalk = () => {
    // Open KakaoTalk or show message
    // console.log('Open KakaoTalk');
    // You can implement deep linking to KakaoTalk here
  };

  const handleOrderInquiry = () => {
    (navigation as any).navigate('Message', { initialTab: 'order' });
  };

  const serviceItems = [
    {
      id: 'phone',
      title: t('customerService.phoneCounsel'),
      value: '070-7792-6663',
      icon: 'call',
      iconColor: COLORS.white,
      containerStyle: styles.phoneButton,
      textStyle: styles.phoneButtonText,
      onPress: handlePhoneCall,
    },
    {
      id: 'kakao',
      title: t('customerService.kakaoTalk'),
      icon: 'chatbubble',
      iconColor: COLORS.red,
      containerStyle: styles.kakaoButton,
      textStyle: styles.kakaoButtonText,
      onPress: handleKakaoTalk,
    },
    {
      id: 'order',
      title: t('customerService.orderInquiry'),
      icon: 'document-text',
      iconColor: COLORS.red,
      containerStyle: styles.orderButton,
      textStyle: styles.orderButtonText,
      onPress: handleOrderInquiry,
    },
  ];

  const filteredItems = searchQuery ? serviceItems : serviceItems;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('customerService.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Icon name="headset" size={22} color={COLORS.white} />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>{t('customerService.onlineClientCenter')}</Text>
              <Text style={styles.heroSubtitle}>{t('customerService.phoneCounsel')}</Text>
            </View>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.sectionTitle}>{t('customerService.onlineClientCenter')}</Text>

            {filteredItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.contactButton, item.containerStyle]}
                onPress={item.onPress}
                activeOpacity={0.85}
              >
                <View style={styles.contactButtonLeft}>
                  <View style={[styles.contactIconWrap, item.id === 'phone' && styles.phoneIconWrap]}>
                    <Icon name={item.icon} size={item.id === 'phone' ? 20 : 18} color={item.iconColor} />
                  </View>
                  <View style={styles.contactTextWrap}>
                    <Text style={styles.contactTitle}>{item.title}</Text>
                    <Text style={item.textStyle}>{item.value || item.title}</Text>
                  </View>
                </View>
                <View style={styles.orderRightArea}>
                  <Icon
                    name="chevron-forward"
                    size={18}
                    color={item.id === 'phone' ? COLORS.white : COLORS.red}
                  />
                  {item.id === 'order' && totalUnreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {totalUnreadCount > 0 && (
            <View style={styles.tipContainer}>
              <Icon name="notifications" size={16} color={COLORS.red} />
              <Text style={styles.tipText}>
                {t('customerService.searchResults', { count: totalUnreadCount })}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes['xl'],
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  placeholder: {
    width: 32,
    height: 32,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.secondary,
  },
  contentContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactButtonLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    flex: 1,
  },
  contactTextWrap: {
    flex: 1,
  },
  contactTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  contactIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneIconWrap: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  phoneButton: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  phoneButtonText: {
    fontSize: FONTS.sizes.base,
    fontWeight: '600',
    color: COLORS.white,
  },
  kakaoButton: {
    backgroundColor: COLORS.lightRed,
    borderColor: COLORS.red,
  },
  kakaoButtonText: {
    fontSize: FONTS.sizes.base,
    fontWeight: '600',
    color: COLORS.red,
  },
  orderButton: {
    backgroundColor: COLORS.lightRed,
    borderColor: COLORS.red,
  },
  orderRightArea: {
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  orderButtonText: {
    fontSize: FONTS.sizes.base,
    fontWeight: '600',
    color: COLORS.red,
  },
  unreadBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.red,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  unreadBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  tipContainer: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.lightRed,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  tipText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.red,
    fontWeight: '600',
  },
});

export default CustomerServiceScreen;
