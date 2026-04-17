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

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

// ─── Store Addresses ───────────────────────────────────────────────────────────

const STORE_ADDRESS = {
  '1': '12, MG Road, Koramangala, Bangalore',
  '2': '7, Residency Road, Shivajinagar, Bangalore',
  '3': '3, Brigade Road, Commercial Street, Bangalore',
  '4': '41, Indiranagar 100ft Road, Bangalore',
  '5': '8, UB City Mall, Vittal Mallya Rd, Bangalore',
  '6': '22, HSR Layout 5th Sector, Bangalore',
  '7': '14, Jayanagar 4th Block, Bangalore',
  '8': '6, Bannerghatta Road, JP Nagar, Bangalore',
};

// ─── Product Catalogue ────────────────────────────────────────────────────────

const CATALOGUE = {
  Grocery: [
    {
      id: 'gr-pop', title: 'Popular',
      items: [
        { id: 'g1', name: 'Organic Bananas', unit: '6 pcs', price: 49, mrp: 60, icon: 'nutrition', iconBg: '#E8F5E9', iconColor: '#2E7D32', badge: 'Top Pick' },
        { id: 'g2', name: 'Farm Fresh Eggs', unit: 'Dozen', price: 89, mrp: 99, icon: 'egg-outline', iconBg: '#FFF8E1', iconColor: '#F57F17', badge: null },
        { id: 'g3', name: 'Amul Butter', unit: '500 g', price: 270, mrp: 280, icon: 'cube-outline', iconBg: '#E3F2FD', iconColor: '#1565C0', badge: null },
      ],
    },
    {
      id: 'gr-new', title: 'New Arrivals',
      items: [
        { id: 'g4', name: 'Hass Avocado', unit: '2 pcs', price: 120, mrp: 140, icon: 'leaf', iconBg: '#E8F5E9', iconColor: '#2E7D32', badge: 'New' },
        { id: 'g5', name: 'Quinoa Seeds', unit: '500 g', price: 210, mrp: 240, icon: 'flower-outline', iconBg: '#F3E5F5', iconColor: '#7B1FA2', badge: 'New' },
      ],
    },
    {
      id: 'gr-fruits', title: 'Fruits & Veggies',
      items: [
        { id: 'g6', name: 'Red Apples', unit: '1 kg', price: 159, mrp: 180, icon: 'nutrition', iconBg: '#FCE4EC', iconColor: '#C62828', badge: null },
        { id: 'g7', name: 'Baby Spinach', unit: '250 g', price: 45, mrp: 55, icon: 'leaf-outline', iconBg: '#E8F5E9', iconColor: '#388E3C', badge: null },
        { id: 'g8', name: 'Cherry Tomatoes', unit: '300 g', price: 65, mrp: 70, icon: 'ellipse-outline', iconBg: '#FCE4EC', iconColor: '#B71C1C', badge: null },
      ],
    },
  ],
  Bakery: [
    {
      id: 'bk-pop', title: 'Popular',
      items: [
        { id: 'b1', name: 'Sourdough Loaf', unit: '400 g', price: 120, mrp: 140, icon: 'cafe', iconBg: '#FFF8E1', iconColor: '#E65100', badge: 'Top Pick' },
        { id: 'b2', name: 'Butter Croissant', unit: '2 pcs', price: 80, mrp: 90, icon: 'cafe-outline', iconBg: '#FFF8E1', iconColor: '#BF360C', badge: null },
        { id: 'b3', name: 'Cinnamon Roll', unit: '1 pc', price: 65, mrp: 75, icon: 'radio-button-off', iconBg: '#FBE9E7', iconColor: '#BF360C', badge: null },
      ],
    },
    {
      id: 'bk-fresh', title: 'Fresh Today',
      items: [
        { id: 'b4', name: 'Blueberry Muffin', unit: '2 pcs', price: 110, mrp: 120, icon: 'ellipse', iconBg: '#EDE7F6', iconColor: '#4527A0', badge: 'Fresh' },
        { id: 'b5', name: 'Banana Bread', unit: '300 g', price: 95, mrp: 110, icon: 'nutrition-outline', iconBg: '#FFF8E1', iconColor: '#F9A825', badge: 'New' },
      ],
    },
    {
      id: 'bk-cakes', title: 'Cakes & Pastries',
      items: [
        { id: 'b6', name: 'Chocolate Truffle', unit: '1 slice', price: 130, mrp: 150, icon: 'heart', iconBg: '#FCE4EC', iconColor: '#C62828', badge: null },
        { id: 'b7', name: 'Tiramisu Cup', unit: '1 pc', price: 160, mrp: 180, icon: 'snow-outline', iconBg: '#E8EAF6', iconColor: '#283593', badge: null },
      ],
    },
  ],
  Pharmacy: [
    {
      id: 'ph-pop', title: 'Popular',
      items: [
        { id: 'ph1', name: 'Vitamin C 1000mg', unit: '30 tabs', price: 189, mrp: 220, icon: 'medical', iconBg: '#E3F2FD', iconColor: '#1565C0', badge: 'Top Pick' },
        { id: 'ph2', name: 'Hand Sanitizer', unit: '200 ml', price: 79, mrp: 99, icon: 'water', iconBg: '#E0F7FA', iconColor: '#00838F', badge: null },
        { id: 'ph3', name: 'Paracetamol 500', unit: 'Strip of 10', price: 22, mrp: 25, icon: 'medkit', iconBg: '#E3F2FD', iconColor: '#1565C0', badge: null },
      ],
    },
    {
      id: 'ph-new', title: 'New Arrivals',
      items: [
        { id: 'ph4', name: 'Omega-3 Fish Oil', unit: '60 caps', price: 349, mrp: 399, icon: 'fish', iconBg: '#E0F7FA', iconColor: '#006064', badge: 'New' },
        { id: 'ph5', name: 'Collagen Gummies', unit: '30 pcs', price: 499, mrp: 549, icon: 'star', iconBg: '#FFF8E1', iconColor: '#F9A825', badge: 'New' },
      ],
    },
    {
      id: 'ph-skin', title: 'Skincare',
      items: [
        { id: 'ph6', name: 'Sunscreen SPF 50', unit: '100 ml', price: 280, mrp: 320, icon: 'sunny', iconBg: '#FFF9C4', iconColor: '#F9A825', badge: null },
        { id: 'ph7', name: 'Daily Moisturizer', unit: '75 ml', price: 199, mrp: 230, icon: 'water-outline', iconBg: '#E3F2FD', iconColor: '#1565C0', badge: null },
      ],
    },
  ],
  Electronics: [
    {
      id: 'el-pop', title: 'Popular',
      items: [
        { id: 'e1', name: 'USB-C Cable 2 m', unit: '1 pc', price: 299, mrp: 399, icon: 'hardware-chip', iconBg: '#F3E5F5', iconColor: '#6A1B9A', badge: 'Top Pick' },
        { id: 'e2', name: 'Wireless Earbuds', unit: '1 pair', price: 1299, mrp: 1599, icon: 'headset', iconBg: '#EDE7F6', iconColor: '#4527A0', badge: null },
        { id: 'e3', name: '20 W Fast Charger', unit: '1 pc', price: 649, mrp: 799, icon: 'flash', iconBg: '#FFF8E1', iconColor: '#F9A825', badge: null },
      ],
    },
    {
      id: 'el-new', title: 'New Arrivals',
      items: [
        { id: 'e4', name: 'Smart Watch Band', unit: '1 pc', price: 499, mrp: 599, icon: 'watch', iconBg: '#F3E5F5', iconColor: '#6A1B9A', badge: 'New' },
        { id: 'e5', name: 'Screen Protector', unit: '2 pcs', price: 249, mrp: 299, icon: 'phone-portrait', iconBg: '#E8EAF6', iconColor: '#283593', badge: 'New' },
      ],
    },
    {
      id: 'el-acc', title: 'Accessories',
      items: [
        { id: 'e6', name: 'Laptop Stand', unit: '1 pc', price: 799, mrp: 999, icon: 'desktop', iconBg: '#EDE7F6', iconColor: '#4527A0', badge: null },
        { id: 'e7', name: 'XL Mouse Pad', unit: '1 pc', price: 349, mrp: 449, icon: 'game-controller', iconBg: '#F3E5F5', iconColor: '#6A1B9A', badge: null },
      ],
    },
  ],
  Fashion: [
    {
      id: 'fa-pop', title: 'Popular',
      items: [
        { id: 'f1', name: 'Classic White Tee', unit: 'S / M / L / XL', price: 499, mrp: 699, icon: 'shirt', iconBg: '#FCE4EC', iconColor: '#AD1457', badge: 'Top Pick' },
        { id: 'f2', name: 'Slim Chinos', unit: '30–36 in', price: 1299, mrp: 1799, icon: 'person-outline', iconBg: '#EDE7F6', iconColor: '#4527A0', badge: null },
        { id: 'f3', name: 'Canvas Sneakers', unit: '6–11 UK', price: 1499, mrp: 1999, icon: 'walk-outline', iconBg: '#FFF8E1', iconColor: '#F9A825', badge: null },
      ],
    },
    {
      id: 'fa-new', title: 'New Arrivals',
      items: [
        { id: 'f4', name: 'Linen Kurta', unit: 'S / M / L / XL', price: 799, mrp: 999, icon: 'shirt-outline', iconBg: '#E8F5E9', iconColor: '#2E7D32', badge: 'New' },
        { id: 'f5', name: 'Sling Bag', unit: '1 pc', price: 899, mrp: 1199, icon: 'bag', iconBg: '#FCE4EC', iconColor: '#AD1457', badge: 'New' },
      ],
    },
    {
      id: 'fa-acc', title: 'Accessories',
      items: [
        { id: 'f6', name: 'Leather Belt', unit: 'S / M / L', price: 599, mrp: 799, icon: 'ellipse', iconBg: '#FBE9E7', iconColor: '#BF360C', badge: null },
        { id: 'f7', name: 'Aviator Sunglasses', unit: '1 pc', price: 699, mrp: 999, icon: 'eye-outline', iconBg: '#E8EAF6', iconColor: '#283593', badge: null },
      ],
    },
  ],
  Wellness: [
    {
      id: 'wl-pop', title: 'Popular',
      items: [
        { id: 'w1', name: 'Ashwagandha 500mg', unit: '60 caps', price: 349, mrp: 399, icon: 'flower', iconBg: '#F1F8E9', iconColor: '#558B2F', badge: 'Top Pick' },
        { id: 'w2', name: 'Moringa Powder', unit: '200 g', price: 259, mrp: 299, icon: 'leaf', iconBg: '#E8F5E9', iconColor: '#2E7D32', badge: null },
        { id: 'w3', name: 'Immunity Shots', unit: '6 pcs', price: 180, mrp: 210, icon: 'flash', iconBg: '#FFF9C4', iconColor: '#F9A825', badge: null },
      ],
    },
    {
      id: 'wl-new', title: 'New Arrivals',
      items: [
        { id: 'w4', name: 'Collagen Serum', unit: '30 ml', price: 799, mrp: 949, icon: 'sparkles', iconBg: '#EDE7F6', iconColor: '#6A1B9A', badge: 'New' },
        { id: 'w5', name: 'Magnesium Spray', unit: '100 ml', price: 549, mrp: 649, icon: 'water', iconBg: '#E0F7FA', iconColor: '#00838F', badge: 'New' },
      ],
    },
    {
      id: 'wl-yoga', title: 'Yoga & Fitness',
      items: [
        { id: 'w6', name: 'Premium Yoga Mat', unit: '6 mm', price: 899, mrp: 1099, icon: 'fitness', iconBg: '#F1F8E9', iconColor: '#558B2F', badge: null },
        { id: 'w7', name: 'Resistance Bands', unit: 'Set of 3', price: 399, mrp: 499, icon: 'barbell-outline', iconBg: '#EDE7F6', iconColor: '#4527A0', badge: null },
      ],
    },
  ],
  'Pet Supplies': [
    {
      id: 'pt-pop', title: 'Popular',
      items: [
        { id: 'pt1', name: 'Royal Canin Dog Food', unit: '2 kg', price: 899, mrp: 999, icon: 'paw', iconBg: '#FFF3E0', iconColor: '#E65100', badge: 'Top Pick' },
        { id: 'pt2', name: 'Cat Litter Crystal', unit: '4 kg', price: 649, mrp: 749, icon: 'star-outline', iconBg: '#F3E5F5', iconColor: '#6A1B9A', badge: null },
        { id: 'pt3', name: 'Pet Shampoo', unit: '200 ml', price: 249, mrp: 299, icon: 'water', iconBg: '#E0F7FA', iconColor: '#006064', badge: null },
      ],
    },
    {
      id: 'pt-new', title: 'New Arrivals',
      items: [
        { id: 'pt4', name: 'Interactive Toy', unit: '1 pc', price: 349, mrp: 449, icon: 'game-controller', iconBg: '#FCE4EC', iconColor: '#AD1457', badge: 'New' },
        { id: 'pt5', name: 'GPS Pet Collar', unit: '1 pc', price: 1499, mrp: 1799, icon: 'locate', iconBg: '#EDE7F6', iconColor: '#4527A0', badge: 'New' },
      ],
    },
    {
      id: 'pt-health', title: 'Health & Care',
      items: [
        { id: 'pt6', name: 'Flea Treatment', unit: '3 doses', price: 549, mrp: 649, icon: 'shield', iconBg: '#E8F5E9', iconColor: '#2E7D32', badge: null },
        { id: 'pt7', name: 'Dental Chews', unit: '15 pcs', price: 299, mrp: 349, icon: 'happy', iconBg: '#FFF8E1', iconColor: '#F9A825', badge: null },
      ],
    },
  ],
};


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

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ product }) {
  const isNew = product.badge === 'New' || product.badge === 'Fresh';
  const badgeBg    = isNew ? '#E8F5E9' : ACCENT_LIGHT;
  const badgeColor = isNew ? SUCCESS    : ACCENT;

  const discount = product.mrp > product.price
    ? Math.round((1 - product.price / product.mrp) * 100)
    : 0;

  return (
    <View style={styles.productCard}>
      {/* Icon swatch */}
      <View style={[styles.swatch, { backgroundColor: product.iconBg }]}>
        <Ionicons name={product.icon} size={28} color={product.iconColor} />
        {product.badge && (
          <View style={[styles.swatchBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.swatchBadgeText, { color: badgeColor }]}>
              {product.badge}
            </Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.productDetails}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productUnit}>{product.unit}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {discount > 0 && (
            <Text style={styles.mrp}>₹{product.mrp}</Text>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% off</Text>
            </View>
          )}
        </View>
      </View>

      {/* View button */}
      <TouchableOpacity style={styles.viewBtn} activeOpacity={0.8}>
        <Text style={styles.viewBtnText}>View</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function StoreDetailScreen({ route, navigation }) {
  const { store }    = route.params;
  const insets       = useSafeAreaInsets();
  const scrollY      = useRef(new Animated.Value(0)).current;
  const scrollRef    = useRef(null);
  const sectionOffsets = useRef({});
  const [activeSection, setActiveSection] = useState(0);

  const sections = CATALOGUE[store.category] ?? CATALOGUE.Grocery;
  const address  = STORE_ADDRESS[store.id] ?? '123, Local Market, Bangalore';

  // ── Animations (useNativeDriver: true throughout) ──────────────────────────

  // Parallax: hero scrolls at ~55% of scroll speed  (positive translateY counters upward scroll)
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_H],
    outputRange: [0, HERO_H * 0.45],
    extrapolate: 'clamp',
  });

  // Stretch on overscroll (iOS bounce pull-down, scrollY < 0)
  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_H, 0],
    outputRange: [1.5, 1],
    extrapolate: 'clamp',
  });

  // Mini-header fades in once hero slides mostly out of view
  const miniHeaderOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 70, HERO_H - 10],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── Section navigation ─────────────────────────────────────────────────────

  const scrollToSection = (index) => {
    const y = sectionOffsets.current[index];
    if (y != null && scrollRef.current) {
      // offset by insets.top + mini-header height so section header stays visible
      scrollRef.current.scrollTo({ y: Math.max(0, y - insets.top - 64), animated: true });
    }
    setActiveSection(index);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* ━━━ Animated mini-header (fades in on scroll) ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.miniHeader,
          { paddingTop: insets.top, height: insets.top + 56, opacity: miniHeaderOpacity },
        ]}
      >
        <View style={styles.miniHeaderInner}>
          <Text style={styles.miniHeaderTitle} numberOfLines={1}>{store.name}</Text>
        </View>
      </Animated.View>

      {/* ━━━ Floating back button ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <TouchableOpacity
        style={[styles.floatBtn, { top: insets.top + 10, left: 16 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={18} color={TEXT_PRI} />
      </TouchableOpacity>

      {/* ━━━ Floating favourite button ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <TouchableOpacity
        style={[styles.floatBtn, { top: insets.top + 10, right: 16 }]}
        activeOpacity={0.85}
      >
        <Ionicons name="heart-outline" size={18} color={TEXT_PRI} />
      </TouchableOpacity>

      {/* ━━━ Scrollable body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Parallax hero ─────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.hero,
            {
              backgroundColor: store.coverBg,
              transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
            },
          ]}
        >
          {/* Large icon wash */}
          <Ionicons
            name={store.icon}
            size={130}
            color={`${store.iconColor}10`}
            style={styles.heroBgIcon}
          />
          {/* Store initial monogram */}
          <View style={[
            styles.heroMonogram,
            { backgroundColor: `${store.iconColor}18`, borderColor: `${store.iconColor}35` },
          ]}>
            <Text style={[styles.heroMonogramText, { color: store.iconColor }]}>
              {store.name.charAt(0)}
            </Text>
          </View>
          {/* Status tag */}
          {store.tag && (
            <View style={[styles.heroTag, { backgroundColor: store.tagColor }]}>
              <Text style={styles.heroTagText}>{store.tag}</Text>
            </View>
          )}
          {/* Rating chip */}
          <View style={styles.heroRating}>
            <Ionicons name="star" size={11} color={AMBER} />
            <Text style={styles.heroRatingText}>{store.rating}</Text>
          </View>
        </Animated.View>

        {/* ── Info card (overlaps hero) ──────────────────────────────────── */}
        <View style={styles.infoCard}>
          {/* Name + category row */}
          <View style={styles.infoTitleRow}>
            <View style={styles.infoTitleBlock}>
              <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
              <Text style={styles.storeMeta}>
                {store.category} · {store.reviewCount.toLocaleString()} reviews
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color={AMBER} />
              <Text style={styles.ratingText}>{store.rating}</Text>
            </View>
          </View>

          {/* Address */}
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={ACCENT} />
            <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
          </View>

          <View style={styles.infoDivider} />

          {/* Stat pills */}
          <View style={styles.statsRow}>
            <StatPill icon="time-outline"     value={store.deliveryTime} label="Delivery" />
            <View style={styles.statSep} />
            <StatPill icon="location-outline" value={store.distance}    label="Distance" />
            <View style={styles.statSep} />
            <StatPill icon="bicycle-outline"  value="Free"              label="Delivery fee" />
          </View>

          <View style={styles.infoDivider} />

          {/* CTA row */}
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.callBtn} activeOpacity={0.85}>
              <Ionicons name="call-outline" size={16} color={ACCENT} />
              <Text style={styles.callBtnText}>Call Store</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={16} color={WHITE} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Category tab strip ────────────────────────────────────────── */}
        <View style={styles.tabWrapper}>
          <FlatList
            horizontal
            data={sections}
            keyExtractor={(s) => s.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabStrip}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.tab, activeSection === index && styles.tabActive]}
                onPress={() => scrollToSection(index)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabLabel, activeSection === index && styles.tabLabelActive]}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* ── Sectioned product list ────────────────────────────────────── */}
        {sections.map((section, sIdx) => (
          <View
            key={section.id}
            onLayout={(e) => { sectionOffsets.current[sIdx] = e.nativeEvent.layout.y; }}
          >
            {/* Section header with decorative rule */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionRule} />
            </View>

            {/* Product cards */}
            {section.items.map((item, itemIdx) => (
              <React.Fragment key={item.id}>
                <ProductCard product={item} />
                {itemIdx < section.items.length - 1 && (
                  <View style={styles.itemDivider} />
                )}
              </React.Fragment>
            ))}

            {/* Thick section gap (Zomato-style divider) */}
            {sIdx < sections.length - 1 && <View style={styles.sectionGap} />}
          </View>
        ))}
      </ScrollView>
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
  swatch: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
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
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRI,
  },
  mrp: {
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
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
    flexShrink: 0,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },

  // ── Dividers ────────────────────────────────────────────────────────────────
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 102, // aligns with text, skips swatch
  },
  sectionGap: {
    height: 8,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderColor: BORDER,
  },
});

