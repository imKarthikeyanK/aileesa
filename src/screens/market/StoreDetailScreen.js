/**
 * StoreDetailScreen — Market L2
 *
 * Features
 *   ├─ Parallax hero  (ScrollView + Animated.event, useNativeDriver)
 *   │    scale-stretch on overscroll (iOS); translateY parallax on scroll down
 *   ├─ Animated mini-header  (store name fades in once hero exits viewport)
 *   ├─ Floating back + favourite buttons  (absolute, always visible)
 *   ├─ Info card  (name, address, rating, stat pills, Call / Share CTAs)
 *   ├─ Horizontal scrollable category tab strip  (tap → smooth scroll-to-section)
 *   └─ Sectioned product list with Zomato-style divider headers
 *        product card: icon swatch | name · unit · price (MRP strikethrough) | View btn
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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

import { getStoreDetail } from '../../api/storeApi';
import { getInventories }  from '../../api/inventoryApi';
import { useCart }          from '../../context/CartContext';
import { useLocation }      from '../../context/LocationContext';
import { useAddress }       from '../../context/AddressContext';
import CartFloatingCard     from '../../components/CartFloatingCard';
import Toast                from '../../components/Toast';
import { useTabBar }        from '../../context/TabBarContext';

const { width: SW } = Dimensions.get('window');

// ─── Design Tokens (mirrors StoreListingScreen) ────────────────────────────────

const ACCENT       = '#6200EE';
const ACCENT_LIGHT = '#EDE7F6';
const WHITE        = '#FFFFFF';
const BG           = '#F7F7FB';
const TEXT_PRI     = '#1A1A2E';
const TEXT_SEC     = '#64748B';
const TEXT_MUTED   = '#9CA3AF';
const AMBER        = '#F59E0B';
const BORDER       = '#EDECF5';
const SUCCESS      = '#10B981';

// ─── Layout ────────────────────────────────────────────────────────────────────

const HERO_H      = 280;
const CARD_OVERLAP = 32;
const PLP_RELOAD_COOLDOWN_MS = 30000;

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Normalise image field to a URI string (handles string, array, or null)
function _imageUri(v) {
  if (!v) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return v.find(x => typeof x === 'string' && x) ?? null;
  return null;
}

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, value, label }) {
  return (
    <View style={styles.statPill}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={14} color={ACCENT} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── QuantityControl ──────────────────────────────────────────────────────────

function QuantityControl({ quantity, onAdd, onRemove, maxReached }) {
  return (
    <View style={styles.qtyControl}>
      <TouchableOpacity style={styles.qtyBtn} onPress={onRemove} activeOpacity={0.8}>
        <Ionicons name="remove" size={15} color={WHITE} />
      </TouchableOpacity>
      <Text style={styles.qtyCount}>{quantity}</Text>
      <TouchableOpacity
        style={[styles.qtyBtn, maxReached && styles.qtyBtnDisabled]}
        onPress={onAdd}
        activeOpacity={0.8}
        disabled={maxReached}
      >
        <Ionicons name="add" size={15} color={maxReached ? 'rgba(255,255,255,0.4)' : WHITE} />
      </TouchableOpacity>
    </View>
  );
}

// ─── InventoryCard ─────────────────────────────────────────────────────────────

function InventoryCard({ item, storeId, storeName, businessId, storeClosed, deliveryTime }) {
  const { addItem, removeItem, getItemQuantity } = useCart();
  const quantity   = getItemQuantity(item.id, storeId);
  const maxReached = item.max_quantity_per_item
    ? quantity >= item.max_quantity_per_item
    : false;

  const discount =
    item.base_price && item.base_price > item.price
      ? Math.round((1 - item.price / item.base_price) * 100)
      : 0;

  const isNew      = item.badge === 'New' || item.badge === 'Fresh';
  const badgeBg    = isNew ? '#E8F5E9' : ACCENT_LIGHT;
  const badgeColor = isNew ? SUCCESS    : ACCENT;

  const handleAdd = useCallback(() => {
    addItem({
      id:                    item.id,
      variant_id:            item.variant_id,
      product_id:            item.product_id,
      sku_code:              item.sku_code,
      name:                  item.name,
      unit:                  item.unit,
      price:                 item.price,
      base_price:            item.base_price,
      icon:                  item.icon,
      icon_bg:               item.icon_bg,
      icon_color:            item.icon_color,
      image_url:             _imageUri(item.image_url) ?? (_isUrl(item.icon) ? item.icon : null),
      storeId,
      storeName,
      business_id:           businessId,
      delivery_time:         deliveryTime,
      multi_add:             item.multi_add,
      max_quantity_per_item: item.max_quantity_per_item,
    });
  }, [item, storeId, storeName, businessId, deliveryTime, addItem]);

  const handleRemove = useCallback(() => {
    removeItem(item.id, storeId);
  }, [item.id, storeId, removeItem]);

  // When the store is closed every card is treated as non-interactive
  const cardInactive = !item.active || storeClosed;

  // Real API stores the image URL in `icon` (a CDN URL); `image_url` is absent.
  // Prefer image_url → icon-as-URL → fall back to icon name for Ionicons.
  const _isUrl = v => typeof v === 'string' && v.startsWith('http');
  const itemImageUri = _imageUri(item.image_url) ?? (_isUrl(item.icon) ? item.icon : null);
  const itemIconName = !_isUrl(item.icon) ? (item.icon || 'cube-outline') : 'cube-outline';
  const itemIconBg   = item.icon_bg   || '#F0F1F8';
  const itemIconClr  = item.icon_color || (cardInactive ? TEXT_MUTED : ACCENT);

  return (
    <View style={[styles.productCard, cardInactive && styles.productCardInactive]}>
      {/* Icon swatch */}
      <View style={[styles.swatch, { backgroundColor: itemIconBg }]}>
        {itemImageUri
          ? <Image source={{ uri: itemImageUri }} style={styles.swatchImage} resizeMode="cover" />
          : <Ionicons
              name={itemIconName}
              size={28}
              color={itemIconClr}
            />
        }
        {item.badge && item.active && !storeClosed && (
          <View style={[styles.swatchBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.swatchBadgeText, { color: badgeColor }]}>
              {item.badge}
            </Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.productDetails}>
        <Text
          style={[styles.productName, cardInactive && styles.textInactive]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text style={[styles.productUnit, cardInactive && styles.textInactive]}>
          {item.unit}
        </Text>

        {item.active && !storeClosed ? (
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{item.price}</Text>
            {discount > 0 && (
              <Text style={styles.basePrice}>₹{item.base_price}</Text>
            )}
            {discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{discount}% off</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.unavailableText}>
            {storeClosed ? 'Store closed' : 'Out of stock'}
          </Text>
        )}
      </View>

      {/* Action */}
      <View style={styles.actionCol}>
        {storeClosed ? (
          // Store-level closed state — all items unorderable
          <View style={styles.closedChip}>
            <Ionicons name="time-outline" size={12} color="#92400E" />
            <Text style={styles.closedChipText}>Closed</Text>
          </View>
        ) : !item.active ? (
          <View style={styles.unavailableMark}>
            <Ionicons name="close-circle-outline" size={20} color={TEXT_MUTED} />
          </View>
        ) : quantity === 0 ? (
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>ADD</Text>
            <Ionicons name="add" size={13} color={ACCENT} />
          </TouchableOpacity>
        ) : item.multi_add ? (
          <QuantityControl
            quantity={quantity}
            onAdd={handleAdd}
            onRemove={handleRemove}
            maxReached={maxReached}
          />
        ) : (
          <TouchableOpacity style={styles.addedBtn} onPress={handleRemove} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={13} color={ACCENT} />
            <Text style={styles.addedBtnText}>ADDED</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── SectionBlock ──────────────────────────────────────────────────────────────

function SectionBlock({ section, storeId, storeName, businessId, storeClosed, deliveryTime, onLayout, isLast }) {
  return (
    <View onLayout={onLayout}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionRule} />
      </View>

      {section.items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <InventoryCard
            item={item}
            storeId={storeId}
            storeName={storeName}
            businessId={businessId}
            storeClosed={storeClosed}
            deliveryTime={deliveryTime}
          />
          {idx < section.items.length - 1 && <View style={styles.itemDivider} />}
        </React.Fragment>
      ))}

      {!isLast && <View style={styles.sectionGap} />}
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function StoreDetailScreen({ route, navigation }) {
  const { store: _store, storeId } = route.params ?? {};
  const routeStore = _store ?? { id: storeId, name: '' };
  const { selectedAddress } = useAddress();
  const { coords } = useLocation();
  const queryLatitude = selectedAddress?.lat ?? selectedAddress?.latitude ?? coords?.latitude ?? null;
  const queryLongitude = selectedAddress?.lng ?? selectedAddress?.longitude ?? coords?.longitude ?? null;

  // Refs so fetchInventory / useFocusEffect can read current coords without being
  // re-created every time the coords object reference changes in context.
  const queryLatRef = useRef(queryLatitude);
  const queryLngRef = useRef(queryLongitude);
  useEffect(() => {
    queryLatRef.current = queryLatitude;
    queryLngRef.current = queryLongitude;
  }, [queryLatitude, queryLongitude]);

  const insets     = useSafeAreaInsets();
  const scrollY    = useRef(new Animated.Value(0)).current;
  const scrollRef  = useRef(null);
  const sectionOffsets = useRef({});

  const [activeSection, setActiveSection] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback(msg => setToastMsg(msg), []);

  // ── Carousel ───────────────────────────────────────────────────────────────
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef(null);

  // ── Store detail (enriched by API) ────────────────────────────────────────
  const [storeDetail, setStoreDetail] = useState(routeStore);

  // ── Inventory ──────────────────────────────────────────────────────────────
  const [sections,    setSections]    = useState([]);
  const [invLoading,  setInvLoading]  = useState(false);
  const [invHasNext,  setInvHasNext]  = useState(false);

  const invPageRef      = useRef(1);
  const invHasNextRef   = useRef(false);
  const isLoadingInvRef = useRef(false);
  const lastHydratedAtRef = useRef(0);

  const fetchInventory = useCallback(async (pageNum) => {
    if (isLoadingInvRef.current) return;
    isLoadingInvRef.current = true;
    setInvLoading(true);
    try {
      const res = await getInventories({
        storeId: routeStore.id,
        page: pageNum,
        latitude: queryLatRef.current,
        longitude: queryLngRef.current,
      });
      // API wraps its own envelope: { status, data: { data: [...], pagination: {} } }
      // Support both the wrapped shape and a flat { data: [...], pagination: {} } shape.
      const envelope  = res.data && typeof res.data === 'object' && Array.isArray(res.data.data)
        ? res.data
        : res;
      const rawRows    = Array.isArray(envelope.data) ? envelope.data : [];
      const rows       = rawRows.map((s, i) => ({
        id:    s.id    ?? `section-${i}`,
        // Format snake_case names like "dairy_milk_curd" → "Dairy Milk Curd"
        title: s.title ?? (s.section
          ? s.section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          : `Section ${i + 1}`),
        items: Array.isArray(s.items) ? s.items : [],
      }));
      const pagination = envelope.pagination && typeof envelope.pagination === 'object' ? envelope.pagination : {};
      setSections(prev => pageNum === 1 ? rows : [...prev, ...rows]);
      invHasNextRef.current = pagination.has_next ?? false;
      invPageRef.current    = pageNum;
      setInvHasNext(pagination.has_next ?? false);
    } catch (e) {
      showToast('Could not load products. Please try again.');
    } finally {
      isLoadingInvRef.current = false;
      setInvLoading(false);
    }
  }, [routeStore.id]); // stable — reads coords from refs at call-time

  // ── Hide bottom tab bar while on this screen ──────────────────────────────
  const { hideTabBar } = useTabBar();
  useFocusEffect(useCallback(() => {
    hideTabBar();
    // No cleanup showTabBar() — StoreListingScreen restores it on re-focus.

    // Time-only cooldown: skip re-fetch if we loaded within the last 30 s.
    // Coords are intentionally NOT part of the key — if the address changes
    // while PLP is focused (rare), the ref will be current on the next call.
    if (Date.now() - lastHydratedAtRef.current < PLP_RELOAD_COOLDOWN_MS) {
      return;
    }
    lastHydratedAtRef.current = Date.now();

    // Refresh store detail — reads live coords from refs
    getStoreDetail(routeStore.id, {
      latitude: queryLatRef.current,
      longitude: queryLngRef.current,
    })
      .then(res => {
        const raw    = res.data ?? res;
        const detail = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
          ? raw.data
          : raw;
        setStoreDetail(detail);
      })
      .catch(() => {});

    // Reset and reload inventory from page 1
    invPageRef.current    = 1;
    invHasNextRef.current = false;
    isLoadingInvRef.current = false;
    setSections([]);
    setCarouselIndex(0);
    carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
    fetchInventory(1);
  }, [hideTabBar, routeStore.id, fetchInventory])); // stable — no coord deps

  // Scroll listener drives pagination
  const handleScrollListener = useCallback((event) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const nearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 320;
    if (nearBottom && invHasNextRef.current && !isLoadingInvRef.current) {
      fetchInventory(invPageRef.current + 1);
    }
  }, [fetchInventory]);

  // ── Normalise camel/snake variants from routeStore (L1) vs API detail ─────
  // cover_media: API returns [{ url: "...", type: "image" }] — extract all .url values for carousel.
  // Fallback chain: cover_media → cover_url → banner_url → image_url
  const _extractAllUrls = v => {
    if (!v) return [];
    if (typeof v === 'string' && v) return [v];
    if (Array.isArray(v)) {
      return v.flatMap(item => {
        if (typeof item === 'string' && item) return [item];
        if (item && typeof item === 'object' && typeof item.url === 'string' && item.url) return [item.url];
        return [];
      });
    }
    if (typeof v === 'object' && typeof v.url === 'string' && v.url) return [v.url];
    return [];
  };
  const _extractUrl = v => _extractAllUrls(v)[0] ?? null;

  const coverUrls = (() => {
    const urls = _extractAllUrls(storeDetail.cover_media);
    if (urls.length > 0) return urls;
    const single = _extractUrl(storeDetail.cover_url)
      ?? _extractUrl(storeDetail.banner_url)
      ?? _extractUrl(storeDetail.image_url);
    return single ? [single] : [];
  })();

  // Auto-scroll carousel right-to-left every second; restarts if image count changes
  useEffect(() => {
    setCarouselIndex(0);
    carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
    if (coverUrls.length <= 1) return;
    const id = setInterval(() => {
      setCarouselIndex(prev => {
        const next = (prev + 1) % coverUrls.length;
        carouselRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [coverUrls.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Use || (not ??) so empty strings '' fall through to the defaults
  const coverBg      = storeDetail.cover_bg     || storeDetail.coverBg    || '#F0F1F8';
  const iconColor    = storeDetail.icon_color   || storeDetail.iconColor   || '#6200EE';
  const tagColor     = storeDetail.tag_color    || storeDetail.tagColor    || '#6200EE';
  const reviewCount  = storeDetail.review_count  ?? storeDetail.reviewCount  ?? 0;
  const deliveryTime =
    storeDetail.delivery_time ??
    storeDetail.deliveryTime ??
    routeStore.delivery_time ??
    routeStore.deliveryTime;

  // categories is an array from the API; fall back to the legacy category string
  const categoryLabel = (() => {
    const arr = storeDetail.categories;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map(c => String(c).trim()).filter(Boolean).join(' · ');
    }
    return storeDetail.category ?? '';
  })();

  // Cart count for this store (drives bottom padding)
  const { items } = useCart();
  const storeCartCount = items
    .filter(i => i.storeId === routeStore.id)
    .reduce((s, i) => s + i.quantity, 0);

  // ── Animations ─────────────────────────────────────────────────────────────
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_H],
    outputRange: [0, HERO_H * 0.45],
    extrapolate: 'clamp',
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_H, 0],
    outputRange: [1.5, 1],
    extrapolate: 'clamp',
  });
  const miniHeaderOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 70, HERO_H - 10],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── Section navigation ─────────────────────────────────────────────────────
  const scrollToSection = useCallback((index) => {
    const y = sectionOffsets.current[index];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - insets.top - 64), animated: true });
    }
    setActiveSection(index);
  }, [insets.top]);

  // Derive store closed state — support both snake_case (API) and camelCase (route param)
  const isStoreClosed = storeDetail.is_open === false || storeDetail.isOpen === false;

  const cartBottomPad = storeCartCount > 0 && !isStoreClosed ? 96 : 48;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Animated mini-header */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.miniHeader,
          { paddingTop: insets.top, height: insets.top + 56, opacity: miniHeaderOpacity },
        ]}
      >
        <View style={styles.miniHeaderInner}>
          <Text style={styles.miniHeaderTitle} numberOfLines={1}>{storeDetail.name}</Text>
        </View>
      </Animated.View>

      {/* Floating back button */}
      <TouchableOpacity
        style={[styles.floatBtn, { top: insets.top + 10, left: 16 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={18} color={TEXT_PRI} />
      </TouchableOpacity>

      {/* Floating share button — top-right, above favourite */}
      <TouchableOpacity
        style={[styles.floatBtn, { top: insets.top + 10, right: 16 }]}
        activeOpacity={0.85}
      >
        <Ionicons name="share-social-outline" size={18} color={TEXT_PRI} />
      </TouchableOpacity>

      {/* Floating favourite button — below share */}
      <TouchableOpacity
        style={[styles.floatBtn, { top: insets.top + 60, right: 16 }]}
        activeOpacity={0.85}
      >
        <Ionicons name="heart-outline" size={18} color={TEXT_PRI} />
      </TouchableOpacity>

      {/* Scrollable body */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + cartBottomPad }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          // useNativeDriver for scroll-event-driven animations is not supported on web.
          { useNativeDriver: Platform.OS !== 'web', listener: handleScrollListener },
        )}
        scrollEventThrottle={16}
      >
        {/* Parallax hero */}
        <Animated.View
          style={[
            styles.hero,
            {
              backgroundColor: coverBg,
              transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
            },
          ]}
        >
          {/* Cover image carousel — scrolls right-to-left every second */}
          {coverUrls.length > 0 && (
            <FlatList
              ref={carouselRef}
              data={coverUrls}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              scrollEnabled={coverUrls.length > 1}
              showsHorizontalScrollIndicator={false}
              style={StyleSheet.absoluteFill}
              renderItem={({ item: url }) => (
                <Image source={{ uri: url }} style={{ width: SW, height: HERO_H }} resizeMode="cover" />
              )}
            />
          )}
          {/* Decorative fallback — hidden when real cover images are available */}
          {coverUrls.length === 0 && (
            <>
              <Ionicons
                name={storeDetail.icon}
                size={130}
                color={`${iconColor}10`}
                style={styles.heroBgIcon}
              />
              <View style={[
                styles.heroMonogram,
                { backgroundColor: `${iconColor}18`, borderColor: `${iconColor}35` },
              ]}>
                <Text style={[styles.heroMonogramText, { color: iconColor }]}>
                  {storeDetail.name.charAt(0)}
                </Text>
              </View>
            </>
          )}
          {storeDetail.tag && (
            <View style={[styles.heroTag, { backgroundColor: tagColor, marginBottom: 20 }]}>
              <Text style={styles.heroTagText}>{storeDetail.tag}</Text>
            </View>
          )}
        </Animated.View>

        {/* Info card (overlaps hero) */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <View style={styles.infoTitleBlock}>
              <Text style={styles.storeName} numberOfLines={1}>{storeDetail.name}</Text>
              <Text style={styles.storeMeta} numberOfLines={1} ellipsizeMode="tail">
                {categoryLabel}{categoryLabel ? ' · ' : ''}{reviewCount.toLocaleString()} reviews
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color={AMBER} />
              <Text style={styles.ratingText}>{storeDetail.rating}</Text>
            </View>
          </View>

          {storeDetail.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={ACCENT} />
              <Text style={styles.addressText} numberOfLines={2}>{storeDetail.address}</Text>
            </View>
          ) : null}

          <View style={[styles.infoDivider, { marginTop: 0 }]} />

          <View style={styles.statsRow}>
            <StatPill icon="time-outline"     value={deliveryTime}         label="Delivery" />
            <View style={styles.statSep} />
            <StatPill icon="location-outline" value={storeDetail.distance} label="Distance" />
            <View style={styles.statSep} />
            <StatPill icon="bicycle-outline"  value="Free"                 label="Delivery fee" />
          </View>

          {storeDetail.timing && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.timingRow}>
                <Ionicons name="time-outline" size={13} color={TEXT_MUTED} />
                <Text style={styles.timingText}>
                  Open: <Text style={styles.timingBold}>{storeDetail.timing}</Text>
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Category tab strip */}
        {sections.length > 0 && (
          <View style={styles.tabWrapper}>
            <FlatList
              horizontal
              data={sections}
              keyExtractor={s => s.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabStrip}
              renderItem={({ item: sec, index }) => (
                <TouchableOpacity
                  style={[styles.tab, activeSection === index && styles.tabActive]}
                  onPress={() => scrollToSection(index)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tabLabel, activeSection === index && styles.tabLabelActive]}>
                    {sec.title}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Initial inventory loading */}
        {invLoading && sections.length === 0 && (
          <View style={styles.inventoryLoader}>
            <ActivityIndicator size="small" color={ACCENT} />
            <Text style={styles.inventoryLoadingText}>Loading products…</Text>
          </View>
        )}

        {/* Sectioned inventory */}
        {/* Closed store banner — sits between the info card and product list */}
        {isStoreClosed && (
          <View style={styles.storeClosedBanner}>
            <View style={styles.storeClosedIconWrap}>
              <Ionicons name="time-outline" size={20} color="#92400E" />
            </View>
            <View style={styles.storeClosedTextBlock}>
              <Text style={styles.storeClosedTitle}>Store is currently closed</Text>
              <Text style={styles.storeClosedSubtitle}>
                You can browse items but cannot place orders right now.
              </Text>
            </View>
          </View>
        )}

        {sections.map((section, sIdx) => (
          <SectionBlock
            key={section.id}
            section={section}
            storeId={routeStore.id}
            storeName={storeDetail.name}
            businessId={storeDetail.business_id}
            storeClosed={isStoreClosed}
            deliveryTime={deliveryTime}
            isLast={sIdx === sections.length - 1 && !invHasNext}
            onLayout={e => { sectionOffsets.current[sIdx] = e.nativeEvent.layout.y; }}
          />
        ))}

        {/* Load more spinner */}
        {invLoading && sections.length > 0 && (
          <View style={styles.loadMoreLoader}>
            <ActivityIndicator size="small" color={ACCENT} />
          </View>
        )}

        {/* Empty inventory */}
        {!invLoading && sections.length === 0 && (
          <View style={styles.emptyInventory}>
            <Ionicons name="cube-outline" size={40} color={BORDER} />
            <Text style={styles.emptyInventoryText}>No products available</Text>
          </View>
        )}
      </Animated.ScrollView>

      {/* Cart floating card — hidden when store is closed */}
      {!isStoreClosed && (
        <CartFloatingCard
          storeId={routeStore.id}
          onPress={() => navigation.navigate('Cart')}
          bottomInset={insets.bottom}
        />
      )}

      {/* Toast */}
      <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Mini-header ─────────────────────────────────────────────────────────────
  miniHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: WHITE,
    zIndex: 20,
    elevation: 6,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  miniHeaderInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRI,
    letterSpacing: -0.3,
  },

  // ── Floating buttons ────────────────────────────────────────────────────────
  floatBtn: {
    position: 'absolute',
    zIndex: 20,
    elevation: 6,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },

  // ── ScrollView ──────────────────────────────────────────────────────────────
  scroll: { flex: 1 },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    height: HERO_H,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroBgIcon: {
    position: 'absolute',
  },
  heroMonogram: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMonogramText: {
    fontSize: 38,
    fontWeight: '900',
  },
  heroTag: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.3,
  },
  heroRating: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heroRatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },

  // ── Info card ───────────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -CARD_OVERLAP,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    // subtle shadow on top edge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoTitleBlock: {
    flex: 1,
    marginRight: 12,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_PRI,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  storeMeta: {
    fontSize: 13,
    color: TEXT_SEC,
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginBottom: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SEC,
    fontWeight: '500',
    lineHeight: 19,
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRI,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '500',
    textAlign: 'center',
  },
  statSep: {
    width: 1,
    height: 44,
    backgroundColor: BORDER,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 13,
  },
  callBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: WHITE,
  },

  // ── Category tab strip ──────────────────────────────────────────────────────
  tabWrapper: {
    backgroundColor: WHITE,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  tabStrip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SEC,
  },
  tabLabelActive: {
    color: WHITE,
  },

  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 4,
    gap: 12,
    backgroundColor: WHITE,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRI,
    letterSpacing: -0.2,
  },
  sectionRule: {
    flex: 1,
    height: 1.5,
    backgroundColor: BORDER,
  },

  // ── Product card (horizontal) ───────────────────────────────────────────────
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  productCardInactive: {
    opacity: 0.5,
  },
  swatch: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
    overflow: 'hidden',
  },
  swatchImage: {
    width: 72,
    height: 72,
  },
  swatchBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: WHITE,
  },
  swatchBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  productDetails: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRI,
    lineHeight: 20,
    marginBottom: 2,
  },
  productUnit: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '500',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRI,
  },
  basePrice: {
    fontSize: 12,
    color: TEXT_MUTED,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '800',
    color: SUCCESS,
  },
  unavailableText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '500',
    marginTop: 5,
    fontStyle: 'italic',
  },
  textInactive: {
    color: TEXT_MUTED,
  },

  // ── Action column ─────────────────────────────────────────────────────────
  actionCol: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 80,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 72,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.5,
  },
  addedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 72,
  },
  addedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.5,
  },
  unavailableMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
  },

  // ── Store-closed chip (replaces ADD button when store is closed) ──────────
  closedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    justifyContent: 'center',
  },
  closedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.2,
  },

  // ── Store-closed banner (above inventory list) ────────────────────────────
  storeClosedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  storeClosedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  storeClosedTextBlock: {
    flex: 1,
  },
  storeClosedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  storeClosedSubtitle: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '500',
    lineHeight: 17,
  },

  // ── Quantity stepper ─────────────────────────────────────────────────────
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 80,
  },
  qtyBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyCount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: WHITE,
  },

  // ── Timing row ────────────────────────────────────────────────────────────
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timingText: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  timingBold: {
    color: TEXT_PRI,
    fontWeight: '700',
  },

  // ── Inventory loading / empty ─────────────────────────────────────────────
  inventoryLoader: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  inventoryLoadingText: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  loadMoreLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyInventory: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyInventoryText: {
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: '500',
  },

  // ── Dividers ─────────────────────────────────────────────────────────────
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
  sectionGap: {
    height: 8,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderColor: BORDER,
  },
});

