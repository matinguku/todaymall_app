import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, BACK_NAVIGATION_HIT_SLOP } from '../../constants';
import { useAuth } from '../../context/AuthContext';

const WishlistScreenDemo: React.FC = () => {
  const navigation = useNavigation();
  const { user, isGuest } = useAuth();

  // If guest, show login prompt
  if (isGuest || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Wishlist</Text>
          
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={80} color={COLORS.gray[400]} />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Please login to view your wishlist
          </Text>
          <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Always show empty wishlist in demo mode
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Wishlist (0)</Text>
        
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={80} color={COLORS.gray[400]} />
        <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
        <Text style={styles.emptySubtitle}>
          Save your favorite items here
        </Text>
        <TouchableOpacity 
          style={styles.shopButton}
          onPress={() => navigation.navigate('Main' as never)}
        >
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  loginButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.white,
  },
  shopButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  shopButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.white,
  },
});

export default WishlistScreenDemo;
