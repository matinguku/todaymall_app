import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '../../../../components/Icon';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, BACK_NAVIGATION_HIT_SLOP } from '../../../../constants';
import { formatPriceKRW } from '../../../../utils/i18nHelpers';
import { useToast } from '../../../../context/ToastContext';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { orderApi } from '../../../../services/orderApi';
import { useTranslation } from '../../../../hooks/useTranslation';

const REFUND_REASON_KEYS: Array<{ id: string; key: string; canonical: string }> = [
  { id: 'overpaid', key: 'profile.refundReasons.overpaid', canonical: 'Overpaid/Discount Not Applied' },
  { id: 'changedMind', key: 'profile.refundReasons.changedMind', canonical: 'Changed My Mind' },
  { id: 'mutualAgreement', key: 'profile.refundReasons.mutualAgreement', canonical: 'Refund by Mutual Agreement' },
  { id: 'emptyPackage', key: 'profile.refundReasons.emptyPackage', canonical: 'Empty Package' },
  { id: 'failedToShip', key: 'profile.refundReasons.failedToShip', canonical: 'Failed to Ship on Time' },
  { id: 'packageNotDelivered', key: 'profile.refundReasons.packageNotDelivered', canonical: 'Package Not Delivered' },
  { id: 'itemDamaged', key: 'profile.refundReasons.itemDamaged', canonical: 'Item Damaged, Delivery Refused' },
];

const RefundRequestScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { orderId, orderNumber, items, refundData } = route.params || {};
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = () => {
    Alert.alert(t('profile.addImage'), t('profile.chooseAnOption'), [
      { text: t('profile.takePhoto'), onPress: async () => {
        try {
          const result = await launchCamera({ mediaType: 'photo', saveToPhotos: false });
          if (result.assets?.[0]?.uri) setImages(prev => [...prev, result.assets![0].uri!].slice(0, 5));
        } catch (e) {
          showToast(t('profile.cameraNotAvailable'), 'error');
        }
      }},
      { text: t('profile.chooseFromLibrary'), onPress: async () => {
        try {
          const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 5 - images.length });
          if (result.assets) setImages(prev => [...prev, ...result.assets!.map(a => a.uri || '')].filter(Boolean).slice(0, 5));
        } catch (e) {
          showToast(t('profile.failedToPickImage'), 'error');
        }
      }},
      { text: t('profile.cancel'), style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast(t('profile.pleaseSelectARefundReason'), 'warning');
      return;
    }
    if (!orderId) {
      showToast(t('profile.missingOrder'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const lineItems = (items || []).map((item: any) => ({
        itemId: String(item.itemId ?? item.offerId ?? item._id ?? ''),
        quantity: Number(item.quantity) || 1,
      })).filter((row) => row.itemId.length > 0);

      const reasonCanonical = REFUND_REASON_KEYS.find(r => r.id === selectedReason)?.canonical || selectedReason;
      const res = await orderApi.submitRefundRequest(String(orderId), {
        reason: reasonCanonical,
        items: lineItems,
        evidenceImageUris: images.length > 0 ? images : undefined,
      });

      if (!res.success) {
        showToast(res.error || t('profile.failedToSubmitRefund'), 'error');
        return;
      }
      showToast(res.message || t('profile.refundRequestSubmitted'), 'success');
      navigation.goBack();
    } catch {
      showToast(t('profile.failedToSubmitRefund'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity hitSlop={BACK_NAVIGATION_HIT_SLOP} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.refundRequest')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Order info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.order')}</Text>
          <Text style={styles.orderNumber}>{orderNumber}</Text>
        </View>

        {/* Refund items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.items')}</Text>
          {(items || []).map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
                <Text style={styles.itemPrice}>{formatPriceKRW(item.price)} × {item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Refund amount — always shown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.refundAmount')}</Text>
          {refundData ? (
            <>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{t('profile.itemAmount')}</Text>
                <Text style={styles.amountValue}>{formatPriceKRW(refundData.itemAmount)}</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{t('profile.shippingAmount')}</Text>
                <Text style={styles.amountValue}>{formatPriceKRW(refundData.shippingAmount)}</Text>
              </View>
              <View style={[styles.amountRow, styles.amountTotal]}>
                <Text style={styles.amountTotalLabel}>{t('profile.totalRefund')}</Text>
                <Text style={styles.amountTotalValue}>{formatPriceKRW(refundData.totalRefundAmount)}</Text>
              </View>
              <View style={styles.totalHighlight}>
                <Text style={styles.totalHighlightText}>{formatPriceKRW(refundData.totalRefundAmount)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.amountLabel}>{t('profile.calculating')}</Text>
          )}
        </View>

        {/* Refund reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.refundReason')}</Text>
          {REFUND_REASON_KEYS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={styles.reasonRow}
              onPress={() => setSelectedReason(reason.id)}
            >
              <View style={[styles.radio, selectedReason === reason.id && styles.radioSelected]}>
                {selectedReason === reason.id && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.reasonText}>{t(reason.key)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Image upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.imagesCount').replace('{count}', images.length.toString())}</Text>
          <View style={styles.imageRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.imageThumbContainer}>
                <Image source={{ uri }} style={styles.imageThumb} />
                <TouchableOpacity
                  style={styles.imageRemove}
                  onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Icon name="close" size={12} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.imageAddBtn} onPress={handlePickImage}>
                <Icon name="camera-outline" size={24} color={COLORS.text.secondary} />
                <Text style={styles.imageAddText}>{t('profile.add')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Submit button */}
      <View style={[styles.footer, { paddingBottom: SPACING.md + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.submitBtn, (!selectedReason || isSubmitting) && { opacity: 0.5 }]}
          disabled={!selectedReason || isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>{t('profile.submitRefund')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[200],
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  headerTitle: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text.primary },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 100 },
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, gap: SPACING.sm,
  },
  sectionTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text.primary },
  orderNumber: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  itemRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  itemImage: { width: 56, height: 56, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.gray[100] },
  itemName: { fontSize: FONTS.sizes.sm, color: COLORS.text.primary, lineHeight: 18 },
  itemPrice: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  amountLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  amountValue: { fontSize: FONTS.sizes.sm, color: COLORS.text.primary },
  amountTotal: { borderTopWidth: 1, borderTopColor: COLORS.gray[200], marginTop: SPACING.xs, paddingTop: SPACING.xs },
  amountTotalLabel: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text.primary },
  amountTotalValue: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.red },
  totalHighlight: {
    backgroundColor: COLORS.lightRed,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  totalHighlightText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.red,
  },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    borderColor: COLORS.gray[400], justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: COLORS.red },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.red },
  reasonText: { fontSize: FONTS.sizes.sm, color: COLORS.text.primary, flex: 1 },
  noteInput: {
    borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text.primary,
    minHeight: 80, textAlignVertical: 'top',
  },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  imageThumbContainer: { position: 'relative' },
  imageThumb: { width: 72, height: 72, borderRadius: BORDER_RADIUS.sm },
  imageRemove: {
    position: 'absolute', top: -6, right: -6, width: 18, height: 18,
    borderRadius: 9, backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center',
  },
  imageAddBtn: {
    width: 72, height: 72, borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.gray[300], borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  imageAddText: { fontSize: FONTS.sizes.xs, color: COLORS.text.secondary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.md, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.gray[200],
  },
  submitBtn: {
    backgroundColor: COLORS.red, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  submitBtnText: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.white },
});

export default RefundRequestScreen;
