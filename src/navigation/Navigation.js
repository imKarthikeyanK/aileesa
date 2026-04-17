import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme/theme';
import StoreListingScreen from '../screens/market/StoreListingScreen';
import StoreDetailScreen from '../screens/market/StoreDetailScreen';
import ExploreScreen from '../screens/ExploreScreen';
import YouScreen from '../screens/YouScreen';

// ─── Navigators ────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();
const MarketStack = createNativeStackNavigator();

// ─── Market Stack (L1 → L2) ────────────────────────────────────────────────────

function MarketNavigator() {
  return (
    <MarketStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <MarketStack.Screen
        name="StoreListing"
        component={StoreListingScreen}
      />
      <MarketStack.Screen
        name="StoreDetail"
        component={StoreDetailScreen}
        options={{
          // Custom header rendered inside StoreDetailScreen for full hero control
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </MarketStack.Navigator>
  );
}

// ─── Tab Icon Map ───────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  Market: {
    icon: 'storefront',
    iconOutline: 'storefront-outline',
    label: 'Market',
  },
  Explore: {
    icon: 'compass',
    iconOutline: 'compass-outline',
    label: 'Explore',
  },
  You: {
    icon: 'person',
    iconOutline: 'person-outline',
    label: 'You',
  },
};

// ─── Custom Tab Bar Label ───────────────────────────────────────────────────────

function TabLabel({ label, focused }) {
  return (
    <Text
      style={[
        styles.tabLabel,
        focused ? styles.tabLabelActive : styles.tabLabelInactive,
      ]}
    >
      {label}
    </Text>
  );
}

// ─── Root Navigation ────────────────────────────────────────────────────────────

export default function Navigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => {
          const config = TAB_CONFIG[route.name];
          return {
            headerShown: false,

            // Icon
            tabBarIcon: ({ focused, size }) => {
              const iconName = focused ? config.icon : config.iconOutline;
              const color = focused
                ? theme.colors.tabActive
                : theme.colors.tabInactive;
              return (
                <View style={styles.iconWrapper}>
                  <Ionicons name={iconName} size={size - 2} color={color} />
                  {focused && <View style={styles.activeDot} />}
                </View>
              );
            },

            // Label
            tabBarLabel: ({ focused }) => (
              <TabLabel label={config.label} focused={focused} />
            ),

            // Tab bar style
            tabBarStyle: styles.tabBar,
            tabBarItemStyle: styles.tabItem,
          };
        }}
      >
        <Tab.Screen name="Market" component={MarketNavigator} />
        <Tab.Screen name="Explore" component={ExploreScreen} />
        <Tab.Screen name="You" component={YouScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    height: Platform.OS === 'ios' ? 80 : 64,
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingTop: 8,
    ...theme.shadows.md,
  },
  tabItem: {
    paddingTop: 2,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.tabActive,
    marginTop: 3,
  },
  tabLabel: {
    fontSize: theme.typography.sizes.xs,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  tabLabelActive: {
    color: theme.colors.tabActive,
    fontWeight: theme.typography.weights.bold,
  },
  tabLabelInactive: {
    color: theme.colors.tabInactive,
    fontWeight: theme.typography.weights.medium,
  },
});
