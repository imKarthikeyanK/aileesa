/**
 * StoreListingScreen — Market L1
 *
 * Features:
 *   • Collapsible animated header (useNativeDriver, no layout jank)
 *       ├─ Title bar (always sticky): "Aileesa" wordmark + action icons
 *       ├─ Expand zone (68 dp): location row + greeting → slides behind title bar on scroll
 *       └─ Search bar (64 dp): pinned, always visible, moves flush under title bar when collapsed
 *   • Category filter chips
 *   • Paginated FlatList of StoreCards via GET /stores API
 *   • Tap card → StoreDetail (L2)
 *
 * Animation render order (bottom → top):
 *   [1] Animated.FlatList
 *   [2] Animated container (expand zone + search bar)  elevation: 3
 *   [3] Title bar                                       elevation: 5
 *   → expand zone slides BEHIND the title bar on scroll
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getStores } from '../../api/storeApi';
import { useLocation } from '../../context/LocationContext';
import { useTabBar, TAB_BAR_H } from '../../context/TabBarContext';
import { useCart } from '../../context/CartContext';
import { useAddress } from '../../context/AddressContext';
import CartFloatingCard from '../../components/CartFloatingCard';
import Toast from '../../components/Toast';
import * as Location from 'expo-location';

const { width: SW } = Dimensions.get('window');

// ─── Design Tokens ─────────────────────────────────────────────────────────────

const ACCENT       = '#6200EE';
const ACCENT_LIGHT = '#EDE7F6';
const ACCENT_DIM   = '#B39DDB';
const WHITE        = '#FFFFFF';
const BG           = '#F7F7FB';
const TEXT_PRI     = '#1A1A2E';
const TEXT_SEC     = '#64748B';
const TEXT_MUTED   = '#9CA3AF';
const AMBER        = '#F59E0B';
const BORDER       = '#EDECF5';
const SUCCESS      = '#10B981';

// ─── Feature Flags ─────────────────────────────────────────────────────────────
// Set FEATURE_SEARCH = true to re-enable the search bar in v2.
const FEATURE_SEARCH = false;
// Set FEATURE_FILTER = true to re-enable category filter chips.
// For now always show all stores (no filtering).
const FEATURE_FILTER = false;

// ─── Layout Constants ──────────────────────────────────────────────────────────

const TITLE_BAR_H = 56;   // always visible
const EXPAND_H    = 68;   // collapses on scroll
const SEARCH_H    = 64;   // always visible, moves flush with title bar when collapsed

// ─── Category Filter Config ────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',          label: 'All',         icon: 'grid-outline' },
  { id: 'Grocery',      label: 'Grocery',     icon: 'leaf-outline' },
  { id: 'Bakery',       label: 'Bakery',      icon: 'cafe-outline' },
  { id: 'Pharmacy',     label: 'Pharmacy',    icon: 'medkit-outline' },
  { id: 'Electronics',  label: 'Electronics', icon: 'hardware-chip-outline' },
  { id: 'Fashion',      label: 'Fashion',     icon: 'shirt-outline' },
  { id: 'Wellness',     label: 'Wellness',    icon: 'flower-outline' },
  { id: 'Pet Supplies', label: 'Pets',        icon: 'paw-outline' },
];

// ─── (Legacy static STORES removed — data now comes from getStores API) ─────────

// const _UNUSED_STORES = [
//   {
//     id: '1',
//     name: 'Green Basket',
//     category: 'Grocery',
//     rating: 4.8,
//     reviewCount: 1240,
//     deliveryTime: '15–25 min',
//     distance: '0.8 km',
//     coverBg: '#E8F5E9',
//     icon: 'leaf',
//     iconColor: '#2E7D32',
//     tag: 'Popular',
//     tagColor: ACCENT,
//   },
//   {
//     id: '2',
//     name: 'The Bread Box',
//     category: 'Bakery',
//     rating: 4.7,
//     reviewCount: 856,
//     deliveryTime: '20–30 min',
//     distance: '1.2 km',
//     coverBg: '#FFF8E1',
//     icon: 'cafe',
//     iconColor: '#E65100',
//     tag: 'New',
//     tagColor: SUCCESS,
//   },
//   {
//     id: '3',
//     name: 'MediQuick',
//     category: 'Pharmacy',
//     rating: 4.6,
//     reviewCount: 540,
//     deliveryTime: '10–20 min',
//     distance: '0.5 km',
//     coverBg: '#E3F2FD',
//     icon: 'medkit',
//     iconColor: '#1565C0',
//     tag: 'Open 24×7',
//     tagColor: '#1565C0',
//   },
//   {
//     id: '4',
//     name: 'TechHub Local',
//     category: 'Electronics',
//     rating: 4.5,
//     reviewCount: 320,
//     deliveryTime: '30–45 min',
//     distance: '2.1 km',
//     coverBg: '#F3E5F5',
//     icon: 'hardware-chip',
//     iconColor: '#6A1B9A',
//     tag: null,
//     tagColor: null,
//   },
//   {
//     id: '5',
//     name: 'Style Street',
//     category: 'Fashion',
//     rating: 4.4,
//     reviewCount: 628,
//     deliveryTime: '25–35 min',
//     distance: '1.7 km',
//     coverBg: '#FCE4EC',
//     icon: 'shirt',
//     iconColor: '#AD1457',
//     tag: 'Trending',
//     tagColor: '#AD1457',
//   },
//   {
//     id: '6',
//     name: 'Daily Picks',
//     category: 'Grocery',
//     rating: 4.9,
//     reviewCount: 2100,
//     deliveryTime: '12–20 min',
//     distance: '0.3 km',
//     coverBg: '#E0F7FA',
//     icon: 'cart',
//     iconColor: '#00695C',
//     tag: 'Top Rated',
//     tagColor: AMBER,
//   },
//   {
//     id: '7',
//     name: 'PureHerbs',
//     category: 'Wellness',
//     rating: 4.6,
//     reviewCount: 410,
//     deliveryTime: '18–28 min',
//     distance: '1.4 km',
//     coverBg: '#F1F8E9',
//     icon: 'flower',
//     iconColor: '#558B2F',
//     tag: 'Organic',
//     tagColor: SUCCESS,
//   },
//   {
//     id: '8',
//     name: 'Pet Paradise',
//     category: 'Pet Supplies',
//     rating: 4.8,
//     reviewCount: 290,
//     deliveryTime: '30–40 min',
//     distance: '2.3 km',
//     coverBg: '#FFF3E0',
//     icon: 'paw',
//     iconColor: '#E65100',
//     tag: 'New',
//     tagColor: ACCENT,
//   },
// ];

// ─── LocationCard ─────────────────────────────────────────────────────────────
// Shared card for both "permission denied" and "not serviceable" states.

function LocationCard({ icon, iconBg, iconColor, title, subtitle, btnLabel, onBtn }) {
  return (
    <View style={styles.locCardWrap}>
      <View style={styles.locCard}>
        <View style={[styles.locCardIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={40} color={iconColor} />
        </View>
        <Text style={styles.locCardTitle}>{title}</Text>
        <Text style={styles.locCardSub}>{subtitle}</Text>
        {btnLabel && (
          <TouchableOpacity
            style={[styles.locCardBtn, { backgroundColor: iconColor }]}
            onPress={onBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.locCardBtnText}>{btnLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── CategoryChip ──────────────────────────────────────────────────────────────

function CategoryChip({ item, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons
        name={item.icon}
        size={13}
        color={selected ? WHITE : TEXT_SEC}
      />
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── StoreCard ─────────────────────────────────────────────────────────────────

/**
 * Safely extracts a URI string from an image field that may be:
 *   - a plain string   "https://..."
 *   - an array         ["https://...", ...]
 *   - null / undefined
 */
function _imageUri(val) {
  if (!val) return null;
  if (typeof val === 'string') return val || null;
  if (Array.isArray(val)) {
    const first = val.find(v => typeof v === 'string' && v);
    return first ?? null;
  }
  return null;
}

function StoreCard({ store, onPress }) {
  // API returns snake_case; support both for forward-compat
  // banner_url is the real API field; image_url as secondary fallback for thumbnail
  const bannerImage  = _imageUri(store.banner_url ?? store.banner_image ?? store.image_url);
  // Use || (not ??) so empty strings '' fall through to the default
  const coverBg      = store.cover_bg    || store.coverBg    || '#F0F1F8';
  const iconColor    = store.icon_color  || store.iconColor  || ACCENT;
  const tagColor     = store.tag_color   || store.tagColor   || ACCENT;
  const reviewCount  = store.review_count ?? store.reviewCount ?? 0;
  const deliveryTime = store.delivery_time ?? store.deliveryTime;
  // categories is an array from the API; fall back to legacy category string
  const _cats = store.categories;
  const categoryLabel = Array.isArray(_cats) && _cats.length > 0
    ? _cats.map(c => String(c).trim()).filter(Boolean).join(' · ')
    : (store.category ?? '');

  return (
    <TouchableOpacity
      style={[styles.card, store.is_open === false && styles.cardClosed]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* ── Image area — 12 dp border radius (spec) ─────────── */}
      <View style={[styles.cardImage, { backgroundColor: coverBg }]}>
        {/* Real banner image — fills card when the API provides one */}
        {bannerImage && (
          <Image source={{ uri: bannerImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        {/* Decorative fallback — icon wash + monogram (hidden when real banner present) */}
        {!bannerImage && (
          <>
            <Ionicons
              name={store.icon}
              size={64}
              color={`${iconColor}18`}
              style={styles.cardBgIcon}
            />
            <View style={[styles.monogram, {
              backgroundColor: `${iconColor}1A`,
              borderColor: `${iconColor}30`,
            }]}>
              <Text style={[styles.monogramText, { color: iconColor }]}>
                {store.name.charAt(0)}
              </Text>
            </View>
          </>
        )}

        {/* Closed overlay */}
        {store.is_open === false && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedOverlayText}>Closed</Text>
          </View>
        )}

        {/* Distance tag — bottom-left absolute */}
        <View style={styles.distanceBadge}>
          <Ionicons name="location" size={10} color={ACCENT} />
          <Text style={styles.distanceText}>{store.distance}</Text>
        </View>

        {/* Status tag — top-left absolute */}
        {store.tag && store.is_open !== false && (
          <View style={[styles.tagBadge, { backgroundColor: tagColor }]}>
            <Text style={styles.tagText}>{store.tag}</Text>
          </View>
        )}
      </View>

      {/* ── Card body ───────────────────────────────────────── */}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {store.name}
          </Text>
          {/* Star rating badge */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={AMBER} />
            <Text style={styles.ratingText}>{store.rating}</Text>
          </View>
        </View>

        {/* Category — gray as specified */}
        <Text style={styles.cardCategory} numberOfLines={1}>{categoryLabel}</Text>

        <View style={styles.cardMetaRow}>
          <Ionicons name="time-outline" size={12} color={TEXT_MUTED} />
          <Text style={styles.cardMetaText}>{deliveryTime}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.reviewCount}>
            {reviewCount.toLocaleString()} reviews
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function StoreListingScreen({ navigation }) {
  const insets  = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Tab bar show/hide on scroll ───────────────────────────────────────────────
  const { showTabBar, hideTabBar } = useTabBar();
  const lastScrollY    = useRef(0);
  const isTabBarHidden = useRef(false);

  // Restore tab bar whenever SLP re-gains focus (back from SDS or Cart).
  useFocusEffect(useCallback(() => {
    showTabBar();
    isTabBarHidden.current = false;
  }, [showTabBar]));

  const handleScrollDirection = useCallback((y) => {
    const diff = y - lastScrollY.current;
    lastScrollY.current = y;
    if (diff > 8 && !isTabBarHidden.current) {
      isTabBarHidden.current = true;
      hideTabBar();
    } else if (diff < -8 && isTabBarHidden.current) {
      isTabBarHidden.current = false;
      showTabBar();
    }
  }, [hideTabBar, showTabBar]);

  // ── Address ─────────────────────────────────────────────────────────────────
  const { selectedAddress } = useAddress();

  // ── Cart ──────────────────────────────────────────────────────────────────────
  const { items } = useCart();
  const totalCartItems = items.reduce((s, i) => s + i.quantity, 0);

  // ── Location / serviceability ─────────────────────────────────────────────────
  const { coords, serviceability, status: locationStatus, permissionStatus, runServiceabilityCheck } = useLocation();
  const queryLatitude = selectedAddress?.lat ?? coords?.latitude ?? null;
  const queryLongitude = selectedAddress?.lng ?? coords?.longitude ?? null;

  // Trigger serviceability check once when SLP mounts
  useEffect(() => {
    if (permissionStatus === 'granted' && serviceability === null && locationStatus === 'done') {
      runServiceabilityCheck();
    }
  }, [permissionStatus, locationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const permissionGranted        = permissionStatus === 'granted';
  const isCheckingServiceability = ['locating', 'checking'].includes(locationStatus);
  const serviceabilityDone       = locationStatus === 'done' && serviceability !== null;
  const showPermissionCard       = locationStatus === 'done' && !permissionGranted;
  const showNonServiceableCard   = serviceabilityDone && serviceability?.serviceable === false;
  const [toastMsg, setToastMsg] = useState('');

  // ── Category filter ───────────────────────────────────────────────────────────
  const [category, setCategory] = useState('all');

  // ── Paginated store list ──────────────────────────────────────────────────────
  const [stores,     setStores]     = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  // Refs for pagination state (avoid stale closures in callbacks)
  const pageRef       = useRef(1);
  const hasNextRef    = useRef(false);
  const isLoadingRef  = useRef(false);
  const categoryRef   = useRef('all');

  const fetchStores = useCallback(async (pageNum, replace) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    if (replace) setLoading(true);

    try {
      const res = await getStores({
        page: pageNum,
        category: categoryRef.current,
        latitude: queryLatitude,
        longitude: queryLongitude,
      });
      console.log('[SLP] getStores raw response:', JSON.stringify(res, null, 2));

      const data       = Array.isArray(res.data) ? res.data : [];
      const pagination = (res.pagination && typeof res.pagination === 'object') ? res.pagination : {};

      if (replace) {
        setStores(data);
      } else {
        setStores(prev => [...prev, ...data]);
      }

      setTotalCount(pagination.total ?? 0);
      hasNextRef.current = pagination.has_next ?? false;
      pageRef.current    = pageNum;
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load stores. Please try again.');
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryLatitude, queryLongitude]); // stable paging refs; location inputs trigger refetches

  // Initial load + category-change refetch
  useEffect(() => {
    categoryRef.current = category;
    pageRef.current     = 1;
    hasNextRef.current  = false;
    fetchStores(1, true);
  }, [category, queryLatitude, queryLongitude]);

  const handleEndReached = useCallback(() => {
    if (hasNextRef.current && !isLoadingRef.current) {
      fetchStores(pageRef.current + 1, false);
    }
  }, [fetchStores]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    pageRef.current    = 1;
    hasNextRef.current = false;
    fetchStores(1, true);
  }, [fetchStores]);

  const TOTAL_HEADER_H = insets.top + TITLE_BAR_H + EXPAND_H + (FEATURE_SEARCH ? SEARCH_H : 0);

  // ── Animated interpolations (all useNativeDriver: true) ──────────────────────

  const containerTranslateY = scrollY.interpolate({
    inputRange: [0, EXPAND_H],
    outputRange: [0, -EXPAND_H + 32],
    extrapolate: 'clamp',
  });

  const expandOpacity = scrollY.interpolate({
    inputRange: [0, EXPAND_H * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const titleBorderOpacity = scrollY.interpolate({
    inputRange: [EXPAND_H - 10, EXPAND_H + 10],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Icons (notif + bag) fade out as user scrolls past the expand zone
  const iconsOpacity = scrollY.interpolate({
    inputRange: [EXPAND_H * 0.4, EXPAND_H * 0.85],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Compact location pill fades in as icons fade out
  const miniLocOpacity = scrollY.interpolate({
    inputRange: [EXPAND_H * 0.55, EXPAND_H],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Pill slides in from the right
  const miniLocTranslateX = scrollY.interpolate({
    inputRange: [EXPAND_H * 0.55, EXPAND_H],
    outputRange: [20, 0],
    extrapolate: 'clamp',
  });

  const wordmarkScale = scrollY.interpolate({
    inputRange: [0, EXPAND_H],
    outputRange: [1, 1.04],
    extrapolate: 'clamp',
  });

  // ── Sub-renders ───────────────────────────────────────────────────────────────

  const renderListHeader = () => (
    <View>
      {/* Category filter chips — hidden via FEATURE_FILTER flag; all stores shown by default */}
      {FEATURE_FILTER && (
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={i => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          renderItem={({ item }) => (
            <CategoryChip
              item={item}
              selected={category === item.id}
              onPress={() => setCategory(item.id)}
            />
          )}
        />
      )}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stores Near You</Text>
        {totalCount > 0 && (
          <Text style={styles.sectionCount}>{totalCount} found</Text>
        )}
      </View>
    </View>
  );

  const renderListFooter = () => {
    if (error) {
      return (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#C62828" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchStores(pageRef.current, false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!loading && hasNextRef.current) {
      return (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={handleEndReached}
          activeOpacity={0.75}
        >
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      );
    }
    if (loading && stores.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Finding stores near you…</Text>
        </View>
      );
    }
    if (error) return null; // error shown in footer
    return (
      <View style={styles.emptyState}>
        <Ionicons name="storefront-outline" size={52} color={BORDER} />
        <Text style={styles.emptyTitle}>No stores in this category</Text>
        <Text style={styles.emptySubtitle}>Try selecting a different filter</Text>
      </View>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* ━━━ [1] Content: location card OR scrollable store list ━━━━━━━━━━━━━━━━━━ */}
      {showPermissionCard ? (
        <View style={[styles.locCardArea, { paddingTop: TOTAL_HEADER_H }]}>
          <LocationCard
            icon="location-outline"
            iconBg={ACCENT_LIGHT}
            iconColor={ACCENT}
            title="Location access needed"
            subtitle="Grant location access so we can check if we deliver to your area and show you nearby stores."
            btnLabel="Grant Permission"
            onBtn={async () => {
              await Location.requestForegroundPermissionsAsync().catch(() => {});
              runServiceabilityCheck();
            }}
          />
        </View>
      ) : showNonServiceableCard ? (
        <View style={[styles.locCardArea, { paddingTop: TOTAL_HEADER_H }]}>
          <LocationCard
            icon="location-off-outline"
            iconBg="#FEF3C7"
            iconColor="#92400E"
            title="We’re not in your area yet"
            subtitle="We’re expanding rapidly and will be available in your location very soon. Stay tuned!"
          />
        </View>
      ) : (
      <Animated.FlatList
        data={stores}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            onPress={() => navigation.navigate('StoreDetail', { store: item })}
          />
        )}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={[styles.listContent, { paddingTop: TOTAL_HEADER_H-20, paddingBottom: TAB_BAR_H + insets.bottom + (totalCartItems > 0 ? 86 : 24) }]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            // useNativeDriver for scroll-driven Animated.event is not supported on web;
            // react-native-web silently ignores it and the animation breaks.
            useNativeDriver: Platform.OS !== 'web',
            listener: (e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              handleScrollDirection(contentOffset.y);
              // On web, Animated.FlatList's onEndReached may not fire reliably.
              // We replicate the threshold check inside the scroll listener so
              // users get seamless auto-pagination without clicking "Load more".
              if (
                Platform.OS === 'web' &&
                contentSize?.height > 0 &&
                layoutMeasurement?.height > 0
              ) {
                const distanceFromEnd =
                  contentSize.height - (contentOffset.y + layoutMeasurement.height);
                if (distanceFromEnd < 400) handleEndReached();
              }
            },
          },
        )}
        scrollEventThrottle={16}
      />
      )}

      {/* ━━━ [2] Animated container: expand zone + search bar ━━━━━━━━━━━━━━━━━ */}
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            top: insets.top + TITLE_BAR_H,
            transform: [{ translateY: containerTranslateY }],
          },
        ]}
      >
        {/* Expand zone — fades out on scroll */}
        <Animated.View style={[styles.expandZone, { opacity: expandOpacity }]}>
          <TouchableOpacity
            style={styles.locationRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('LocationPicker')}
          >
            <Ionicons name="location" size={13} color={ACCENT} />
            <Text style={styles.locationText} numberOfLines={1}>
              {selectedAddress?.formatted_address ? (
                <>
                  <Text style={styles.locationBold}>Delivering to </Text>
                  {selectedAddress.formatted_address}
                </>
              ) : 'Set delivery address'}
            </Text>
            <Ionicons name="chevron-down" size={13} color={TEXT_PRI} />
          </TouchableOpacity>
        </Animated.View>

        {/* Search bar — feature-flagged; set FEATURE_SEARCH=true to re-enable */}
        {FEATURE_SEARCH && (
          <View style={styles.searchOuter}>
            <Text style={styles.greeting}>What are you looking for today?</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={17} color={ACCENT_DIM} />
              <Text style={styles.searchPlaceholder}>
                Search for shops or products
              </Text>
              <View style={styles.searchMicBtn}>
                <Ionicons name="mic-outline" size={16} color={ACCENT} />
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      {/* ━━━ Cart floating card — sits above bottom tab bar ━━━━━━━━━━━━━━━━━━━ */}
      <CartFloatingCard
        bottomInset={TAB_BAR_H + insets.bottom}
        onPress={() => navigation.navigate('Cart')}
      />

      {/* ━━━ Toast — serviceability / error messages ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />

      {/* ━━━ [3] Sticky title bar — rendered last, always on top ━━━━━━━━━━━━━━ */}
      <Animated.View
        style={[
          styles.titleBar,
          { paddingTop: insets.top, height: insets.top + TITLE_BAR_H },
        ]}
      >
        {/* Bottom border fades in when collapsed */}
        <Animated.View
          style={[styles.titleBarBorder, { opacity: titleBorderOpacity }]}
        />
        <View style={styles.titleBarInner}>
          <Animated.Text
            style={[styles.wordmark, { transform: [{ scale: wordmarkScale }] }]}
          >
            Aileesa
          </Animated.Text>
          <View style={styles.titleBarActions}>
            {/* Compact location pill — slides in when expand zone is hidden */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.miniLocPill,
                {
                  opacity: miniLocOpacity,
                  transform: [{ translateX: miniLocTranslateX }],
                },
              ]}
            >
              <Ionicons name="location" size={13} color={ACCENT} />
              <Text style={styles.miniLocText} numberOfLines={1}>
                {!permissionGranted
                  ? 'Location off'
                  : isCheckingServiceability
                  ? 'Locating…'
                  : (serviceability?.city ?? '—')}
              </Text>
            </Animated.View>

            {/* Notification + bag icons — fade out when pill appears */}
            <Animated.View
              style={[styles.titleBarIconsRow, { opacity: iconsOpacity }]}
              pointerEvents={/* prevent ghost taps when invisible */ 'box-none'}
            >
              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
                <Ionicons name="notifications-outline" size={20} color={TEXT_PRI} />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (totalCartItems > 0) {
                    navigation.navigate('Cart');
                  } else {
                    setToastMsg('Your cart is empty');
                  }
                }}
              >
                <Ionicons name="bag-outline" size={20} color={TEXT_PRI} />
                {totalCartItems > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {totalCartItems > 9 ? '9+' : totalCartItems}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const CARD_IMAGE_H = 130;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Title bar ────────────────────────────────────────────────────────────────
  titleBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: WHITE,
    zIndex: 10,
    elevation: 5,
  },
  titleBarBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: BORDER,
  },
  titleBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.5,
  },
  titleBarActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  titleBarIconsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniLocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 140,
  },
  miniLocText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
    flexShrink: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: ACCENT_LIGHT,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: WHITE,
    lineHeight: 12,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: ACCENT_LIGHT,
  },

  // ── Animated container (expand zone + search bar) ────────────────────────────
  animatedContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    zIndex: 9,
    elevation: 3,
  },

  // Expand zone
  expandZone: {
    height: EXPAND_H-48,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    justifyContent: 'center',
    gap: 5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SEC,
    fontWeight: '500',
  },
  locationBold: {
    fontWeight: '700',
    color: TEXT_PRI,
  },
  greeting: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 6,
  },

  // Search bar (always visible)
  searchOuter: {
    height: SEARCH_H,
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    gap: 10,
    borderWidth: 1,
    borderColor: `${ACCENT}18`,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: ACCENT_DIM,
    fontWeight: '500',
  },
  searchMicBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── FlatList ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 32,
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SEC,
  },
  chipLabelSelected: {
    color: WHITE,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRI,
    letterSpacing: -0.4,
  },
  sectionCount: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '500',
  },

  // ── Store card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 10,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },

  // Image area — spec: 12 dp border radius
  cardImage: {
    height: CARD_IMAGE_H,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardBgIcon: {
    position: 'absolute',
  },
  monogram: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontSize: 22,
    fontWeight: '800',
  },

  // Distance tag — absolute, bottom-left of image
  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },

  // Status tag — absolute, top-left of image
  tagBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.4,
  },

  // Card body
  cardBody: {
    paddingHorizontal: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRI,
    letterSpacing: -0.3,
    marginRight: 8,
  },

  // Star rating badge
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 3,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },

  // Category — gray
  cardCategory: {
    fontSize: 13,
    color: TEXT_SEC,
    fontWeight: '500',
    marginBottom: 6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 2,
  },
  cardMetaText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BORDER,
  },
  reviewCount: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '500',
  },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_SEC,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
  },

  // ── Closed store overlay ─────────────────────────────────────────────────────
  cardClosed: {
    opacity: 0.65,
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedOverlayText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Pagination / loading ─────────────────────────────────────────────────────
  centerLoader: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginVertical: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#C62828',
    fontWeight: '500',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },

  // ── Location card (permission denied / non-serviceable) ────────────────────
  locCardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  locCardWrap: {
    width: '100%',
  },
  locCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  locCardIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  locCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRI,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  locCardSub: {
    fontSize: 14,
    color: TEXT_SEC,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
    marginTop: 2,
  },
  locCardBtn: {
    marginTop: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  locCardBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: WHITE,
  },
});
