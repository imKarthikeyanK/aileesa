/**
 * App.js — Aileesa root
 *
 * Tree:
 *   GestureHandlerRootView   (required by react-native-gesture-handler)
 *     ThemeProvider           (global design system context)
 *       StatusBar             (transparent, dark icons)
 *       Navigation            (NavigationContainer + tabs + stacks)
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/theme/ThemeContext';
import Navigation from './src/navigation/Navigation';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <StatusBar style="dark" translucent />
        <Navigation />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
