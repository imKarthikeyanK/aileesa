/**
 * OrderSuccessScreen.js — Intermediary order-confirmed screen.
 *
 * Shown immediately after a successful place-order call.
 * Auto-navigates to BookingDetail after AUTO_NAV_DELAY ms.
 * The user can also tap "Track Order" to jump there immediately.
 *
 * Route params: { bookingId: string }
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Analytics } from '../../api/analytics';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG      = '#F5F6FA';
const ACCENT  = '#6200EE';
const SUCCESS = '#10B981';
const WHITE   = '#FFFFFF';
const TEXT_PRI  = '#1A1A2E';
const TEXT_SEC  = '#64748B';

const AUTO_NAV_DELAY = 5000; // ms before auto-navigating to BHL2

// ─── Animated checkmark circle ────────────────────────────────────────────────
function CheckCircle() {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.15,
        duration: 380,
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.checkWrap, { opacity, transform: [{ scale }] }]}>
      <View style={styles.checkCircleOuter}>
        <View style={styles.checkCircleInner}>
          <Ionicons name="checkmark" size={44} color={WHITE} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownBadge({ seconds }) {
  return (
    <View style={styles.countdownBadge}>
      <Text style={styles.countdownNum}>{seconds}</Text>
      <Text style={styles.countdownLabel}>sec</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrderSuccessScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId, displayId } = route.params ?? {};

  useEffect(() => {
    Analytics.screen('order_success', { order_id: bookingId, display_id: displayId });
    Analytics.track('order_success_viewed', { order_id: bookingId, display_id: displayId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [countdown, setCountdown] = useState(Math.round(AUTO_NAV_DELAY / 1000));

  const goToDetail = () => {
    navigation.replace('BookingDetail', { orderId: bookingId });
  };

  useEffect(() => {
    // Countdown ticker
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(tick); return 0; }
        return c - 1;
      });
    }, 1000);

    // Auto-navigate
    const nav = setTimeout(goToDetail, AUTO_NAV_DELAY);

    return () => { clearInterval(tick); clearTimeout(nav); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fade-in for text block
  const textOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 500,
      delay: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ── Check animation ───────────────────────────────────────────────── */}
      <CheckCircle />

      {/* ── Text block ────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
        <Text style={styles.headline}>Order Confirmed!</Text>
        <Text style={styles.sub}>
          Your order has been placed successfully.{'\n'}
          Sit back while we get it ready for you.
        </Text>

        {displayId ? (
          <View style={styles.idPill}>
            <Ionicons name="receipt-outline" size={13} color={ACCENT} />
            <Text style={styles.idText}>#{displayId}</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.ctaBlock, { opacity: textOpacity }]}>
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={goToDetail}
          activeOpacity={0.86}
        >
          <Ionicons name="location-outline" size={18} color={WHITE} />
          <Text style={styles.trackBtnText}>Track Order</Text>
        </TouchableOpacity>

        <View style={styles.autoNavRow}>
          <CountdownBadge seconds={countdown} />
          <Text style={styles.autoNavText}>Redirecting to your booking details…</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 0,
  },

  // ── Check circle ────────────────────────────────────────────────────────────
  checkWrap: {
    marginBottom: 32,
  },
  checkCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: SUCCESS,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Text ────────────────────────────────────────────────────────────────────
  textBlock: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 40,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRI,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    fontSize: 15,
    color: TEXT_SEC,
    textAlign: 'center',
    lineHeight: 22,
  },
  idPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE7F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  idText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.3,
  },

  // ── CTA ─────────────────────────────────────────────────────────────────────
  ctaBlock: {
    alignItems: 'center',
    gap: 18,
    width: '100%',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    justifyContent: 'center',
  },
  trackBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.2,
  },
  autoNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNum: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT,
    lineHeight: 16,
  },
  countdownLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: ACCENT,
    lineHeight: 10,
  },
  autoNavText: {
    fontSize: 13,
    color: TEXT_SEC,
  },
});
