import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../../components/Icon';
import { LinearGradient } from 'react-native-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { BORDER_RADIUS, COLORS, FONTS, SPACING, BACK_NAVIGATION_HIT_SLOP } from '../../../../constants';
import { RootStackParamList } from '../../../../types';
import { useAuth } from '../../../../context/AuthContext';
import { DeleteAccountModal } from '../../../../components';
import { InviteCodeBindingModal } from '../../../../components';
import { useAppSelector } from '../../../../store/hooks';
import { translations } from '../../../../i18n/translations';
import LogoutIcon from '../../../../assets/icons/LogoutIcon';

type ProfileSettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileSettings'>;

/** 2× BACK_NAVIGATION_HIT_SLOP — larger tap area only; icon / backButton layout unchanged */
const PROFILE_SETTINGS_BACK_HIT_SLOP = {
  top: BACK_NAVIGATION_HIT_SLOP.top * 2,
  bottom: BACK_NAVIGATION_HIT_SLOP.bottom * 2,
  left: BACK_NAVIGATION_HIT_SLOP.left * 2,
  right: BACK_NAVIGATION_HIT_SLOP.right * 2,
};

const ProfileSettingsScreen: React.FC = () => {
  const navigation = useNavigation<ProfileSettingsScreenNavigationProp>();
  const { user, logout, isAuthenticated, updateUser } = useAuth();
  const locale = useAppSelector((state) => state.i18n.locale) as 'en' | 'ko' | 'zh';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  
  // Translation function
  const t = (key: string, params?: { [key: string]: string }) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    if (params && typeof value === 'string') {
      Object.keys(params).forEach(paramKey => {
        value = value.replace(`{${paramKey}}`, params[paramKey]);
      });
    }
    return value || key;
  };

  // Korean favorite colors for menu icons (same as ProfileScreen)
  const getMenuIconColor = (index: number) => {
    const colors = [
      { bg: COLORS.lightRed, icon: COLORS.red }, // Project red
      { bg: '#E8F4FD', icon: '#4A90E2' }, // Sky blue
      { bg: '#E8F8F5', icon: '#26D0CE' }, // Mint
      { bg: '#FFF4E6', icon: '#FF9500' }, // Orange
      { bg: '#F3E8FF', icon: '#9C88FF' }, // Lavender
      { bg: COLORS.lightRed, icon: COLORS.red }, // Project red
      { bg: '#E8FFE8', icon: '#4CAF50' }, // Green
      { bg: '#FFF0E6', icon: '#FF8A65' }, // Peach
      { bg: '#E6F3FF', icon: '#42A5F5' }, // Light blue
      { bg: '#F0E6FF', icon: '#AB47BC' }, // Purple
      { bg: '#E6FFF0', icon: '#66BB6A' }, // Light green
    ];
    return colors[index % colors.length];
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Reset navigation stack and navigate to Home tab
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes: [{ name: 'Home' }],
                index: 0,
              },
            },
          ],
        })
      );
    } catch (error) {
      // console.error('Logout error:', error);
    }
  };

  const showComingSoon = (feature: string) => {
    // console.log(`${feature} feature coming soon`);
  };

  const handleDeleteAccount = async (password: string) => {
    try {
      // TODO: Implement actual API call to delete account with password verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      Alert.alert(
        t('profile.accountDeleted'),
        t('profile.accountDeletedMessage'),
        [
          {
            text: t('profile.ok'),
            onPress: async () => {
              await logout();
              navigation.navigate('Auth');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToDeleteAccount'));
      throw error;
    }
  };

  const handleBindInviteCode = async (inviteCode: string) => {
    try {
      // TODO: Implement actual API call to bind invite code
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      Alert.alert(
        t('shareApp.success'),
        t('profile.inviteCodeBound', { inviteCode }),
        [{ text: t('profile.ok') }]
      );
    } catch (error) {
      Alert.alert(t('common.error'), t('profile.failedToBindCode'));
      throw error;
    }
  };

  const renderHeader = () => (
    // <LinearGradient
    //   colors={['#FFE4E6', '#FFF0F1', '#FFFFFF']}
    <View
      style={styles.header}
    >
      <TouchableOpacity hitSlop={PROFILE_SETTINGS_BACK_HIT_SLOP}
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('profile.settings')}</Text>
      <View style={styles.placeholder} />
    {/* </LinearGradient> */}
    </View>
  );

  const renderUserSection = () => (
    <View style={styles.userSection}>
      <View style={styles.userCard}>
        <View style={styles.avatarContainer}>
          <Image
            source={
              user?.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== ''
                ? { uri: user.avatar } 
                : require('../../../../assets/images/avatar.png')
            }
            style={styles.avatar}
          />
          <View style={styles.avatarBorder} />
        </View>
        {isAuthenticated && user?.name && (
          <Text style={styles.userName}>{user.name}</Text>
        )}
      </View>
    </View>
  );

  const renderMenuItems = () => {
    const menuItems = [
      {
        name: t('profile.accountandsecurity'),
        items: [
          // {
          //   icon: 'person-outline',
          //   title: t('profile.myDetails'),
          //   onPress: () => navigation.navigate('EditProfile'),
          // },
          // {
          //   icon: 'key-outline',
          //   title: t('profile.changePassword'),
          //   onPress: () => navigation.navigate('ChangePassword'),
          // },
          // {
          //   icon: 'storefront-outline',
          //   title: 'Followed Store',
          //   onPress: () => (navigation as any).navigate('FollowedStore'),
          // },
          // {
          //   icon: 'trending-up-outline',
          //   title: t('profile.affiliateMarketing'),
          //   onPress: () => navigation.navigate('AffiliateMarketing' as never),
          // },
          // {
          //   icon: 'cube-outline',
          //   title: t('profile.unit'),
          //   onPress: () => navigation.navigate('UnitSettings'),
          // },
          // {
          //   icon: 'lock-closed-outline',
          //   title: t('profile.paymentPassword'),
          //   onPress: () => navigation.navigate('PaymentPassword'),
          // },
          // {
          //   icon: 'trash-outline',
          //   title: t('profile.deleteAccount'),
          //   onPress: () => setShowDeleteModal(true),
          // },
          // {
          //   icon: 'gift-outline',
          //   title: t('profile.inviteCodeBinding'),
          //   onPress: () => setShowInviteCodeModal(true),
          // },
          {
            icon: 'person-outline',
            title: t('profile.shippingAddress'),
            onPress: () => navigation.navigate('AddressBook', { fromShippingSettings: false }),
          },
          {
            icon: 'person-outline',
            title: t('profile.securitySettings'),
            onPress: () => navigation.navigate('SecuritySettings'),
          },
          {
            icon: 'person-outline',
            title: t('profile.personalInformation'),
            onPress: () => navigation.navigate('EditProfile'),
          },
          // {
          //   icon: 'person-outline',
          //   title: t('profile.personalTransactionSettings'),
          //   onPress: () => navigation.navigate('PaymentPassword'),
          // },
          {
            icon: 'person-outline',
            title: t('profile.affiliateMarketing'),
            onPress: () => navigation.navigate('AffiliateMarketing'),
          },
          // {
          //   icon: 'person-outline',
          //   title: t('profile.bindInviteCode'),
          //   onPress: () => setShowInviteCodeModal(true),
          // },
          // {
          //   icon: 'person-outline',
          //   title: t('profile.countryRegion'),
          //   onPress: () => navigation.navigate(''),
          // },
        ]
      },
      {
        name: t('profile.sellerInfo'),
        items: [
          {
            icon: 'key-outline',
            title: t('profile.Sellerpage'),
            onPress: () => navigation.navigate('SellerStack', { screen: 'SellerHome' }),
          },
          {
            icon: 'key-outline',
            title: t('profile.SellerSalesRefundInfo'),
            onPress: () => navigation.navigate('SellerStack', { screen: 'SellerSalesRefundInfo' }),
          },
          {
            icon: 'key-outline',
            title: t('profile.sellerTeamInfo'),
            onPress: () => navigation.navigate('SellerStack', { screen: 'SellerTeamInfo' }),
          },
          
         
          // {
          //   icon: 'trending-up-outline',
          //   title: t('profile.aboutUs'),
          //   onPress: () => navigation.navigate('AboutUs'),
          // },
        ]
      },

      {
        name: t('profile.about'),
        items: [
          // {
          //   icon: 'person-outline',
          //   title: t('profile.merchantOnboarding'),
          //   onPress: () => navigation.navigate('EditProfile'),
          // },
          {
            icon: 'key-outline',
            title: t('profile.helpCenter'),
            onPress: () => navigation.navigate('HelpCenter'),
          },
          {
            icon: 'trending-up-outline',
            title: t('profile.aboutUs'),
            onPress: () => navigation.navigate('AboutUs'),
          },
        ]
      }
    ];

    return (
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <View style={{ marginBottom: SPACING.sm, backgroundColor: COLORS.white, 
            marginHorizontal: SPACING.sm, }} key={index}>
            <View style={[styles.menuItem, { borderBottomWidth: 0, paddingVertical: SPACING.md }]} key={index}>
              <Text style={[styles.menuItemText, { fontWeight: '700', fontSize: FONTS.sizes.md }]}>{item.name}</Text>
            </View>
            {item.items.map((i, index2) => (
              <TouchableOpacity
                key={index2}
                style={[
                  styles.menuItem,
                  index2 === 0 && styles.firstMenuItem,
                  index2 === item.items.length - 1 && styles.lastMenuItem
                ]}
                onPress={i.onPress}
              >
                <View style={styles.menuItemLeft}>
                  {/* <View style={[styles.menuIconContainer, { backgroundColor: getMenuIconColor(index).bg }]}>
                    <Icon name={i.icon as any} size={22} color={getMenuIconColor(index).icon} />
                  </View> */}
                  <Text style={styles.menuItemText}>{i.title}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={COLORS.black} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* {renderUserSection()} */}
        {renderMenuItems()}
        
        {isAuthenticated && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            {/* <View style={styles.logoutIconContainer}>
              <LogoutIcon width={20} height={20} color={COLORS.error} />
            </View> */}
            <Text style={styles.logoutText}>{t('profile.logOut')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />

      <InviteCodeBindingModal
        visible={showInviteCodeModal}
        onClose={() => setShowInviteCodeModal(false)}
        onSubmit={handleBindInviteCode}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 32,
    height: 32,
  },
  scrollView: {
    flex: 1,
  },
  userSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    marginTop: -20,
  },
  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: SPACING.md,
    padding: SPACING.xl,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.gray[200],
  },
  avatarBorder: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  userName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  menuContainer: {
    // backgroundColor: COLORS.white,
    // borderRadius: SPACING.md,
    marginBottom: SPACING.xl,
    // shadowColor: COLORS.shadow,
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 8,
    // elevation: 4,
    // overflow: 'hidden',
    // borderWidth: 1,
    // borderColor: COLORS.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    backgroundColor: COLORS.white,
  },
  firstMenuItem: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  menuItemText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '400',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.sm,
    marginBottom: 100,
    paddingVertical: SPACING.smmd,
    borderRadius: BORDER_RADIUS.md,
    // shadowColor: COLORS.shadow,
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 8,
    // elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutIconContainer: {
    marginRight: SPACING.md,
  },
  logoutText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: 0.5,
  },
});

export default ProfileSettingsScreen;
