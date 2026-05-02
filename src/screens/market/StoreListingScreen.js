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
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
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
import Toast from '../../components/Toast';

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

const _UNUSED_STORES = [
  {
    id: '1',
    name: 'Green Basket',
    category: 'Grocery',
    rating: 4.8,
    reviewCount: 1240,
    deliveryTime: '15–25 min',
    distance: '0.8 km',
    coverBg: '#E8F5E9',
    icon: 'leaf',
    iconColor: '#2E7D32',
    tag: 'Popular',
    tagColor: ACCENT,
  },
  {
    id: '2',
    name: 'The Bread Box',
    category: 'Bakery',
    rating: 4.7,
    reviewCount: 856,
    deliveryTime: '20–30 min',
    distance: '1.2 km',
    coverBg: '#FFF8E1',
    icon: 'cafe',
    iconColor: '#E65100',
    tag: 'New',
    tagColor: SUCCESS,
  },
  {
    id: '3',
    name: 'MediQuick',
    category: 'Pharmacy',
    rating: 4.6,
    reviewCount: 540,
    deliveryTime: '10–20 min',
    distance: '0.5 km',
    coverBg: '#E3F2FD',
    icon: 'medkit',
    iconColor: '#1565C0',
    tag: 'Open 24×7',
    tagColor: '#1565C0',
  },
  {
    id: '4',
    name: 'TechHub Local',
    category: 'Electronics',
    rating: 4.5,
    reviewCount: 320,
    deliveryTime: '30–45 min',
    distance: '2.1 km',
    coverBg: '#F3E5F5',
    icon: 'hardware-chip',
    iconColor: '#6A1B9A',
    tag: null,
    tagColor: null,
  },
  {
    id: '5',
    name: 'Style Street',
    category: 'Fashion',
    rating: 4.4,
    reviewCount: 628,
    deliveryTime: '25–35 min',
    distance: '1.7 km',
    coverBg: '#FCE4EC',
    icon: 'shirt',
    iconColor: '#AD1457',
    tag: 'Trending',
    tagColor: '#AD1457',
  },
  {
    id: '6',
    name: 'Daily Picks',
    category: 'Grocery',
    rating: 4.9,
    reviewCount: 2100,
    deliveryTime: '12–20 min',
    distance: '0.3 km',
    coverBg: '#E0F7FA',
    icon: 'cart',
    iconColor: '#00695C',
    tag: 'Top Rated',
    tagColor: AMBER,
  },
  {
    id: '7',
    name: 'PureHerbs',
    category: 'Wellness',
    rating: 4.6,
    reviewCount: 410,
    deliveryTime: '18–28 min',
    distance: '1.4 km',
    coverBg: '#F1F8E9',
    icon: 'flower',
    iconColor: '#558B2F',
    tag: 'Organic',
    tagColor: SUCCESS,
  },
  {
    id: '8',
    name: 'Pet Paradise',
    category: 'Pet Supplies',
    rating: 4.8,
    reviewCount: 290,
    deliveryTime: '30–40 min',
    distance: '2.3 km',
    coverBg: '#FFF3E0',
    icon: 'paw',
    iconColor: '#E65100',
    tag: 'New',
    tagColor: ACCENT,
  },
];

// ─── NonServiceableBanner ────────────────────────────────────────────────────────

function NonServiceableBanner() {
  return (
    <View style={styles.nsvcBanner}>
      <View style={styles.nsvcIconWrap}>
        <Ionicons name="location-off-outline" size={22} color="#92400E" />
      </View>
      <View style={styles.nsvcTextBlock}>
        <Text style={styles.nsvcTitle}>Service unavailable in your area</Text>
        <Text style={styles.nsvcSubtitle}>
          We’re expanding rapidly and will be available in your location very soon.
        </Text>
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

function StoreCard({ store, onPress }) {
  // API returns snake_case; support both for forward-compat
  const coverBg    = store.cover_bg    ?? store.coverBg;
  const iconColor  = store.icon_color  ?? store.iconColor;
  const tagColor   = store.tag_color   ?? store.tagColor;
  const reviewCount = store.review_count ?? store.reviewCount ?? 0;
  const deliveryTime = store.delivery_time ?? store.deliveryTime;

  return (
    <TouchableOpacity
      style={[styles.card, store.is_open === false && styles.cardClosed]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* ── Image area — 12 dp border radius (spec) ─────────── */}
      <View style={[styles.cardImage, { backgroundColor: coverBg }]}>
        {/* Large background icon — decorative wash */}
        <Ionicons
          name={store.icon}
          size={64}
          color={`${iconColor}18`}
          style={styles.cardBgIcon}
        />
        {/* Store initial monogram */}
        <View style={[styles.monogram, {
          backgroundColor: `${iconColor}1A`,
          borderColor: `${iconColor}30`,
        }]}>
          <Text style={[styles.monogramText, { color: iconColor }]}>
            {store.name.charAt(0)}
          </Text>
        </View>

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
        <Text style={styles.cardCategory}>{store.category}</Text>

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

  // ── Location / serviceability ─────────────────────────────────────────────────
  const { serviceability, status: locationStatus } = useLocation();
  // Treat as serviceable while still loading (avoids blocking UI unnecessarily)
  const isServiceable =
    locationStatus !== 'done' || serviceability?.serviceable !== false;
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
      const res = await getStores({ page: pageNum, category: categoryRef.current });

      if (replace) {
        setStores(res.data);
      } else {
        setStores(prev => [...prev, ...res.data]);
      }

      setTotalCount(res.pagination.total);
      hasNextRef.current = res.pagination.has_next;
      pageRef.current    = pageNum;
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load stores. Please try again.');
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // stable — reads from refs

  // Initial load + category-change refetch
  useEffect(() => {
    categoryRef.current = category;
    pageRef.current     = 1;
    hasNextRef.current  = false;
    fetchStores(1, true);
  }, [category]);

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

  const TOTAL_HEADER_H = insets.top + TITLE_BAR_H + EXPAND_H + SEARCH_H - 10;

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

  const wordmarkScale = scrollY.interpolate({
    inputRange: [0, EXPAND_H],
    outputRange: [1, 1.04],
    extrapolate: 'clamp',
  });

  // ── Sub-renders ───────────────────────────────────────────────────────────────

  const renderListHeader = () => (
    <View>
      {/* Non-serviceable banner — shown when serviceability check is done and area is unsupported */}
      {!isServiceable && locationStatus === 'done' && <NonServiceableBanner />}
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

      {/* ━━━ [1] Scrollable content ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Animated.FlatList
        data={stores}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            onPress={() => {
              if (!isServiceable) {
                setToastMsg(
                  "We\u2019re not in your area yet \u2014 we\u2019re expanding rapidly and will be available in your location very soon.",
                );
              } else {
                navigation.navigate('StoreDetail', { store: item });
              }
            }}
          />
        )}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={[styles.listContent, { paddingTop: TOTAL_HEADER_H }]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      />

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
              Delivering to{' '}
              <Text style={styles.locationBold}>Current Location</Text>
            </Text>
            <Ionicons name="chevron-down" size={13} color={TEXT_PRI} />
          </TouchableOpacity>
        </Animated.View>

        {/* Search bar — always visible, sticks below title bar when collapsed */}
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
      </Animated.View>

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
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={TEXT_PRI} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="bag-outline" size={20} color={TEXT_PRI} />
            </TouchableOpacity>
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
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
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
    // height: EXPAND_H-48,
    paddingHorizontal: 20,
    marginTop: 14,
    justifyContent: 'center',
    gap: 4,
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
    height: SEARCH_H+20,
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

  // ── Non-serviceable banner ───────────────────────────────────────────────────
  nsvcBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: 16,
    marginTop:        14,
    marginBottom:     4,
    backgroundColor:  '#FFFBEB',
    borderRadius:     14,
    padding:          14,
    gap:              12,
    borderWidth:      1.5,
    borderColor:      '#FDE68A',
  },
  nsvcIconWrap: {
    width:            42,
    height:           42,
    borderRadius:     12,
    backgroundColor:  '#FEF3C7',
    alignItems:       'center',
    justifyContent:   'center',
    flexShrink:       0,
  },
  nsvcTextBlock: {
    flex: 1,
  },
  nsvcTitle: {
    fontSize:     14,
    fontWeight:   '700',
    color:        '#78350F',
    marginBottom: 2,
  },
  nsvcSubtitle: {
    fontSize:   12,
    color:      '#92400E',
    lineHeight: 17,
    fontWeight: '500',
  },
});
