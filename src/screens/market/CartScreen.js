/**
 * CartScreen.js — Cart review and checkout page.
 *
 * Layout (Blinkit / Zepto inspired, Aileesa design tokens):
 *   ┌─ Header (back button + title) ─────────────────────┐
 *   │  Scrollable body:                                   │
 *   │    ├─ Store group(s) [name + delivery info]         │
 *   │    │    └─ Cart item rows [icon · name · qty · ₹]  │
 *   │    └─ Order summary card [subtotal → grand total]   │
 *   └─ Sticky CTA [Place Order  ₹XXX] ──────────────────┘
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useTabBar } from '../../context/TabBarContext';

// ─── Design Tokens ─────────────────────────────────────────────────────────────

const NAVY    = '#16172B';
const ACCENT  = '#6200EE';
const WHITE   = '#FFFFFF';
const BG      = '#F7F7FB';
const SURFACE = '#FFFFFF';
const TEXT_PRI  = '#1A1A2E';
const TEXT_SEC  = '#64748B';
const TEXT_MUTED = '#9CA3AF';
const BORDER  = '#EDECF5';
const SUCCESS = '#10B981';
const AMBER   = '#FBBF24';

const DELIVERY_FEE  = 30;
const PLATFORM_FEE  = 5;
const GST_RATE      = 0.05;

// ─── CartItemRow ───────────────────────────────────────────────────────────────

function CartItemRow({ item, onAdd, onRemove }) {
  const discount =
    item.base_price && item.base_price > item.price
      ? Math.round((1 - item.price / item.base_price) * 100)
      : 0;
  const lineTotal = item.price * item.quantity;

  return (
    <View style={styles.itemRow}>
      {/* Icon swatch */}
      <View style={[styles.itemSwatch, { backgroundColor: item.icon_bg ?? '#F0F1F8' }]}>
        <Ionicons
          name={item.icon ?? 'cube-outline'}
          size={22}
          color={item.icon_color ?? ACCENT}
        />
      </View>

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemUnit}>{item.unit}</Text>
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemPrice}>₹{item.price}</Text>
          {discount > 0 && (
            <Text style={styles.itemBasePrice}>₹{item.base_price}</Text>
          )}
          {discount > 0 && (
            <View style={styles.discountPill}>
              <Text style={styles.discountPillText}>{discount}% off</Text>
            </View>
          )}
        </View>
      </View>

      {/* Quantity + line total */}
      <View style={styles.itemRight}>
        <Text style={styles.lineTotal}>₹{lineTotal}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={onRemove} activeOpacity={0.8}>
            <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={14} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.qtyCount}>{item.quantity}</Text>
          <TouchableOpacity
            style={[
              styles.qtyBtn,
              item.quantity >= (item.max_quantity_per_item ?? 99) && styles.qtyBtnDisabled,
            ]}
            onPress={onAdd}
            activeOpacity={0.8}
            disabled={item.quantity >= (item.max_quantity_per_item ?? 99)}
          >
            <Ionicons name="add" size={14} color={WHITE} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── SummaryRow ────────────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold, accent, muted }) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          bold && styles.summaryLabelBold,
          muted && styles.summaryLabelMuted,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          bold && styles.summaryValueBold,
          accent && styles.summaryValueAccent,
          muted && styles.summaryValueMuted,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── EmptyCart ─────────────────────────────────────────────────────────────────

function EmptyCart({ navigation, insets }) {
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={SURFACE} />
      <View style={[styles.header, { paddingTop: 0 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="bag-outline" size={52} color={BORDER} />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add items from a store to get started</Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => navigation.navigate('StoreListing')}
          activeOpacity={0.85}
        >
          <Text style={styles.browseBtnText}>Browse Stores</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── OrderSuccess ──────────────────────────────────────────────────────────────

function OrderSuccess({ insets }) {
  return (
    <View style={[styles.root, styles.successRoot, { paddingTop: insets.top }]}>
      <View style={styles.successIconWrap}>
        <Ionicons name="checkmark-circle" size={72} color={SUCCESS} />
      </View>
      <Text style={styles.successTitle}>Order Placed!</Text>
      <Text style={styles.successSubtitle}>
        Your order has been placed successfully.{'\n'}Sit back and relax!
      </Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { items, addItem, removeItem, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const [placed,  setPlaced]  = useState(false);

  // ── Hide bottom tab bar while on this screen ──────────────────────────────
  const { hideTabBar, showTabBar } = useTabBar();
  useFocusEffect(useCallback(() => {
    hideTabBar();
    return () => showTabBar();
  }, [hideTabBar, showTabBar]));

  // ── Pulse animation for Place Order CTA ───────────────────────────────────
  const ctaPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.018,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Group items by store
  const storeGroups = useMemo(() => {
    const map = {};
    items.forEach(item => {
      if (!map[item.storeId]) {
        map[item.storeId] = { storeId: item.storeId, storeName: item.storeName, items: [] };
      }
      map[item.storeId].items.push(item);
    });
    return Object.values(map);
  }, [items]);

  const subtotal  = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasFee    = subtotal > 0;
  const delivery  = hasFee ? DELIVERY_FEE : 0;
  const platform  = hasFee ? PLATFORM_FEE : 0;
  const taxes     = Math.round(subtotal * GST_RATE);
  const grandTotal = subtotal + delivery + platform + taxes;

  const handlePlaceOrder = async () => {
    setPlacing(true);
    // Simulate order placement API call
    await new Promise(resolve => setTimeout(resolve, 1400));
    setPlacing(false);
    setPlaced(true);
    clearCart();
    setTimeout(() => navigation.popToTop(), 2200);
  };

  if (placed) return <OrderSuccess insets={insets} />;
  if (items.length === 0) return <EmptyCart navigation={navigation} insets={insets} />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={SURFACE} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart Review</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Store groups */}
        {storeGroups.map((group, gIdx) => (
          <View key={group.storeId}>
            {/* Store banner */}
            <View style={styles.storeBanner}>
              <View style={styles.storeBannerLeft}>
                <Ionicons name="storefront-outline" size={16} color={ACCENT} />
                <Text style={styles.storeName}>{group.storeName}</Text>
              </View>
              <View style={styles.deliveryChip}>
                <Ionicons name="bicycle-outline" size={12} color={SUCCESS} />
                <Text style={styles.deliveryChipText}>Free delivery</Text>
              </View>
            </View>

            {/* Cart items */}
            <View style={styles.itemsCard}>
              {group.items.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <CartItemRow
                    item={item}
                    onAdd={() => addItem({ ...item })}
                    onRemove={() => removeItem(item.id, item.storeId)}
                  />
                  {idx < group.items.length - 1 && <View style={styles.itemDivider} />}
                </React.Fragment>
              ))}
            </View>

            {gIdx < storeGroups.length - 1 && <View style={styles.storeGap} />}
          </View>
        ))}

        {/* ── Savings notice ─────────────────────────────────────────────── */}
        {(() => {
          const saved = items.reduce((s, i) =>
            s + ((i.base_price ?? i.price) - i.price) * i.quantity, 0);
          return saved > 0 ? (
            <View style={styles.savingsBanner}>
              <Ionicons name="pricetag-outline" size={14} color={SUCCESS} />
              <Text style={styles.savingsText}>
                You're saving <Text style={styles.savingsAmount}>₹{saved}</Text> on this order!
              </Text>
            </View>
          ) : null;
        })()}

        {/* ── Order summary ──────────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <SummaryRow label="Item total" value={`₹${subtotal}`} />
          <SummaryRow
            label="Delivery fee"
            value={delivery === 0 ? 'FREE' : `₹${delivery}`}
            accent={delivery === 0}
          />
          <SummaryRow label="Platform fee" value={`₹${platform}`} muted />
          <SummaryRow label={`GST (${GST_RATE * 100}%)`} value={`₹${taxes}`} muted />

          <View style={styles.summaryDivider} />

          <SummaryRow
            label="Grand Total"
            value={`₹${grandTotal}`}
            bold
          />
        </View>

        {/* ── Cancellation note ─────────────────────────────────────────── */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={14} color={TEXT_MUTED} />
          <Text style={styles.noteText}>
            Review your order carefully. Orders once placed cannot be cancelled.
          </Text>
        </View>
      </ScrollView>

      {/* ── Sticky CTA ───────────────────────────────────────────────────── */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 12 }]}>
        <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, placing && styles.placeOrderBtnBusy]}
          onPress={handlePlaceOrder}
          disabled={placing}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#6200EE', '#9C4DCC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.placeOrderGradient}
          >
            {placing ? (
              <ActivityIndicator color={WHITE} size="small" />
            ) : (
              <>
                <Text style={styles.placeOrderLabel}>Place Order</Text>
                <View style={styles.placeOrderAmountBox}>
                  <Text style={styles.placeOrderAmount}>₹{grandTotal}</Text>
                  <Ionicons name="arrow-forward" size={16} color={WHITE} style={{ marginLeft: 4 }} />
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRI,
    letterSpacing: -0.3,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },

  // ── Store banner ─────────────────────────────────────────────────────────────
  storeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  storeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRI,
  },
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deliveryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: SUCCESS,
  },

  // ── Items card ───────────────────────────────────────────────────────────────
  itemsCard: {
    backgroundColor: SURFACE,
    marginHorizontal: 16,
    marginTop: 2,
    borderRadius: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  // ── Cart item row ────────────────────────────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  itemSwatch: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRI,
    lineHeight: 19,
  },
  itemUnit: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRI,
  },
  itemBasePrice: {
    fontSize: 12,
    color: TEXT_MUTED,
    textDecorationLine: 'line-through',
  },
  discountPill: {
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  discountPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: SUCCESS,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRI,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    backgroundColor: '#6200EE',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyCount: {
    width: 24,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: WHITE,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: BORDER,
    marginHorizontal: 14,
  },
  storeGap: {
    height: 8,
  },

  // ── Savings banner ───────────────────────────────────────────────────────────
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savingsText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
    flex: 1,
  },
  savingsAmount: {
    fontWeight: '700',
  },

  // ── Order summary card ───────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: SURFACE,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRI,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: TEXT_SEC,
    fontWeight: '500',
  },
  summaryLabelBold: {
    color: TEXT_PRI,
    fontWeight: '700',
    fontSize: 16,
  },
  summaryLabelMuted: {
    color: TEXT_MUTED,
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 14,
    color: TEXT_PRI,
    fontWeight: '600',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: '800',
    color: NAVY,
  },
  summaryValueAccent: {
    color: SUCCESS,
    fontWeight: '700',
  },
  summaryValueMuted: {
    color: TEXT_MUTED,
    fontSize: 13,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: BORDER,
    marginVertical: 10,
  },

  // ── Note card ────────────────────────────────────────────────────────────────
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 17,
  },

  // ── Sticky CTA ───────────────────────────────────────────────────────────────
  ctaContainer: {
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: BORDER,
  },
  placeOrderBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 58,
  },
  placeOrderGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  placeOrderBtnBusy: {
    opacity: 0.75,
  },
  placeOrderLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
  placeOrderAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  placeOrderAmount: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '800',
  },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#F0F1F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRI,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  browseBtn: {
    marginTop: 16,
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  browseBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Order success ────────────────────────────────────────────────────────────
  successRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  successIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRI,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 15,
    color: TEXT_SEC,
    textAlign: 'center',
    lineHeight: 22,
  },
});
