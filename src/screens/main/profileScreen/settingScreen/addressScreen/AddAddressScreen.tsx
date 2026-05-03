import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../../../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, BACK_NAVIGATION_HIT_SLOP } from '../../../../../constants';

const AddAddressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    isDefault: false,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveAddress = () => {
    // Validate required fields
    const requiredFields = ['fullName', 'phoneNumber', 'address', 'city', 'state', 'zipCode'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Save address logic here
    // console.log('Saving address:', formData);
    Alert.alert(
      'Success',
      'Address saved successfully!',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={24} color={COLORS.black} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Add Address</Text>
      <View style={styles.placeholder} />
    </View>
  );

  const renderFormField = (
    label: string,
    field: string,
    placeholder: string,
    keyboardType: 'default' | 'phone-pad' | 'numeric' = 'default',
    multiline: boolean = false
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {label} <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={[styles.textInput, multiline && styles.multilineInput]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray[400]}
        value={formData[field as keyof typeof formData] as string}
        onChangeText={(value) => handleInputChange(field, value)}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          {renderFormField('Full Name', 'fullName', 'Enter your full name')}
          {renderFormField('Phone Number', 'phoneNumber', 'Enter your phone number', 'phone-pad')}
          
          <Text style={styles.sectionTitle}>Address Details</Text>
          
          {renderFormField('Address', 'address', 'Street address, P.O. box, company name, c/o', 'default', true)}
          {renderFormField('City', 'city', 'Enter city')}
          
          <View style={styles.rowContainer}>
            <View style={styles.halfField}>
              {renderFormField('State', 'state', 'State')}
            </View>
            <View style={styles.halfField}>
              {renderFormField('ZIP Code', 'zipCode', 'ZIP Code', 'numeric')}
            </View>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Country</Text>
            <TouchableOpacity style={styles.countrySelector}>
              <Text style={styles.countryText}>{formData.country}</Text>
              <Icon name="chevron-down" size={20} color={COLORS.gray[400]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.defaultAddressRow}
            onPress={() => handleInputChange('isDefault', (!formData.isDefault).toString())}
          >
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, formData.isDefault && styles.checkboxSelected]}>
                {formData.isDefault && (
                  <Icon name="checkmark" size={16} color={COLORS.white} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Set as default address</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveAddress}
        >
          <Text style={styles.saveButtonText}>Save Address</Text>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },
  fieldContainer: {
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.red,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
    backgroundColor: COLORS.white,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfField: {
    flex: 1,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  countryText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
  },
  defaultAddressRow: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    marginRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text.primary,
  },
  bottomContainer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
  },
  saveButton: {
    backgroundColor: COLORS.black,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
});

export default AddAddressScreen;