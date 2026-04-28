import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useSplashGate } from '../hooks/useSplashGate';
import { getHomeFirstPaintPromise } from '../utils/homePrefetch';
import { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types';
import { BORDER_RADIUS, COLORS, DEMO_MODE, SPACING } from '../constants';
import { useAppSelector } from '../store/hooks';
import { translations } from '../i18n/translations';
import HomeIcon from '../assets/icons/HomeIcon';
import MessageIcon from '../assets/icons/MessageIcon';
import SensorsIcon from '../assets/icons/SensorsIcon';
import CartIcon from '../assets/icons/CartIcon';
import SelectedCartIcon from '../assets/icons/SelectedCartIcon';
import AccountIcon from '../assets/icons/AccountIcon';
import SelectedPersonIcon from '../assets/icons/SelectedPersonIcon';

// Demo screens
import CartScreenDemo from '../screens/demo/CartScreen.demo';
import WishlistScreenDemo from '../screens/demo/WishlistScreen.demo';
import ProfileScreenDemo from '../screens/demo/ProfileScreen.demo';

// Import screens
import SplashScreen from '../screens/main/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import HomeScreen from '../screens/main/HomeScreen';
import SearchScreen from '../screens/main/searchScreen/SearchScreen';
import CartScreen from '../screens/main/CartScreen';
import LiveScreen from '../screens/main/LiveScreen';
import ProfileScreen from '../screens/main/profileScreen/ProfileScreen';
import ProductDetailScreen from '../screens/main/ProductDetailScreen';
import NotFoundScreen from '../screens/main/NotFoundScreen';
import ReviewsScreen from '../screens/main/profileScreen/ReviewsScreen';
import SellerProfileScreen from '../screens/main/searchScreen/SellerProfileScreen';
import LiveSellerSearchScreen from '../screens/main/liveScreen/LiveSellerSearchScreen';
import LiveSellerDetailScreen from '../screens/main/liveScreen/LiveSellerDetailScreen';
import OrderConfirmationScreen from '../screens/main/profileScreen/settingScreen/OrderConfirmationScreen';
import SearchResultsScreen from '../screens/main/searchScreen/SearchResultsScreen';
import EditProfileScreen from '../screens/main/profileScreen/myPageScreen/EditProfileScreen';
import AddressBookScreen from '../screens/main/profileScreen/settingScreen/addressScreen/AddressBookScreen';
import SelectAddressScreen from '../screens/main/profileScreen/settingScreen/addressScreen/SelectAddressScreen';
import AddNewAddressScreen from '../screens/main/profileScreen/settingScreen/addressScreen/AddNewAddressScreen';
import EditAddressScreen from '../screens/main/profileScreen/settingScreen/addressScreen/EditAddressScreen';
import EditFinanceAddressScreen from '../screens/main/profileScreen/settingScreen/EditFinanceAddressScreen';
import PaymentMethodsScreen from '../screens/main/profileScreen/settingScreen/PaymentMethodsScreen';
import AddPaymentMethodScreen from '../screens/main/profileScreen/settingScreen/AddPaymentMethodScreen';
import OrderHistoryScreen from '../screens/main/profileScreen/settingScreen/OrderHistoryScreen';
import WishlistScreen from '../screens/main/WishlistScreen';
import ProfileSettingsScreen from '../screens/main/profileScreen/myPageScreen/ProfileSettingsScreen';
import HelpCenterScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpCenterScreen';
import HelpSearchScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpSearchScreen';
import HelpSectionScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpSectionScreen';
import HelpArticleScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpArticleScreen';
import HelpChapterScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpChapterScreen';
import HelpFAQCategoriesScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpFAQCategoriesScreen';
import HelpFAQQuestionsScreen from '../screens/main/profileScreen/settingScreen/helpScreen/HelpFAQQuestionsScreen';
import LanguageSettingsScreen from '../screens/main/profileScreen/LanguageSettingsScreen';
import PaymentScreen from '../screens/main/profileScreen/settingScreen/PaymentScreen';
import AddAddressScreen from '../screens/main/profileScreen/settingScreen/addressScreen/AddAddressScreen';
// import EditProductScreen from '../screens/main/EditProductScreen'; // Temporarily removed due to missing module
// Order screens
import MyOrdersScreen from '../screens/main/profileScreen/settingScreen/OrderHistoryScreen';
import LeaveFeedbackScreen from '../screens/main/profileScreen/LeaveFeedbackScreen';
// Settings screens
import PrivacyPolicyScreen from '../screens/main/profileScreen/PrivacyPolicyScreen';
import AboutUsScreen from '../screens/main/profileScreen/AboutUsScreen';
import SecuritySettingsScreen from '../screens/main/profileScreen/myPageScreen/SecuritySettingsScreen';
import ChangePasswordScreen from '../screens/main/profileScreen/myPageScreen/ChangePasswordScreen';
import AffiliateMarketingScreen from '../screens/main/profileScreen/myPageScreen/AffiliateMarketingScreen';
import UnitSettingsScreen from '../screens/main/profileScreen/myPageScreen/UnitSettingsScreen';
import PaymentPasswordScreen from '../screens/main/profileScreen/myPageScreen/PaymentPasswordScreen';
import DepositScreen from '../screens/main/profileScreen/depositScreen/DepositScreen';
import ChargeScreen from '../screens/main/profileScreen/depositScreen/ChargeScreen';
import PointDetailScreen from '../screens/main/profileScreen/depositScreen/PointDetailScreen';
import CouponScreen from '../screens/main/profileScreen/depositScreen/CouponScreen';
import BuyListScreen from '../screens/main/profileScreen/settingScreen/BuyListScreen';
import RefundRequestScreen from '../screens/main/profileScreen/settingScreen/RefundRequestScreen';
import ProblemProductScreen from '../screens/main/profileScreen/settingScreen/ProblemProductScreen';
import MyDeliveriesScreen from '../screens/main/profileScreen/settingScreen/MyDeliveriesScreen';
import DeliveryDetailScreen from '../screens/main/profileScreen/settingScreen/DeliveryDetailScreen';
import OrderDetailScreen from '../screens/main/profileScreen/settingScreen/OrderDetailScreen';
import NoteScreen from '../screens/main/profileScreen/NoteScreen';
import LeaveNoteScreen from '../screens/main/profileScreen/LeaveNoteScreen';
import ShareAppScreen from '../screens/main/profileScreen/settingScreen/ShareAppScreen';
import SellerInfoStackNavigator from '../screens/main/profileScreen/settingScreen/sellerInfoScreen/SellerInfoStackNavigator';
import ViewedProductsScreen from '../screens/main/profileScreen/ViewedProductsScreen';
import FollowedStoreScreen from '../screens/main/profileScreen/FollowedStoreScreen';
// Chat screens
import ChatScreen from '../screens/main/chatScreen/ChatScreen';
import ChatErrorBoundary from '../components/ChatErrorBoundary';
// import EditProductScreen from '../screens/main/EditProductScreen';
import CategoryTabScreen from '../screens/main/CategoryTabScreen';
import ProductDiscoveryScreen from '../screens/main/searchScreen/ProductDiscoveryScreen';
import SubCategoryScreen from '../screens/main/SubCategoryScreen';
import FinanceScreen from '../screens/main/profileScreen/settingScreen/FinanceScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import CustomerServiceScreen from '../screens/main/profileScreen/CustomerServiceScreen';
import OrderInquiryScreen from '../screens/main/profileScreen/OrderInquiryScreen';
import ImageSearchScreen from '../screens/main/searchScreen/ImageSearchScreen';
import ImageSearchCameraScreen from '../screens/main/searchScreen/ImageSearchCameraScreen';
import BillgatePaymentScreen from '../screens/main/payment/BillgatePaymentScreen';
// General Inquiry screens
import GeneralInquiryListScreen from '../screens/main/profileScreen/GeneralInquiryListScreen';
import MessageScreen from '../screens/main/MessageScreen';
import GeneralInquiryChatScreen from '../screens/main/profileScreen/GeneralInquiryChatScreen';
import CreateGeneralInquiryScreen from '../screens/main/profileScreen/CreateGeneralInquiryScreen';

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

const ChatScreenWithBoundary = (props: any) => (
  <ChatErrorBoundary>
    <ChatScreen {...props} />
  </ChatErrorBoundary>
);

// Auth Stack Navigator
const AuthNavigator = React.memo(() => {
  const authContext = useAuth();
  const loginError = authContext?.loginError;
  const signupError = authContext?.signupError;
  
  // Determine initial route based on error states
  let initialRoute: keyof AuthStackParamList = "Login"; // default
  if (signupError) {
    initialRoute = "Signup";
  } else if (loginError) {
    initialRoute = "Login";
  }
  
  // console.log('AuthNavigator: Rendering AuthNavigator');
  // console.log('AuthNavigator: loginError:', loginError, 'signupError:', signupError);
  // console.log('AuthNavigator: initialRoute:', initialRoute);
  // console.log('AuthNavigator: Call stack:', new Error().stack);
  
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.background },
      }}
      initialRouteName={initialRoute}
    >
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <AuthStack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <AuthStack.Screen name="SetPassword" component={SetPasswordScreen} />
    </AuthStack.Navigator>
  );
});

// Main Tab Navigator
const MainTabNavigator = () => {
  const authContext = useAuth();
  const shouldNavigateToProfile = authContext?.shouldNavigateToProfile;
  const clearNavigateToProfile = authContext?.clearNavigateToProfile;
  const isGuest = authContext?.isGuest;
  const navigation = useNavigation();
  const locale = useAppSelector((s) => s.i18n.locale);
  const insets = useSafeAreaInsets();
  const { unreadCount, generalInquiryUnreadCount } = useSocket();
  const totalMessageUnread = unreadCount + generalInquiryUnreadCount;

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };
  
  // console.log('MainTabNavigator: Rendering with shouldNavigateToProfile:', shouldNavigateToProfile, 'isGuest:', isGuest);
  
  // Navigate to Profile tab after login if needed
  useEffect(() => {
    // console.log('MainTabNavigator: shouldNavigateToProfile changed to', shouldNavigateToProfile);
    if (shouldNavigateToProfile) {
      // Navigate to the Profile tab
      // console.log('MainTabNavigator: Navigating to Profile screen');
      navigation.navigate('Profile' as never);
      // Clear the flag after handling
      clearNavigateToProfile();
    }
  }, [shouldNavigateToProfile, navigation, clearNavigateToProfile]); // Depend on all required values
  
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isTabletDevice = Math.min(winWidth, winHeight) >= 600;

  const baseTabBarHeight = isTabletDevice ? 88 : 70;
  const basePaddingBottom = isTabletDevice ? 28 : 20;
  const tabBarHeight = baseTabBarHeight + insets.bottom;
  const paddingBottom = basePaddingBottom + insets.bottom;
  
  const LIVE_BUTTON_SIZE = isTabletDevice ? 92 : 76;
  const LIVE_BUTTON_OVERHANG = isTabletDevice ? 24 : 18;
  const LIVE_ICON_SIZE = isTabletDevice ? 48 : 40;

  return (
    <MainTab.Navigator
      // Tab-mount strategy:
      //   - lazy: true            → only the focused tab (Home) mounts at
      //                             startup. Message/Live/Cart/Profile mount
      //                             on first tap. Trades a one-time
      //                             ~100–500ms delay on each tab's first tap
      //                             for a much faster cold start (-500 to
      //                             -1500ms) plus lower memory / battery /
      //                             network footprint.
      //   - detachInactiveScreens → once mounted, keep tabs in memory so
      //                             every subsequent tap is instant.
      //   - freezeOnBlur          → pause backgrounded tabs so the mounted
      //                             set never burns CPU.
      detachInactiveScreens={false}
      screenOptions={({ route }) => ({
        lazy: false,
        freezeOnBlur: true,
        tabBarIcon: ({ focused }) => {
          const iconColor = focused ? COLORS.text.red : COLORS.black;
          const iconSize = isTabletDevice ? 28 : 24;

          if (route.name === 'Home') {
            return <HomeIcon width={iconSize} height={iconSize} color={iconColor} />;
          } else if (route.name === 'Message') {
            return (
              <View>
                <MessageIcon width={iconSize} height={iconSize} color={iconColor} />
                {totalMessageUnread > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    backgroundColor: COLORS.red || '#FF0000',
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                      {totalMessageUnread > 99 ? '99+' : totalMessageUnread}
                    </Text>
                  </View>
                )}
              </View>
            );
          } else if (route.name === 'Live') {
            return null;
          } else if (route.name === 'Cart') {
            return focused ? (
              <SelectedCartIcon width={iconSize} height={iconSize} color={iconColor} />
            ) : (
              <CartIcon width={iconSize} height={iconSize} color={iconColor} />
            );
          } else if (route.name === 'Profile') {
            return focused ? (
              <SelectedPersonIcon width={iconSize} height={iconSize} color={iconColor} />
            ) : (
              <AccountIcon width={iconSize} height={iconSize} color={iconColor} />
            );
          }
          return <HomeIcon width={iconSize} height={iconSize} color={iconColor} />;
        },
        tabBarLabel: ({ focused }) => {
          let label = '';
          if (route.name === 'Home') label = t('navigation.home');
          else if (route.name === 'Message') label = t('navigation.message');
          else if (route.name === 'Live') label = t('navigation.live');
          else if (route.name === 'Cart') label = t('navigation.cart');
          else if (route.name === 'Profile') label = t('navigation.profile');
          if (route.name === 'Live') return null;
          return (
            <Text
              style={{
                fontSize: isTabletDevice ? 14 : 12,
                color: focused ? COLORS.text.red : COLORS.black,
                fontWeight: focused ? '600' : '400',
              }}
            >
              {label}
            </Text>
          );
        },
        tabBarButton: route.name === 'Live'
          ? (props) => (
              <View style={tabBarStyles.liveButtonWrap} pointerEvents="box-none">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={props.onPress}
                  style={[
                    tabBarStyles.liveButtonTouchable,
                    {
                      width: LIVE_BUTTON_SIZE,
                      height: LIVE_BUTTON_SIZE,
                      marginTop: -LIVE_BUTTON_OVERHANG,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: LIVE_BUTTON_SIZE,
                      height: LIVE_BUTTON_SIZE,
                      borderRadius: LIVE_BUTTON_SIZE / 2,
                      overflow: 'hidden',
                      backgroundColor: COLORS.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg
                      width={LIVE_BUTTON_SIZE}
                      height={LIVE_BUTTON_SIZE}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    >
                      <Defs>
                        <SvgRadialGradient id="liveTabGradient" cx="50%" cy="0%" rx="100%" ry="100%">
                          <Stop offset="0%" stopColor="#FF0000" />
                          <Stop offset="65.38%" stopColor="#FFEFE2" />
                          <Stop offset="87.98%" stopColor="#FFFFFF" />
                        </SvgRadialGradient>
                      </Defs>
                      <Rect
                        x={0}
                        y={0}
                        width={LIVE_BUTTON_SIZE}
                        height={LIVE_BUTTON_SIZE}
                        fill="url(#liveTabGradient)"
                      />
                    </Svg>
                    <SensorsIcon width={LIVE_ICON_SIZE} height={LIVE_ICON_SIZE} color={COLORS.white} />
                  </View>
                  <Text
                    style={{
                      position: 'absolute',
                      bottom: -3,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: isTabletDevice ? 14 : 12,
                      fontWeight: '400',
                      color: COLORS.black,
                    }}
                  >
                    {t('navigation.live')}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          : undefined,
        tabBarActiveTintColor: COLORS.text.red,
        tabBarInactiveTintColor: COLORS.black,
        tabBarLabelPosition: 'below-icon',
        tabBarItemStyle: {
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.borderLight,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: paddingBottom,
          paddingTop: 8,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: isTabletDevice ? 14 : 12,
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <MainTab.Screen name="Home" component={HomeScreen} />
      <MainTab.Screen name="Message" component={MessageScreen} />
      <MainTab.Screen name="Live" component={LiveScreen} />
      <MainTab.Screen name="Cart" component={DEMO_MODE ? CartScreenDemo : CartScreen} />
      <MainTab.Screen name="Profile" component={DEMO_MODE ? ProfileScreenDemo : ProfileScreen} />
    </MainTab.Navigator>
  );
};

const tabBarStyles = StyleSheet.create({
  liveButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
    backgroundColor: 'transparent',
  },
  liveButtonTouchable: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
});

// Root Stack Navigator
const RootNavigator = () => {
  const authContext = useAuth();
  const isAuthenticated = authContext?.isAuthenticated;
  const isLoading = authContext?.isLoading;
  // Hold the splash until the above-the-fold prefetch (banners + carousels +
  // default categories) is done so HomeScreen paints with that content
  // immediately. Live/deals and More-to-Love come in afterward via Phases 2
  // and 3 — the splash doesn't wait on them.
  // minDurationMs=0 lets the splash release the instant prefetch settles
  // (no artificial hold). maxDurationMs=1500 caps the worst-case wait when
  // the network is slow so the user is never stranded on splash.
  const splashHolding = useSplashGate({
    minDurationMs: 0,
    maxDurationMs: 1500,
    waitFor: [getHomeFirstPaintPromise()],
  });
  // console.log('RootNavigator: Rendering with isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  // Debug authentication state changes
  useEffect(() => {
    // console.log('AppNavigator: Authentication state changed - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
    // console.log('AppNavigator: Current screen should be:', !isAuthenticated ? 'Auth' : 'Main');
  }, [isAuthenticated, isLoading]);

  if (isLoading || splashHolding) {
    return <SplashScreen />;
  }

  // Always start with Main (homepage) - app supports guest mode
  const initialRoute = 'Main';

  return (
    <RootStack.Navigator
      initialRouteName={initialRoute}
      detachInactiveScreens={true}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.background },
        freezeOnBlur: true,
      }}
    >
      {/* Onboarding removed - skip directly to main screens */}
      <>
        <RootStack.Screen name="Main" component={MainTabNavigator} />
        <RootStack.Screen name="Auth" component={AuthNavigator} />
          <RootStack.Screen
            name="Category"
            component={CategoryTabScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="NotFound"
            component={NotFoundScreen}
            options={{
              headerShown: false,
              title: 'Page Not Found',
            }}
          />
          <RootStack.Screen 
            name="ProductDetail" 
            component={ProductDetailScreen}
            options={{
              headerShown: false,
              title: 'Product Details',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Reviews" 
            component={ReviewsScreen}
            options={{
              headerShown: false,
              title: 'Reviews',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Payment" 
            component={PaymentScreen}
            options={{
              headerShown: false,
              title: 'Payment',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="OrderConfirmation" 
            component={OrderConfirmationScreen}
            options={{
              headerShown: false,
              title: 'Order Confirmation',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen
            name="SellerProfile"
            component={SellerProfileScreen}
            options={{
              headerShown: false,
              title: 'Seller Profile',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen
            name="LiveSellerSearch"
            component={LiveSellerSearchScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="LiveSellerDetail"
            component={LiveSellerDetailScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="ProductDiscovery"
            component={ProductDiscoveryScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="SubCategory"
            component={SubCategoryScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="CustomerService"
            component={CustomerServiceScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="OrderInquiry"
            component={OrderInquiryScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="ImageSearch"
            component={ImageSearchScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="ImageSearchCamera"
            component={ImageSearchCameraScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="BillgatePayment"
            component={BillgatePaymentScreen}
            // Modal presentation: the BillGate WebView slides up over the
            // current screen. gestureEnabled is off so a stray swipe-down
            // can't kill the payment mid-flight.
            options={{
              headerShown: false,
              gestureEnabled: false,
              presentation: 'modal',
              cardOverlayEnabled: true,
            }}
          />
          <RootStack.Screen
            name="Search"
            component={SearchScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="EditProfile" 
            component={EditProfileScreen}
            options={{
              headerShown: false,
              title: 'Edit Profile',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="AddressBook" 
            component={AddressBookScreen}
            options={{
              headerShown: false,
              title: 'Address Book',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="SelectAddress" 
            component={SelectAddressScreen}
            options={{
              headerShown: false,
              title: 'Select Address',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="AddNewAddress" 
            component={AddNewAddressScreen}
            options={{
              headerShown: false,
              title: 'New Address',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="AddPaymentMethod" 
            component={AddPaymentMethodScreen}
            options={{
              headerShown: false,
              title: 'Add Payment Method',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="EditAddress" 
            component={EditAddressScreen}
            options={{
              headerShown: false,
              title: 'Edit Address',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="EditFinanceAddress" 
            component={EditFinanceAddressScreen}
            options={{
              headerShown: false,
              title: 'Edit Address',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="PaymentMethods" 
            component={PaymentMethodsScreen}
            options={{
              headerShown: false,
              title: 'Payment Methods',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="OrderHistory" 
            component={OrderHistoryScreen}
            options={{
              headerShown: false,
              title: 'Order History',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Wishlist" 
            component={WishlistScreen}
            options={{
              headerShown: false,
              title: 'Wishlist',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="ProfileSettings" 
            component={ProfileSettingsScreen}
            options={{
              headerShown: false,
              title: 'Profile Settings',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen
            name="SellerStack"
            component={SellerInfoStackNavigator}
            options={{
              headerShown: false,
              title: 'Seller',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpCenter" 
            component={HelpCenterScreen}
            options={{
              headerShown: false,
              title: 'Help Center',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpSearch" 
            component={HelpSearchScreen}
            options={{
              headerShown: false,
              title: 'Help Search',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpSection" 
            component={HelpSectionScreen}
            options={{
              headerShown: false,
              title: 'Help Section',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpArticle" 
            component={HelpArticleScreen}
            options={{
              headerShown: false,
              title: 'Help Article',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpChapter" 
            component={HelpChapterScreen}
            options={{
              headerShown: false,
              title: 'Help Chapter',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpFAQCategories" 
            component={HelpFAQCategoriesScreen}
            options={{
              headerShown: false,
              title: 'FAQ Categories',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="HelpFAQQuestions" 
            component={HelpFAQQuestionsScreen}
            options={{
              headerShown: false,
              title: 'FAQ Questions',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="LanguageSettings" 
            component={LanguageSettingsScreen}
            options={{
              headerShown: false,
              title: 'Language Settings',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Deposit" 
            component={DepositScreen}
            options={{
              headerShown: false,
              title: 'Deposit',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Charge" 
            component={ChargeScreen}
            options={{
              headerShown: false,
              title: 'Charge',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="PointDetail" 
            component={PointDetailScreen}
            options={{
              headerShown: false,
              title: 'Point Detail',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Coupon" 
            component={CouponScreen}
            options={{
              headerShown: false,
              title: 'Coupon',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="BuyList" 
            component={BuyListScreen}
            options={{
              headerShown: false,
              title: 'Buy List',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen name="RefundRequest" component={RefundRequestScreen} options={{ headerShown: false }} />
          <RootStack.Screen 
            name="ProblemProduct" 
            component={ProblemProductScreen}
            options={{
              headerShown: false,
              title: 'Problem Product',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="MyDeliveries" 
            component={MyDeliveriesScreen}
            options={{
              headerShown: false,
              title: 'My Deliveries',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="DeliveryDetail" 
            component={DeliveryDetailScreen}
            options={{
              headerShown: false,
              title: 'Delivery Detail',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="OrderDetail" 
            component={OrderDetailScreen}
            options={{
              headerShown: false,
              title: 'Order Detail',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="Note" 
            component={NoteScreen}
            options={{
              headerShown: false,
              title: 'Note',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="LeaveNote" 
            component={LeaveNoteScreen}
            options={{
              headerShown: false,
              title: 'Leave Note',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="ShareApp" 
            component={ShareAppScreen}
            options={{
              headerShown: false,
              title: 'Share App',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="ViewedProducts" 
            component={ViewedProductsScreen}
            options={{
              headerShown: false,
              title: 'Viewed Products',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="FollowedStore" 
            component={FollowedStoreScreen}
            options={{
              headerShown: false,
              title: 'Followed Store',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          {/* Order screens */}
          <RootStack.Screen 
            name="MyOrders" 
            component={MyOrdersScreen}
            options={{
              headerShown: false,
              title: 'My Orders',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="LeaveFeedback" 
            component={LeaveFeedbackScreen}
            options={{
              headerShown: false,
              title: 'Leave Feedback',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          {/* Settings screens */}
          <RootStack.Screen 
            name="Finance" 
            component={FinanceScreen}
            options={{
              headerShown: false,
              title: 'Finance',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="PrivacyPolicy" 
            component={PrivacyPolicyScreen}
            options={{
              headerShown: false,
              title: 'Privacy Policy',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen
            name="SecuritySettings"
            component={SecuritySettingsScreen}
            options={{
              headerShown: false,
              title: 'Security Settings',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen
            name="AboutUs"
            component={AboutUsScreen}
            options={{
              headerShown: false,
              title: 'About Us',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="ChangePassword" 
            component={ChangePasswordScreen}
            options={{
              headerShown: false,
              title: 'Change Password',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="AffiliateMarketing" 
            component={AffiliateMarketingScreen}
            options={{
              headerShown: false,
              title: 'Affiliate Marketing',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="UnitSettings" 
            component={UnitSettingsScreen}
            options={{
              headerShown: false,
              title: 'Unit Settings',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          <RootStack.Screen 
            name="PaymentPassword" 
            component={PaymentPasswordScreen}
            options={{
              headerShown: false,
              title: 'Payment Password',
              headerStyle: {
                backgroundColor: COLORS.white,
              },
              headerTintColor: COLORS.text.primary,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
          {/* Chat screens */}
          <RootStack.Screen 
            name="Chat" 
            component={ChatScreenWithBoundary}
            options={{
              headerShown: false,
            }}
          />
          {/* General Inquiry screens */}
          <RootStack.Screen 
            name="GeneralInquiryList" 
            component={GeneralInquiryListScreen}
            options={{
              headerShown: false,
            }}
          />
          <RootStack.Screen 
            name="GeneralInquiryChat" 
            component={GeneralInquiryChatScreen}
            options={{
              headerShown: false,
            }}
          />
          <RootStack.Screen 
            name="CreateGeneralInquiry" 
            component={CreateGeneralInquiryScreen}
            options={{
              headerShown: false,
            }}
          />

      </>
    </RootStack.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};

export default AppNavigator;
