/**
 * TabBarContext.js
 *
 * Provides a shared Animated.Value (`tabBarY`) that controls the vertical
 * position of the bottom tab bar, enabling two behaviours:
 *
 *   1. Scroll-based auto-hide (L1):
 *        – StoreListingScreen calls showTabBar / hideTabBar as the user scrolls
 *
 *   2. Stack-depth hide (L2+):
 *        – Detail / Cart / funnel screens call hideTabBar() on focus
 *          and showTabBar() when they lose focus (useFocusEffect cleanup)
 *
 * The Animated.Value is passed directly into the Navigation tabBarStyle
 * transform so it is driven entirely on the UI thread (useNativeDriver).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { Animated, Platform } from 'react-native';

// Tab bar pixel heights (must match Navigation.js tabBarStyle.height)
export const TAB_BAR_H = Platform.OS === 'ios' ? 80 : 64;

const TabBarCtx = createContext(null);

export function TabBarProvider({ children }) {
  const tabBarY = useRef(new Animated.Value(0)).current;

  const showTabBar = useCallback(() => {
    Animated.spring(tabBarY, {
      toValue:         0,
      useNativeDriver: true,
      damping:         20,
      stiffness:       200,
      mass:            0.8,
    }).start();
  }, [tabBarY]);

  const hideTabBar = useCallback(() => {
    Animated.timing(tabBarY, {
      toValue:         TAB_BAR_H,
      duration:        220,
      useNativeDriver: true,
    }).start();
  }, [tabBarY]);

  return (
    <TabBarCtx.Provider value={{ tabBarY, showTabBar, hideTabBar }}>
      {children}
    </TabBarCtx.Provider>
  );
}

export function useTabBar() {
  const ctx = useContext(TabBarCtx);
  if (!ctx) throw new Error('useTabBar must be used inside <TabBarProvider>.');
  return ctx;
}
