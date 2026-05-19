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
  Image,
  Modal,
  Pressable,
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
import { useAuth } from '../../context/AuthContext';
import { useAddress } from '../../context/AddressContext';
import AuthSheet from '../../components/auth/AuthSheet';
import { OrdersAPI } from '../../api/ordersApi';

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

const DELIVERY_FEE         = 29;   // flat fee when subtotal is between MOV and free-delivery threshold
const FREE_DELIVERY_ABOVE  = 199;  // free delivery at/above this subtotal
const MIN_ORDER_VALUE      = 149;  // orders below this cannot be placed
const PLATFORM_FEE         = 5;
const GST_RATE             = 0.05;

// ─── AddressPicker sheet ───────────────────────────────────────────────────────

function AddressPickerSheet({ visible, onClose, onNavigateToAdd }) {
  const { addresses, selectedAddress, selectAddress, isLoading } = useAddress();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={addrStyles.overlay} onPress={onClose} />
      <View style={[addrStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={addrStyles.handle} />
        <Text style={addrStyles.sheetTitle}>Deliver to</Text>

        {isLoading ? (
          <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
        ) : addresses.length === 0 ? (
          <Text style={addrStyles.empty}>No saved addresses.</Text>
        ) : (
          addresses.map(addr => {
            const isSel = selectedAddress?.id === addr.id;
            return (
              <TouchableOpacity
                key={addr.id}
                style={[addrStyles.addrRow, isSel && addrStyles.addrRowSel]}
                onPress={() => { selectAddress(addr); onClose(); }}
                activeOpacity={0.8}
              >
                <View style={addrStyles.addrIconWrap}>
                  <Ionicons
                    name={addr.label?.toLowerCase() === 'home' ? 'home-outline' : addr.label?.toLowerCase() === 'office' ? 'briefcase-outline' : 'location-outline'}
                    size={18}
                    color={isSel ? ACCENT : TEXT_SEC}
                  />
                </View>
                <View style={addrStyles.addrTextWrap}>
                  <Text style={[addrStyles.addrLabel, isSel && addrStyles.addrLabelSel]}>
                    {addr.label}
                  </Text>
                  <Text style={addrStyles.addrLine} numberOfLines={2}>
                    {addr.formatted_address}
                  </Text>
                </View>
                {isSel && (
                  <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
                )}
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={addrStyles.addBtn}
          onPress={() => { onClose(); onNavigateToAdd(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
          <Text style={addrStyles.addBtnText}>Add new address</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const addrStyles = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 12 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: TEXT_PRI, marginBottom: 12 },
  empty:       { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', marginVertical: 20 },
  addrRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, backgroundColor: BG, gap: 12 },
  addrRowSel:  { backgroundColor: '#EDE7F6', borderWidth: 1, borderColor: ACCENT },
  addrIconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  addrTextWrap:{ flex: 1 },
  addrLabel:   { fontSize: 14, fontWeight: '600', color: TEXT_PRI },
  addrLabelSel:{ color: ACCENT },
  addrLine:    { fontSize: 12, color: TEXT_SEC, marginTop: 2 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, justifyContent: 'center' },
  addBtnText:  { fontSize: 14, fontWeight: '600', color: ACCENT },
});

// ─── CartItemRow ───────────────────────────────────────────────────────────────

/** Safely coerce an image field that may be a string, array, or null to a URI string. */
function _imageUri(val) {
  if (!val) return null;
  if (typeof val === 'string') return val || null;
  if (Array.isArray(val)) return val.find(v => typeof v === 'string' && v) ?? null;
  return null;
}

function CartItemRow({ item, onAdd, onRemove }) {
  const discount =
    item.base_price && item.base_price > item.price
      ? Math.round((1 - item.price / item.base_price) * 100)
      : 0;
  const lineTotal = item.price * item.quantity;

  // Match PLP logic exactly:
  // maxReached is false when no cap is set (not ?? 99)
  const maxReached = item.max_quantity_per_item
    ? item.quantity >= item.max_quantity_per_item
    : false;
  // non-multi_add items can only have 1 unit — + is always disabled in cart
  const addDisabled = maxReached || !item.multi_add;

  return (
    <View style={styles.itemRow}>
      {/* Icon swatch */}
      <View style={[styles.itemSwatch, { backgroundColor: item.icon_bg ?? '#F0F1F8' }]}>
        {item.image_url
          ? <Image source={{ uri: _imageUri(item.image_url) }} style={styles.swatchImage} resizeMode="cover" />
          : <Ionicons
              name={item.icon ?? 'cube-outline'}
              size={22}
              color={item.icon_color ?? ACCENT}
            />
        }
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
            style={[styles.qtyBtn, addDisabled && styles.qtyBtnDisabled]}
            onPress={onAdd}
            activeOpacity={0.8}
            disabled={addDisabled}
          >
            <Ionicons name="add" size={14} color={addDisabled ? 'rgba(255,255,255,0.4)' : WHITE} />
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
  const { isAuthenticated, getAccessToken } = useAuth();
  const { selectedAddress, isLoading: addrLoading } = useAddress();
  const [placing, setPlacing]         = useState(false);
  const [authSheet, setAuthSheet]     = useState(false);
  const [addrSheet, setAddrSheet]     = useState(false);
  const pendingOrder = useRef(false);  // true when user hit Place Order before login

  // Auto-trigger place order once user logs in from the auth sheet
  useEffect(() => {
    if (isAuthenticated && pendingOrder.current) {
      pendingOrder.current = false;
      handlePlaceOrder();
    }
  }, [isAuthenticated]);

  // ── Hide bottom tab bar while on this screen ──────────────────────────────
  const { hideTabBar, showTabBar } = useTabBar();
  useFocusEffect(useCallback(() => {
    hideTabBar();
    return () => showTabBar();
  }, [hideTabBar, showTabBar]));

  // Re-hide the tab bar whenever the auth sheet is dismissed.
  // On web, showing a Modal can trigger a navigation blur/focus cycle which
  // calls the useFocusEffect cleanup (showTabBar) and then re-hides. The
  // brief window between those two calls makes the tab bar flash into view.
  // Explicitly re-hiding after the sheet closes eliminates that flash.
  useEffect(() => {
    if (!authSheet) hideTabBar();
  }, [authSheet, hideTabBar]);

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

  const subtotal        = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasFee          = subtotal > 0;
  const belowMinimum    = subtotal < MIN_ORDER_VALUE;
  const freeDelivery    = subtotal >= FREE_DELIVERY_ABOVE;
  const delivery        = hasFee ? (freeDelivery ? 0 : DELIVERY_FEE) : 0;
  const platform        = hasFee ? PLATFORM_FEE : 0;
  // GST handling TBD — not shown in invoice for now
  // const taxes        = Math.round(subtotal * GST_RATE);
  const grandTotal      = subtotal + delivery + platform;

  // Progress towards free delivery (only relevant when above MOV and below threshold)
  const toFreeDelivery  = Math.max(0, FREE_DELIVERY_ABOVE - subtotal);
  const toMinimum       = Math.max(0, MIN_ORDER_VALUE - subtotal);

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      pendingOrder.current = true;
      setAuthSheet(true);
      return;
    }
    if (!selectedAddress) {
      navigation.navigate('LocationPicker');
      return;
    }
    setPlacing(true);
    try {
      const token = await getAccessToken();
      const firstItem = items[0];
      const orderItems = items.map(i => ({
        id:         i.id,
        variant_id: i.variant_id,
        product_id: i.product_id,
        sku_code:   i.sku_code,
        quantity:   i.quantity,
        price:      i.price,
        base_price: i.base_price,
      }));
      const order = await OrdersAPI.placeOrder({
        store_id:        firstItem.storeId,
        business_id:     firstItem.business_id,
        items:           orderItems,
        sub_total:       subtotal,
        delivery_fee:    delivery,
        platform_fee:    platform,
        grand_total:     grandTotal,
        user_address_id: selectedAddress.id,
        payment_method:  'COD',
        delivery_time:   '30_mins',
        accessToken:     token,
      });
      clearCart();
      const orderId = order?.data?.id ?? order?.id;
      navigation.replace('BookingDetail', { bookingId: orderId });
    } catch (e) {
      // TODO: surface error toast
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) return <EmptyCart navigation={navigation} insets={insets} />;

  return (
    <>
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={SURFACE} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart Review</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Free delivery promo strip ─────────────────────────────────────── */}
      <View style={styles.promoStrip}>
        <Ionicons name="bicycle-outline" size={13} color={SUCCESS} />
        <Text style={styles.promoStripText}>
          FREE delivery on orders above{' '}
          <Text style={styles.promoStripBold}>₹{FREE_DELIVERY_ABOVE}</Text>
          {'  ·  '}
          <Text style={styles.promoStripMuted}>Min. order ₹{MIN_ORDER_VALUE}</Text>
        </Text>
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Store groups */}
        {storeGroups.map((group, gIdx) => (
          <View key={group.storeId}>
            {/* Store banner */}
            <View style={styles.storeBanner}>
              <View style={styles.storeBannerLeft}>
                <Ionicons name="storefront-outline" size={16} color={ACCENT} />
                <Text style={styles.storeName}>{group.storeName}</Text>
              </View>
              <View style={[styles.deliveryChip, !freeDelivery && styles.deliveryChipPaid]}>
                <Ionicons name="bicycle-outline" size={12} color={freeDelivery ? SUCCESS : AMBER} />
                <Text style={[styles.deliveryChipText, !freeDelivery && styles.deliveryChipTextPaid]}>
                  {freeDelivery ? 'Free delivery' : `₹${DELIVERY_FEE} delivery`}
                </Text>
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

        {/* ── Minimum order / free delivery nudge ────────────────────────── */}
        {belowMinimum ? (
          <View style={styles.nudgeCard}>
            <View style={styles.nudgeRow}>
              <Ionicons name="alert-circle-outline" size={15} color="#C62828" />
              <Text style={styles.nudgeTextDanger}>
                Add items worth{' '}
                <Text style={styles.nudgeAmount}>₹{toMinimum}</Text>{' '}
                more to place your order
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  styles.progressFillDanger,
                  { width: `${Math.min(100, (subtotal / MIN_ORDER_VALUE) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.nudgeSub}>
              Minimum order value is ₹{MIN_ORDER_VALUE}
            </Text>
          </View>
        ) : !freeDelivery ? (
          <View style={styles.nudgeCard}>
            <View style={styles.nudgeRow}>
              <Ionicons name="bicycle-outline" size={15} color="#B45309" />
              <Text style={styles.nudgeTextAmber}>
                Add items worth{' '}
                <Text style={styles.nudgeAmount}>₹{toFreeDelivery}</Text>{' '}
                more for free delivery
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  styles.progressFillAmber,
                  { width: `${Math.min(100, (subtotal / FREE_DELIVERY_ABOVE) * 100)}%` },
                ]}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.nudgeCard, styles.nudgeCardSuccess]}>
            <View style={styles.nudgeRow}>
              <Ionicons name="checkmark-circle" size={15} color={SUCCESS} />
              <Text style={styles.nudgeTextSuccess}>You've unlocked free delivery!</Text>
            </View>
          </View>
        )}

        {/* ── Order summary ──────────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <SummaryRow label="Item total" value={`₹${subtotal}`} />
          <SummaryRow
            label="Delivery fee"
            value={freeDelivery ? 'FREE' : `₹${delivery}`}
            accent={freeDelivery}
          />
          <SummaryRow label="Platform fee" value={`₹${platform}`} muted />
          {/* GST breakup hidden — handling TBD; will be added back in a later release */}
          {/* <SummaryRow label={`GST (${GST_RATE * 100}%)`} value={`₹${taxes}`} muted /> */}

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
        {selectedAddress?.formatted_address ? (
          <View style={styles.deliverToBar}>
            <Ionicons name="location" size={13} color={ACCENT} />
            <Text style={styles.deliverToText} numberOfLines={1}>
              <Text style={styles.deliverToBold}>Delivering to </Text>
              {selectedAddress.formatted_address}
            </Text>
          </View>
        ) : null}
        <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, (placing || belowMinimum) && styles.placeOrderBtnBusy]}
          onPress={handlePlaceOrder}
          disabled={placing || belowMinimum}
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
    <AuthSheet visible={authSheet} onClose={() => setAuthSheet(false)} />
    <AddressPickerSheet
      visible={addrSheet}
      onClose={() => setAddrSheet(false)}
      onNavigateToAdd={() => navigation.navigate('LocationPicker')}
    />
    </>
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
  deliveryChipPaid: {
    backgroundColor: '#FEF3C7',
  },
  deliveryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: SUCCESS,
  },
  deliveryChipTextPaid: {
    color: '#B45309',
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
    overflow: 'hidden',
  },
  swatchImage: {
    width: 48,
    height: 48,
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

  // ── Delivery / minimum order nudge card ──────────────────────────────────────
  nudgeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  nudgeCardSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  nudgeTextDanger: {
    fontSize: 13,
    fontWeight: '500',
    color: '#C62828',
    flex: 1,
  },
  nudgeTextAmber: {
    fontSize: 13,
    fontWeight: '500',
    color: '#B45309',
    flex: 1,
  },
  nudgeTextSuccess: {
    fontSize: 13,
    fontWeight: '600',
    color: SUCCESS,
    flex: 1,
  },
  nudgeAmount: {
    fontWeight: '800',
  },
  nudgeSub: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressFillDanger: {
    backgroundColor: '#EF4444',
  },
  progressFillAmber: {
    backgroundColor: AMBER,
  },

  // ── Free delivery promo strip ─────────────────────────────────────────────
  promoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  promoStripText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  promoStripBold: {
    fontWeight: '800',
    color: SUCCESS,
  },
  promoStripMuted: {
    color: TEXT_MUTED,
    fontWeight: '400',
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

  // ── Address card ─────────────────────────────────────────────────────────────
  addressCard: {
    backgroundColor: SURFACE,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: BORDER,
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addressCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SEC,
  },
  addressChangeBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRI,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 13,
    color: TEXT_SEC,
    lineHeight: 18,
  },
  addressReceiver: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  addAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },

  // ── Sticky CTA ───────────────────────────────────────────────────────────────
  ctaContainer: {
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: BORDER,
  },
  deliverToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  deliverToText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_SEC,
  },
  deliverToBold: {
    fontWeight: '600',
    color: TEXT_PRI,
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
