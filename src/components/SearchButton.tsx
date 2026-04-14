import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from './Icon';
import { BORDER_RADIUS, COLORS, FONTS, SPACING } from '../constants';
import CameraIcon from '../assets/icons/CameraIcon';
import { useAppSelector } from '../store/hooks';
import { translations } from '../i18n/translations';
import { requestCameraAndPhotoLibraryPermissions } from '../utils/permissions';
import MenuIcon from '../assets/icons/MenuIcon';

interface SearchButtonProps {
  placeholder: string;
  onPress: () => void;
  onCameraPress?: () => void;
  style?: ViewStyle;
  isHomepage: boolean;
}

const SearchButton: React.FC<SearchButtonProps> = ({
  placeholder,
  onPress,
  onCameraPress,
  style,
  isHomepage,
}) => {
  const navigation = useNavigation();
  const locale = useAppSelector((s) => s.i18n.locale) as 'en' | 'ko' | 'zh';

  // Translation function
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale as keyof typeof translations];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  const handleCameraPress = async () => {
    if (!onCameraPress) return;

    // Request camera and photo library permissions
    try {
      const { camera, photoLibrary } = await requestCameraAndPhotoLibraryPermissions();
      
      if (!camera || !photoLibrary) {
        Alert.alert('Permission Required', 'Please grant camera and photo library permissions to use image search.');
        return;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Permission Error', 'Failed to request permissions. Please try again.');
      return;
    }

    // Permissions granted, call the original handler
    onCameraPress();
  };

  
  const handleCategoryPress = async () => {
    // if (!onCameraPress) return;

    // // Request camera and photo library permissions
    // try {
    //   const { camera, photoLibrary } = await requestCameraAndPhotoLibraryPermissions();
      
    //   if (!camera || !photoLibrary) {
    //     Alert.alert('Permission Required', 'Please grant camera and photo library permissions to use image search.');
    //     return;
    //   }
    // } catch (error) {
    //   console.error('Error requesting permissions:', error);
    //   Alert.alert('Permission Error', 'Failed to request permissions. Please try again.');
    //   return;
    // }

    navigation.navigate('Category' as never);
  };

  return (
    <>
      <View style={[styles.container, style, !isHomepage ? { borderRadius: BORDER_RADIUS.full, borderWidth: 2.5 } : { borderWidth: 0 }]}>
        {/* {onCameraPress && <View style={styles.bar}/>} */}        
        {isHomepage && (<TouchableOpacity style={styles.menuButton} onPress={handleCategoryPress}>
          <MenuIcon width={24} height={24} color={COLORS.text.primary} />
        </TouchableOpacity>)}
        <TouchableOpacity style={styles.input} onPress={onPress}>
          <Text style={styles.trendingText}>{t('search.trending')}</Text>
          <Text style={styles.keywordText}>{t('search.keyword')}</Text>
        </TouchableOpacity>
        {onCameraPress && (
          <TouchableOpacity style={styles.cameraButton} onPress={handleCameraPress}>
            <CameraIcon width={24} height={24} color={COLORS.text.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.searchButton,!isHomepage && { borderRadius: BORDER_RADIUS.full }]} onPress={onPress}>
          <Icon name="search" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 40,
    // borderWidth: 2.5,
  },
  input: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: SPACING.sm,
  },
  trendingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.red,
    fontWeight: '600',
  },
  keywordText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  cameraButton: {
    paddingRight: SPACING.smmd,
    flexDirection: 'row',
  },
  menuButton: {
    padding: SPACING.sm,
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderColor: '#0000000D',
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  searchButton: {
    backgroundColor: COLORS.text.primary,
    borderRadius: BORDER_RADIUS.md,
    width: 40,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },
  bar: {
    width: 0.5,
    height: 16,
    backgroundColor: COLORS.gray[600],
    marginHorizontal: SPACING.sm,
  },
});

export default SearchButton;
