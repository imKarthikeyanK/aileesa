/**
 * BookingDetailScreen.js — BHL2: single booking detail, payment info,
 * live tracking timeline, and utility actions (invoice, bill, support).
 *
 * Route params: { bookingId: string }
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Linking, Share, Platform, Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { OrdersAPI } from '../../api/ordersApi';

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

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  // Real API status values
  payment_initiated: { label: 'Processing',  bg: '#EDE9FE', color: '#7C3AED', icon: 'time' },
  booked:            { label: 'Processing',  bg: '#EDE9FE', color: '#7C3AED', icon: 'time' },
  completed:         { label: 'Delivered',   bg: '#D1FAE5', color: SUCCESS,   icon: 'checkmark-circle' },
  refunded:          { label: 'Refunded',    bg: '#FEF3C7', color: AMBER,     icon: 'refresh-circle' },
  cancelled:         { label: 'Cancelled',   bg: '#FEE2E2', color: ACCENT,    icon: 'close-circle' },
  // Fallback aliases
  delivered:         { label: 'Delivered',   bg: '#D1FAE5', color: SUCCESS,   icon: 'checkmark-circle' },
  processing:        { label: 'Processing',  bg: '#EDE9FE', color: '#7C3AED', icon: 'time' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <View style={styles.sectionCard}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function InfoRow({ label, value, accent, bold }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          accent && { color: ACCENT },
          bold && { fontWeight: '700', color: NAVY },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ─── Tracking timeline ────────────────────────────────────────────────────────
function TrackingTimeline({ steps }) {
  if (!steps?.length) return null;
  return (
    <View style={styles.timeline}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <View key={idx} style={styles.timelineRow}>
            {/* Left: dot + line */}
            <View style={styles.timelineLeft}>
              <View style={[
                styles.timelineDot,
                step.done ? styles.timelineDotDone : styles.timelineDotPending,
              ]}>
                {step.done && <Ionicons name="checkmark" size={10} color={WHITE} />}
              </View>
              {!isLast && (
                <View style={[
                  styles.timelineLine,
                  step.done ? styles.timelineLineDone : styles.timelineLinePending,
                ]} />
              )}
            </View>
            {/* Right: label + time */}
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineLabel, !step.done && styles.timelineLabelPending]}>
                {step.label}
              </Text>
              {step.time ? (
                <Text style={styles.timelineTime}>{step.time}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Utility action button ────────────────────────────────────────────────────
function ActionBtn({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && { opacity: 0.38 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={20} color={ACCENT} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingDetailScreen({ route, navigation }) {
  const insets    = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const { bookingId } = route.params ?? {};

  const [order,     setOrder]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const res  = await OrdersAPI.getOrder(bookingId, { accessToken: token });
      // Real API returns { status, data: {...order} }; mock returns the order directly.
      setOrder(res?.data ?? res);
    } catch (e) {
      setError('Could not load booking details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId, getAccessToken]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleShare = async () => {
    const message = `My Aileesa order #${order.booking_id ?? order.id} — ₹${order.grand_total} from ${order.store_name}.`;
    if (Platform.OS === 'web') {
      // navigator.share requires HTTPS and is not universally available;
      // fall back to clipboard copy when unavailable.
      if (typeof navigator !== 'undefined' && navigator.share) {
        try { await navigator.share({ text: message }); } catch (_) {}
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try { await navigator.clipboard.writeText(message); } catch (_) {}
      }
      return;
    }
    try {
      await Share.share({ message });
    } catch (_) {}
  };

  // ── Render: loading / error states ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={TEXT_MUTED} />
          <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.booked;

  // ── Render: main detail ────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{order.booking_id ?? order.id}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={TEXT_PRI} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}
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
      >
        {/* ── Status banner ─────────────────────────────────────────────── */}
        <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerTitle, { color: cfg.color }]}>{cfg.label}</Text>
            {(order.status === 'completed' || order.status === 'delivered') && order.delivered_at && (
              <Text style={[styles.statusBannerSub, { color: cfg.color }]}>
                Delivered on {formatDateTime(order.delivered_at)}
              </Text>
            )}
            {(order.status === 'booked' || order.status === 'payment_initiated' || order.status === 'processing') && (
              <Text style={[styles.statusBannerSub, { color: cfg.color }]}>
                Placed on {formatDateTime(order.created_at)}
              </Text>
            )}
            {(order.status === 'cancelled' || order.status === 'refunded') && (
              <Text style={[styles.statusBannerSub, { color: cfg.color }]}>
                Order was cancelled · Refund in 3–5 business days
              </Text>
            )}
          </View>
        </View>

        {/* ── Tracking ──────────────────────────────────────────────────── */}
        <SectionCard title="TRACKING">
          <TrackingTimeline steps={order.tracking} />
        </SectionCard>

        {/* ── Order items ───────────────────────────────────────────────── */}
        <SectionCard title="ORDER ITEMS">
          <Text style={styles.storeName}>{order.store_name}</Text>
          {(order.items ?? []).map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.itemThumb} resizeMode="cover" />
              ) : null}
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <Text style={styles.itemName}>{item.variant_name ?? item.name ?? item.sku_code}</Text>
              <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
          <Divider />
          <InfoRow label="Subtotal"     value={`₹${order.sub_total}`} />
          <InfoRow label="Delivery"     value={order.delivery_fee === 0 ? 'FREE' : `₹${order.delivery_fee}`} />
          <InfoRow label="Platform fee" value={`₹${order.platform_fee}`} />
          <Divider />
          <InfoRow label="Total Paid"   value={`₹${order.grand_total}`} bold />
        </SectionCard>

        {/* ── Payment info ──────────────────────────────────────────────── */}
        <SectionCard title="PAYMENT">
          <InfoRow label="Method" value={order.payment_method} />
          <InfoRow
            label="Status"
            value={order.payment_status
              ? order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)
              : '—'}
            accent={order.payment_status === 'refunded'}
          />
          <InfoRow label="Booking ID" value={order.booking_id ?? order.id} />
          <InfoRow label="Order Date"  value={formatDateTime(order.created_at)} />
        </SectionCard>

        {/* ── Delivery address ──────────────────────────────────────────── */}
        <SectionCard title="DELIVERY ADDRESS">
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color={ACCENT} style={{ marginTop: 2 }} />
            <Text style={styles.addressText}>{order.formatted_address ?? order.delivery_info?.address ?? '—'}</Text>
          </View>
        </SectionCard>

        {/* ── Utility actions ───────────────────────────────────────────── */}
        <SectionCard title="ACTIONS">
          <View style={styles.actionsRow}>
            <ActionBtn
              icon="receipt-outline"
              label="Invoice"
              onPress={() => {}}
              disabled={!order.invoice_url}
            />
            <ActionBtn
              icon="document-text-outline"
              label="Bill"
              onPress={() => {}}
              disabled={!order.invoice_url}
            />
            <ActionBtn
              icon="logo-whatsapp"
              label="Support"
              onPress={() => Linking.openURL('https://wa.me/917337731123').catch(() => {})}
            />
            <ActionBtn
              icon="share-outline"
              label="Share"
              onPress={handleShare}
            />
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
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
    fontSize: 15,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: -0.2,
  },

  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: 32,
  },
  errorText: { fontSize: 14, color: TEXT_SEC, textAlign: 'center' },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 22, paddingVertical: 10,
    backgroundColor: ACCENT, borderRadius: 20,
  },
  retryBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },

  // ── Status banner ────────────────────────────────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  statusBannerTitle: { fontSize: 16, fontWeight: '800' },
  statusBannerSub:   { fontSize: 12, marginTop: 2, opacity: 0.8 },

  // ── Section card ─────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 2 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 13, color: TEXT_SEC },
  infoValue: { fontSize: 13, color: TEXT_PRI },

  storeName: { fontSize: 14, fontWeight: '700', color: NAVY, marginBottom: 2 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemThumb: { width: 32, height: 32, borderRadius: 8 },
  itemQty:   { fontSize: 13, color: TEXT_MUTED, width: 24 },
  itemName:  { flex: 1, fontSize: 13, color: TEXT_PRI },
  itemPrice: { fontSize: 13, fontWeight: '600', color: NAVY },

  addressRow: { flexDirection: 'row', gap: 8 },
  addressText: { flex: 1, fontSize: 13, color: TEXT_PRI, lineHeight: 20 },

  // ── Tracking ─────────────────────────────────────────────────────────────
  timeline: { gap: 0 },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  timelineDotDone:    { backgroundColor: SUCCESS },
  timelineDotPending: { backgroundColor: BORDER },
  timelineLine: { flex: 1, width: 2, marginTop: 2 },
  timelineLineDone:    { backgroundColor: SUCCESS },
  timelineLinePending: { backgroundColor: BORDER },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 13, fontWeight: '600', color: TEXT_PRI },
  timelineLabelPending: { color: TEXT_MUTED, fontWeight: '400' },
  timelineTime:  { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },

  // ── Actions ──────────────────────────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: ACCENT + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 11, color: TEXT_SEC, fontWeight: '600' },
});
