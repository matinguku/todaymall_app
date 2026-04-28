import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type StackNavigationProp } from '@react-navigation/stack';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import Orientation from 'react-native-orientation-locker';
import { COLORS, SPACING } from '../../../constants';
import { useTranslation } from '../../../hooks/useTranslation';
import { getBillgateConfig } from '../../../lib/billgate/config';
import type {
  BillgatePaymentData,
  BillgateResult,
  BillgateResultStatus,
} from '../../../lib/billgate/types';
import type { RootStackParamList } from '../../../types';

type Navigation = StackNavigationProp<RootStackParamList, 'BillgatePayment'>;
type ScreenRoute = RouteProp<RootStackParamList, 'BillgatePayment'>;

const RESULT_PATHS = {
  success: '/payment/success',
  cancel: '/payment/cancel',
  failed: '/payment/failed',
} as const;

function escapeHtml(value: string | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildPaymentHtml(
  paymentData: BillgatePaymentData,
  _serviceCode: string | undefined,
  scriptUrl: string,
  protocolType: string,
): string {
  const mergedData: Record<string, string | undefined> = { ...paymentData };
  const resolvedServiceCode = mergedData.SERVICE_CODE ?? paymentData.SERVICE_CODE;
  const gatewayOrigin = scriptUrl.replace(/\/paygate\/plugin\/gx_web_client\.js.*$/i, '');
  const directCreditActionUrl = `${gatewayOrigin}/credit/certify.jsp`;
  const useDirectCreditSubmit = resolvedServiceCode === '0900';

  const hiddenInputs = Object.entries(mergedData)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value ?? ''))}" />`,
    )
    .join('\n');

  const maybeScriptTag = useDirectCreditSubmit
    ? ''
    : `<script src="${escapeHtml(scriptUrl)}"></script>`;

  const formActionAttr = useDirectCreditSubmit
    ? `action="${escapeHtml(directCreditActionUrl)}"`
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, user-scalable=yes"
  />
  <title>BillGate Payment</title>
  ${maybeScriptTag}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      max-width: 100vw;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
    }

    .loading {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="loading">Loading payment gateway...</div>
  <form
    id="billgatePayment"
    name="billgatePayment"
    method="post"
    ${formActionAttr}
    accept-charset="EUC-KR"
    style="display:none"
  >
    ${hiddenInputs}
  </form>
  <script>
    (function () {
      var startedAt = Date.now();

      function postToReactNative(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (error) {}
      }

      function startBillgate() {
        if (${useDirectCreditSubmit ? 'true' : 'false'}) {
          try {
            document.getElementById('billgatePayment').submit();
            postToReactNative({ type: 'billgate-debug', step: 'direct-credit-submit-called' });
          } catch (error) {
            postToReactNative({
              type: 'billgate-debug',
              step: 'direct-credit-submit-error',
              message: String(error),
            });
          }
          return;
        }

        if (typeof window.GX_pay === 'function') {
          try {
            window.GX_pay('billgatePayment', 'submit', '${escapeHtml(protocolType)}');
            postToReactNative({ type: 'billgate-debug', step: 'gx-pay-called' });
          } catch (error) {
            postToReactNative({
              type: 'billgate-debug',
              step: 'gx-pay-error',
              message: String(error),
            });
          }
          return;
        }

        if (Date.now() - startedAt > 10000) {
          postToReactNative({ type: 'billgate-debug', step: 'gx-pay-timeout' });
          return;
        }

        window.setTimeout(startBillgate, 100);
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.setTimeout(startBillgate, 50);
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          window.setTimeout(startBillgate, 50);
        });
      }
    })();
  </script>
</body>
</html>`;
}

function detectResultStatus(url: string): BillgateResultStatus | null {
  const normalized = url.toLowerCase();
  if (normalized.includes(RESULT_PATHS.success)) return 'success';
  if (normalized.includes(RESULT_PATHS.cancel)) return 'cancel';
  if (normalized.includes(RESULT_PATHS.failed)) return 'failed';
  return null;
}

function buildResultFromUrl(
  status: BillgateResultStatus,
  url: string,
  fallbackOrderId: string,
): BillgateResult {
  const queryString = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(queryString);

  // Helper function to decode Korean text properly
  const decodeKoreanText = (text: string | null): string | undefined => {
    if (!text) return undefined;
    try {
      // Try to decode as UTF-8 first
      return decodeURIComponent(text);
    } catch {
      try {
        // If UTF-8 fails, try to handle EUC-KR encoded text
        // Convert EUC-KR bytes to UTF-8 if needed
        return text; // For now, return as-is since URLSearchParams should handle it
      } catch {
        return text; // Return original if decoding fails
      }
    }
  };

  return {
    status,
    orderId: params.get('orderId') ?? params.get('orderNumber') ?? fallbackOrderId,
    transactionId: params.get('transactionId') ?? undefined,
    message: decodeKoreanText(params.get('error') ?? params.get('detailMsg')),
  };
}

function getWebsiteFallbackUrl(paymentData: BillgatePaymentData): string {
  const cancelUrl = paymentData.CANCEL_URL;
  if (cancelUrl) {
    try {
      return new URL(cancelUrl).origin;
    } catch {}
  }

  return 'https://todaymall.co.kr';
}

function isExternalAppUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('http://') || url.startsWith('https://')) return false;
  if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return false;
  return true;
}

async function openExternalApp(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }

    if (Platform.OS === 'android' && url.startsWith('intent://')) {
      const fallbackMatch = url.match(/S\.browser_fallback_url=([^;]+)/);
      if (fallbackMatch?.[1]) {
        await Linking.openURL(decodeURIComponent(fallbackMatch[1]));
        return true;
      }

      const packageMatch = url.match(/package=([^;]+)/);
      if (packageMatch?.[1]) {
        const marketUrl = `market://details?id=${packageMatch[1]}`;
        if (await Linking.canOpenURL(marketUrl)) {
          await Linking.openURL(marketUrl);
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

const injectedFitScript = `
(function () {
  function applyFit() {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      var body = document.body;
      var docEl = document.documentElement;
      if (!head || !body || !docEl) return;

      var screenWidth = window.innerWidth || (window.screen && window.screen.width) || 360;

      var contentWidth = Math.max(
        body.scrollWidth || 0,
        docEl.scrollWidth || 0,
        body.offsetWidth || 0,
        docEl.offsetWidth || 0
      );

      var viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        head.appendChild(viewport);
      }

      if (contentWidth > screenWidth + 8) {
        var ratio = screenWidth / contentWidth;
        viewport.setAttribute(
          'content',
          'width=' + Math.ceil(contentWidth) +
            ', initial-scale=' + ratio.toFixed(4) +
            ', minimum-scale=' + ratio.toFixed(4) +
            ', user-scalable=yes'
        );
      } else {
        viewport.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, user-scalable=yes'
        );
      }

      if (!document.getElementById('rn-fit-style')) {
        var style = document.createElement('style');
        style.id = 'rn-fit-style';
        style.innerHTML =
          'html, body { max-width: 100%; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }' +
          'img, iframe, video { max-width: 100%; height: auto; }';
        head.appendChild(style);
      }
    } catch (e) {}
  }

  applyFit();
  setTimeout(applyFit, 150);
  setTimeout(applyFit, 500);
  setTimeout(applyFit, 1200);
  setTimeout(applyFit, 2500);

  if (document.readyState !== 'complete') {
    window.addEventListener('load', function () {
      setTimeout(applyFit, 100);
      setTimeout(applyFit, 600);
    });
  }

  window.addEventListener('orientationchange', function () {
    setTimeout(applyFit, 250);
  });
  window.addEventListener('resize', function () {
    setTimeout(applyFit, 100);
  });
})();
true;
`;

const injectedBridgeScript = `
(function () {
  try {
    var rn = window.ReactNativeWebView;
    if (!rn || !rn.postMessage) {
      return true;
    }

    if (!window.opener) {
      var openerBridge = {
        closed: false,
        focus: function () {},
        postMessage: function (payload) {
          try {
            rn.postMessage(JSON.stringify(payload));
          } catch (error) {}
        }
      };

      try {
        Object.defineProperty(window, 'opener', {
          value: openerBridge,
          configurable: true
        });
      } catch (error) {
        window.opener = openerBridge;
      }
    }

    if (window.BroadcastChannel) {
      var NativeBroadcastChannel = window.BroadcastChannel;
      window.BroadcastChannel = function (name) {
        var channel = new NativeBroadcastChannel(name);
        var originalPostMessage = channel.postMessage.bind(channel);
        channel.postMessage = function (payload) {
          try {
            if (payload && payload.source === 'todaymall-billgate-payment') {
              rn.postMessage(JSON.stringify(payload));
            }
          } catch (error) {}
          return originalPostMessage(payload);
        };
        return channel;
      };
    }

    window.close = function () {};
  } catch (error) {}

  return true;
})();
true;
`;

const BillgatePaymentScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ScreenRoute>();
  const { t } = useTranslation();
  const { paymentData, serviceCode, orderId, onResult } = route.params;

  const config = useMemo(() => getBillgateConfig(), []);
  const [loading, setLoading] = useState(true);
  const [popupUrl, setPopupUrl] = useState<string | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const resolvedRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const directSubmitAttemptedRef = useRef(false);
  const fallbackOrderId = orderId ?? paymentData.ORDER_ID;
  const websiteFallbackUrl = useMemo(() => getWebsiteFallbackUrl(paymentData), [paymentData]);
  const resolvedServiceCode = paymentData.SERVICE_CODE;
  const gatewayOrigin = config.scriptUrl.replace(/\/paygate\/plugin\/gx_web_client\.js.*$/i, '');
  const billgateBaseUrl = config.scriptUrl.replace(/\/[^/]+$/, '/');
  const isDirectCreditFlow = resolvedServiceCode === '0900';
  const creditPostUrl = `${gatewayOrigin}/credit/certify.jsp`;

  const html = useMemo(
    () => buildPaymentHtml(paymentData, serviceCode, config.scriptUrl, config.protocolType),
    [config.protocolType, config.scriptUrl, paymentData, serviceCode],
  );

  const finishPayment = useCallback(
    (result: BillgateResult) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;

      try {
        onResult?.(result);
      } catch {}

      navigation.navigate('BuyList', { initialTab: 'purchase_agency' });
    },
    [navigation, onResult],
  );

  const confirmCancel = useCallback(() => {
    finishPayment({ status: 'cancel', orderId: fallbackOrderId });
  }, [fallbackOrderId, finishPayment]);

  const closePopup = useCallback(() => {
    setPopupUrl(null);
    setPopupLoading(false);
  }, []);

  const openWebsiteFallback = useCallback(async () => {
    try {
      await Linking.openURL(websiteFallbackUrl);
    } catch {
      Alert.alert(t('payment.openWebsiteFailed') || 'Open website failed', websiteFallbackUrl);
    }
  }, [websiteFallbackUrl, t]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (resolvedRef.current) {
        return false;
      }

      confirmCancel();
      return true;
    });

    return () => sub.remove();
  }, [confirmCancel]);

  useEffect(() => {
    // Allow both portrait and landscape orientations for payment screen
    Orientation.unlockAllOrientations();

    return () => {
      // Lock back to portrait when leaving payment screen
      Orientation.lockToPortrait();
    };
  }, []);

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      const url = request.url || '';
      const resultStatus = detectResultStatus(url);

      if (resultStatus) {
        finishPayment(buildResultFromUrl(resultStatus, url, fallbackOrderId));
        return false;
      }

      setCurrentUrl(url);

      if (isExternalAppUrl(url)) {
        openExternalApp(url).then((opened) => {
          if (!opened) {
            Alert.alert(
              t('payment.appLaunchFailedTitle') || 'Could not open app',
              t('payment.appLaunchFailedMessage') ||
                'The required payment app is not installed on this device.',
            );
          }
        });
        return false;
      }

      return true;
    },
    [fallbackOrderId, finishPayment, t],
  );

  const handleNavigationStateChange = useCallback(
    (navigationState: WebViewNavigation) => {
      setCurrentUrl(navigationState.url || '');
      const resultStatus = detectResultStatus(navigationState.url || '');
      if (!resultStatus) return;
      finishPayment(buildResultFromUrl(resultStatus, navigationState.url || '', fallbackOrderId));
    },
    [fallbackOrderId, finishPayment],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const payload = event.nativeEvent.data;
      if (!payload) return;

      try {
        const parsed = JSON.parse(payload);

        // Helper function to decode Korean text from messages
        const decodeKoreanMessage = (text: string | undefined): string | undefined => {
          if (!text) return undefined;
          try {
            return decodeURIComponent(text);
          } catch {
            return text; // Return original if decoding fails
          }
        };

        if (parsed?.type === 'billgate-debug') {
          if (parsed.step === 'gx-pay-timeout') {
            setLoading(false);
            setGatewayError(t('payment.gatewayTimeout') || 'Billgate script did not load in time.');
          } else if (parsed.step === 'gx-pay-error') {
            setLoading(false);
            setGatewayError(decodeKoreanMessage(parsed.message) || (t('payment.gatewayError') || 'Billgate failed to start.'));
          } else if (parsed.step === 'direct-credit-submit-error') {
            setLoading(false);
            setGatewayError(decodeKoreanMessage(parsed.message) || (t('payment.creditPageError') || 'Billgate credit page failed to open.'));
          } else if (parsed.step === 'direct-credit-form-missing') {
            setLoading(false);
            setGatewayError(t('payment.formMissing') || 'Billgate credit form could not be found.');
          } else if (parsed.step === 'gx-pay-called') {
            setGatewayError(null);
          } else if (parsed.step === 'direct-credit-submit-called') {
            setGatewayError(null);
          }
          return;
        }

        if (parsed?.source === 'todaymall-billgate-payment' && parsed?.status) {
          finishPayment({
            status: parsed.status,
            orderId: parsed.orderId ?? fallbackOrderId,
            transactionId: parsed.transactionId,
            message: decodeKoreanMessage(parsed.errorMessage ?? parsed.detailMessage),
          });
        }
      } catch {}
    },
    [fallbackOrderId, finishPayment, t],
  );

  const handlePopupRequest = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      const url = request.url || '';
      const resultStatus = detectResultStatus(url);

      if (resultStatus) {
        closePopup();
        finishPayment(buildResultFromUrl(resultStatus, url, fallbackOrderId));
        return false;
      }

      if (isExternalAppUrl(url)) {
        openExternalApp(url).then((opened) => {
          if (!opened) {
            Alert.alert(
              t('payment.appLaunchFailedTitle') || 'Could not open app',
              t('payment.appLaunchFailedMessage') ||
                'The required payment app is not installed on this device.',
            );
          }
        });
        return false;
      }

      return true;
    },
    [closePopup, fallbackOrderId, finishPayment, t],
  );

  const handlePopupNavigationStateChange = useCallback(
    (navigationState: WebViewNavigation) => {
      const resultStatus = detectResultStatus(navigationState.url || '');
      if (!resultStatus) return;
      closePopup();
      finishPayment(buildResultFromUrl(resultStatus, navigationState.url || '', fallbackOrderId));
    },
    [closePopup, fallbackOrderId, finishPayment],
  );

  const handlePopupMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const payload = event.nativeEvent.data;
      if (!payload) return;

      try {
        const parsed = JSON.parse(payload);

        // Helper function to decode Korean text from messages
        const decodeKoreanMessage = (text: string | undefined): string | undefined => {
          if (!text) return undefined;
          try {
            return decodeURIComponent(text);
          } catch {
            return text; // Return original if decoding fails
          }
        };

        if (parsed?.source === 'todaymall-billgate-payment' && parsed?.status) {
          closePopup();
          finishPayment({
            status: parsed.status,
            orderId: parsed.orderId ?? fallbackOrderId,
            transactionId: parsed.transactionId,
            message: decodeKoreanMessage(parsed.errorMessage ?? parsed.detailMessage),
          });
        }
      } catch {}
    },
    [closePopup, fallbackOrderId, finishPayment],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        ref={webViewRef}
        source={
          isDirectCreditFlow
            ? { html, baseUrl: `${gatewayOrigin}/` }
            : { html, baseUrl: billgateBaseUrl }
        }
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injectedBridgeScript}
        injectedJavaScript={injectedFitScript}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onLoadStart={(event) => {
          setLoading(true);
          setCurrentUrl(event.nativeEvent.url || '');
        }}
        onLoadEnd={(event) => {
          setLoading(false);
          setGatewayError(null);
          setCurrentUrl(event.nativeEvent.url || '');
          webViewRef.current?.injectJavaScript(injectedFitScript);

          if (
            isDirectCreditFlow &&
            !directSubmitAttemptedRef.current &&
            (event.nativeEvent.url === 'about:blank' ||
              event.nativeEvent.url?.startsWith(`${gatewayOrigin}/`) ||
              !event.nativeEvent.url)
          ) {
            directSubmitAttemptedRef.current = true;
            webViewRef.current?.injectJavaScript(`
              (function () {
                try {
                  var form = document.getElementById('billgatePayment');
                  if (form) {
                    form.submit();
                    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'billgate-debug',
                        step: 'direct-credit-submit-called'
                      }));
                    }
                  } else if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'billgate-debug',
                      step: 'direct-credit-form-missing'
                    }));
                  }
                } catch (error) {
                  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'billgate-debug',
                      step: 'direct-credit-submit-error',
                      message: String(error)
                    }));
                  }
                }
                true;
              })();
            `);
          }
        }}
        onError={() => {
          if (resolvedRef.current) return;
          setGatewayError(t('payment.loadFailed') || 'Failed to load payment page');
          finishPayment({
            status: 'failed',
            orderId: fallbackOrderId,
            message: t('payment.loadFailed') || 'Failed to load payment page',
          });
        }}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows
        scalesPageToFit={Platform.OS === 'ios'}
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        onOpenWindow={(event) => {
          const targetUrl = event.nativeEvent.targetUrl;
          if (!targetUrl) return;
          setPopupLoading(true);
          setPopupUrl(targetUrl);
        }}
        mixedContentMode="always"
        allowsBackForwardNavigationGestures={false}
        cacheEnabled={false}
        applicationNameForUserAgent="TodayMall-RN"
      />

      <TouchableOpacity
        style={styles.closeButton}
        onPress={confirmCancel}
        accessibilityLabel={t('common.close') || 'Close'}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Text style={styles.closeButtonText}>x</Text>
      </TouchableOpacity>

      {loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : null}

      {gatewayError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{gatewayError}</Text>
          <TouchableOpacity style={styles.errorBannerButton} onPress={openWebsiteFallback}>
            <Text style={styles.errorBannerButtonText}>{t('payment.openWebsite') || 'Open Website'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={!!popupUrl}
        transparent
        animationType="fade"
        onRequestClose={closePopup}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <TouchableOpacity
              style={styles.popupCloseButton}
              onPress={closePopup}
              accessibilityLabel={t('common.close') || 'Close'}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>

            {popupUrl ? (
              <WebView
                source={{ uri: popupUrl }}
                originWhitelist={['*']}
                injectedJavaScriptBeforeContentLoaded={injectedBridgeScript}
                injectedJavaScript={injectedFitScript}
                onShouldStartLoadWithRequest={handlePopupRequest}
                onNavigationStateChange={handlePopupNavigationStateChange}
                onMessage={handlePopupMessage}
                onLoadStart={() => setPopupLoading(true)}
                onLoadEnd={() => setPopupLoading(false)}
                javaScriptEnabled
                javaScriptCanOpenWindowsAutomatically
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                setSupportMultipleWindows
                scalesPageToFit={Platform.OS === 'ios'}
                automaticallyAdjustContentInsets={false}
                contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
                mixedContentMode="always"
                allowsBackForwardNavigationGestures={false}
                cacheEnabled={false}
                applicationNameForUserAgent="TodayMall-RN"
                style={styles.popupWebView}
              />
            ) : null}

            {popupLoading ? (
              <View pointerEvents="none" style={styles.popupLoadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  popupCard: {
    width: '100%',
    height: '88%',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    overflow: 'hidden',
  },
  popupCloseButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  popupWebView: {
    flex: 1,
  },
  popupLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.lg,
    backgroundColor: 'rgba(196, 43, 28, 0.95)',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorBannerText: {
    color: COLORS.white,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBannerButton: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  errorBannerButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default BillgatePaymentScreen;
