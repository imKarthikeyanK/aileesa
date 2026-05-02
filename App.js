/**
 * App.js — Aileesa root
 *
 * Tree:
 *   GestureHandlerRootView
 *     SafeAreaProvider        (required by useSafeAreaInsets throughout the app)
 *       LocationProvider      (location permissions + serviceability gate)
 *         ThemeProvider
 *           CartProvider
 *             StatusBar
 *             Navigation
 *             SplashScreen    (rendered on top until location flow completes)
 */

import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeContext';
import Navigation from './src/navigation/Navigation';
import { CartProvider } from './src/context/CartContext';
import { LocationProvider } from './src/context/LocationContext';
import SplashScreen from './src/screens/SplashScreen';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LocationProvider>
          <ThemeProvider>
            <CartProvider>
              <StatusBar style="light" translucent />
              <Navigation />
              {!splashDone && (
                <SplashScreen onDone={() => setSplashDone(true)} />
              )}
            </CartProvider>
          </ThemeProvider>
        </LocationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
