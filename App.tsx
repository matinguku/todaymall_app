import React from 'react';
import { StatusBar, Platform } from 'react-native';
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
import { prefetchHome } from './src/utils/homePrefetch';
import { usePlatformStore } from './src/store/platformStore';

// Kick off home-screen API calls before React mounts so HomeScreen can render
// with cached data on its first paint. Locale comes from the redux store
// (defaults to 'ko'); platform comes from zustand (defaults to '1688').
const initialPlatform = usePlatformStore.getState().selectedPlatform;
const initialLocale = store.getState().i18n.locale;
prefetchHome({ platform: initialPlatform, country: initialLocale });

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
