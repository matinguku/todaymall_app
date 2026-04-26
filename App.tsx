import React from 'react';
import { StatusBar, Platform, InteractionManager } from 'react-native';
import { preloadProductDetailScreen } from './src/screens/lazy/ProductDetailScreen.lazy';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Orientation from 'react-native-orientation-locker';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { SocketProvider } from './src/context/SocketContext';
import { ErrorBoundary } from './src/components';
import NoteBroadcastManager from './src/components/NoteBroadcastManager';
import AppNavigator from './src/navigation/AppNavigator';
import { Provider } from 'react-redux';
import { store } from './src/store';

// Using system fonts - no custom font loading needed
// LogBox / console.error filtering: see setupLogBox.ts (imported first from index.ts)

// Component that renders the main app content
const AppContent = () => {
  React.useEffect(() => {
    try {
      Orientation.lockToPortrait();
    } catch (e) {
      // Native module unavailable during dev reload; rebuild required
    }
  }, []);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setHidden(false);
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor('transparent');
    }
  }, []);

  // Prefetch the heavy ProductDetail chunk after the first render so tapping a
  // product card no longer waits on Suspense ("Loading product details...").
  React.useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      preloadProductDetailScreen();
    });
    return () => handle.cancel?.();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['left', 'right']}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <AppNavigator />
      <NoteBroadcastManager />
    </SafeAreaView>
  );
};

export default function App() {
  // Using system fonts - no custom fonts to load

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Provider store={store}>
            <ToastProvider>
              <AuthProvider>
                <SocketProvider>
                  <AppContent />
                </SocketProvider>
              </AuthProvider>
            </ToastProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
