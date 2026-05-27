/**
 * OrderHistoryScreen.js — BHL1: user's past orders list
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OrdersAPI } from '../api/ordersApi';
import { useAuth } from '../context/AuthContext';
import AuthSheet from '../components/auth/AuthSheet';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG        = '#F5F6FA';
const SURFACE   = '#FFFFFF';
const NAVY      = '#16172B';
const ACCENT    = '#E8445A';
const SUCCESS   = '#10B981';
const AMBER     = '#F59E0B';
const TEXT_PRI  = '#16172B';
const TEXT_SEC  = '#64748B';
const TEXT_MUTED = '#94A3B8';
const BORDER    = '#E4E8F4';
const WHITE     = '#FFFFFF';

// ─── Status pill config ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  // Real API order statuses
  booked:     { label: 'Processing', bg: '#EDE9FE', color: '#7C3AED', icon: 'time' },
  completed:  { label: 'Delivered',  bg: '#D1FAE5', color: SUCCESS,   icon: 'checkmark-circle' },
  refunded:   { label: 'Refunded',   bg: '#FEF3C7', color: AMBER,     icon: 'refresh-circle' },
  cancelled:  { label: 'Cancelled',  bg: '#FEE2E2', color: ACCENT,    icon: 'close-circle' },
  // Fallback aliases
  delivered:  { label: 'Delivered',  bg: '#D1FAE5', color: SUCCESS,   icon: 'checkmark-circle' },
  processing: { label: 'Processing', bg: '#EDE9FE', color: '#7C3AED', icon: 'time' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── OrderCard ────────────────────────────────────────────────────────────────
function OrderCard({ order, onPress }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.booked;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemSummary = items
    .slice(0, 2)
    .map(i => typeof i === 'string' ? i : `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
    .join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.72}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardStore}>{order.store_name}</Text>
          <Text style={styles.cardDate}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={11} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Items summary */}
      <Text style={styles.cardItems} numberOfLines={1}>{itemSummary}</Text>

      {/* Bottom row */}
      <View style={styles.cardBottom}>
        <Text style={styles.cardTotal}>₹{order.grand_total}</Text>
        <View style={styles.cardCta}>
          <Text style={styles.cardCtaText}>View Details</Text>
          <Ionicons name="chevron-forward" size={13} color={ACCENT} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrderHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { getAccessToken, isAuthenticated } = useAuth();
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState(null);
  const [authSheetVisible, setAuthSheetVisible] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const res = await OrdersAPI.getOrders({ accessToken: token });
      // Real API returns { status, data: [...orders], pagination: {...} }
      setOrders(res?.data ?? res);
    } catch (e) {
      setError('Could not load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAccessToken]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Past Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {!isAuthenticated ? (
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={44} color={TEXT_MUTED} />
          <Text style={styles.errorText}>Login to view your orders</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setAuthSheetVisible(true)}>
            <Text style={styles.retryBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={TEXT_MUTED} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={
            orders.length === 0
              ? styles.emptyListContent
              : { padding: 16, paddingBottom: insets.bottom + 24 }
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIllustration}>
                <Ionicons name="bag-outline" size={48} color={BORDER} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>
                Looks like you haven't ordered anything. Explore stores nearby and place your first order!
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => navigation.navigate('Market')}
                activeOpacity={0.82}
              >
                <Ionicons name="storefront-outline" size={16} color={WHITE} style={{ marginRight: 6 }} />
                <Text style={styles.exploreBtnText}>Explore Stores</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[ACCENT]}
                tintColor={ACCENT}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => navigation.navigate('BookingDetail', { orderId: item.id })}
            />
          )}
        />
      )}
      <AuthSheet visible={authSheetVisible} onClose={() => setAuthSheetVisible(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 56,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: -0.3,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  errorText:   { fontSize: 14, color: TEXT_SEC, textAlign: 'center' },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: ACCENT,
    borderRadius: 20,
  },
  retryBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyListContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 10,
  },
  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F1F0FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: TEXT_PRI },
  emptySubtitle: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20 },
  exploreBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: ACCENT,
    borderRadius: 22,
  },
  exploreBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardStore: { fontSize: 15, fontWeight: '700', color: TEXT_PRI },
  cardDate:  { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  cardItems: { fontSize: 13, color: TEXT_SEC, lineHeight: 18 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  cardTotal: { fontSize: 16, fontWeight: '800', color: NAVY },
  cardCta:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardCtaText: { fontSize: 13, fontWeight: '600', color: ACCENT },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
});
