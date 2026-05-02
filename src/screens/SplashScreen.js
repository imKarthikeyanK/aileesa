/**
 * SplashScreen.js — Branded loading gate shown while:
 *   1. Location permission is being requested
 *   2. GPS coordinates are being fetched
 *   3. Serviceability API is being called
 *
 * When done/denied/error → calls onDone() to hand off to main navigation.
 *   - "done"   → brief "All set!" delay then smooth fade-out
 *   - "denied" → shows an actionable denied-state UI (retry / skip)
 *   - "error"  → shows retry / skip options
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';

// ─── Design tokens (match app brand palette) ───────────────────────────────────

const ACCENT = '#6200EE';
const WHITE  = '#FFFFFF';

// ─── Status → copy map ────────────────────────────────────────────────────────

const STATUS_COPY = {
  idle:       'Starting up…',
  requesting: 'Getting your location…',
  locating:   'Pinpointing your position…',
  checking:   'Checking service availability…',
  done:       'All set! ✓',
  denied:     null,   // handled by separate UI block
  error:      null,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SplashScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { status, retryLocation } = useLocation();

  // ── Animations ──────────────────────────────────────────────────────────────

  // Pulsing outer ring
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Animated loading dots (opacity 0 → 1 → 0)
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;

  // Full-screen fade-out on completion
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Pulse ring loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue:         1.22,
          duration:        950,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue:         1,
          duration:        950,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseScale]);

  // Loading dots waterfall loop
  useEffect(() => {
    const runDots = () => {
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(dot1, { toValue: 0.25, duration: 160, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.25, duration: 160, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.25, duration: 160, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished) runDots();
      });
    };
    runDots();
  }, [dot1, dot2, dot3]);

  // Transition: fade out when status is 'done', hand off for 'denied'/'error'
  useEffect(() => {
    if (status === 'done') {
      const timer = setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue:         0,
          duration:        420,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) onDone?.();
        });
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [status, screenOpacity, onDone]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const isLoading  = ['idle', 'requesting', 'locating', 'checking'].includes(status);
  const showDenied = status === 'denied';
  const showError  = status === 'error';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[styles.root, { opacity: screenOpacity }]}
      pointerEvents={status === 'done' ? 'none' : 'auto'}
    >
      {/* ── Branding ────────────────────────────────────────────────────────── */}
      <View style={styles.logoWrap}>
        <Animated.View
          style={[styles.pulseRing, { transform: [{ scale: pulseScale }] }]}
        />
        <View style={styles.logoCircle}>
          <Text style={styles.logoLetter}>A</Text>
        </View>
      </View>

      <Text style={styles.appName}>Aileesa</Text>
      <Text style={styles.tagline}>Quick commerce, delivered fast</Text>

      {/* ── Loading state ────────────────────────────────────────────────────── */}
      {(isLoading || status === 'done') && (
        <View style={styles.statusBlock}>
          <Text style={styles.statusText}>{STATUS_COPY[status] ?? 'Loading…'}</Text>
          {isLoading && (
            <View style={styles.dotsRow}>
              {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Permission denied ────────────────────────────────────────────────── */}
      {showDenied && (
        <View style={styles.stateBox}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="location-outline" size={32} color="rgba(255,255,255,0.65)" />
          </View>
          <Text style={styles.stateTitle}>Location access denied</Text>
          <Text style={styles.stateSubtitle}>
            Aileesa needs your location to check if we deliver to your area.
            Please grant permission and try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={retryLocation} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={16} color={ACCENT} />
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onDone} activeOpacity={0.75}>
            <Text style={styles.secondaryBtnText}>Continue without location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {showError && (
        <View style={styles.stateBox}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="warning-outline" size={32} color="rgba(255,255,255,0.65)" />
          </View>
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.stateSubtitle}>
            We couldn't determine your location. Please check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={retryLocation} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={16} color={ACCENT} />
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onDone} activeOpacity={0.75}>
            <Text style={styles.secondaryBtnText}>Continue without location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <Text style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        © 2025 Aileesa. All rights reserved.
      </Text>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ACCENT,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          999,
  },

  // ── Logo ─────────────────────────────────────────────────────────────────────
  logoWrap: {
    width:           120,
    height:          120,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    28,
  },
  pulseRing: {
    position:        'absolute',
    width:           120,
    height:          120,
    borderRadius:    60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoCircle: {
    width:           88,
    height:          88,
    borderRadius:    26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.35)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoLetter: {
    fontSize:        44,
    fontWeight:      '900',
    color:           WHITE,
    letterSpacing:   -2,
  },

  // ── Wordmark ──────────────────────────────────────────────────────────────────
  appName: {
    fontSize:        38,
    fontWeight:      '900',
    color:           WHITE,
    letterSpacing:   -1.5,
    marginBottom:    6,
  },
  tagline: {
    fontSize:        14,
    color:           'rgba(255,255,255,0.6)',
    fontWeight:      '500',
    letterSpacing:   0.3,
    marginBottom:    52,
  },

  // ── Loading status ────────────────────────────────────────────────────────────
  statusBlock: {
    alignItems:  'center',
    gap:         12,
    minHeight:   64,
  },
  statusText: {
    fontSize:    14,
    color:       'rgba(255,255,255,0.75)',
    fontWeight:  '500',
    letterSpacing: 0.1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap:           8,
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  // ── Denied / Error state box ─────────────────────────────────────────────────
  stateBox: {
    alignItems:      'center',
    paddingHorizontal: 36,
    gap:             10,
    maxWidth:        360,
  },
  stateIconWrap: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  stateTitle: {
    fontSize:        20,
    fontWeight:      '800',
    color:           WHITE,
    textAlign:       'center',
    letterSpacing:   -0.3,
  },
  stateSubtitle: {
    fontSize:        14,
    color:           'rgba(255,255,255,0.65)',
    textAlign:       'center',
    lineHeight:      21,
  },
  primaryBtn: {
    marginTop:       12,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: WHITE,
    borderRadius:    14,
    paddingHorizontal: 28,
    paddingVertical:  13,
  },
  primaryBtnText: {
    fontSize:        15,
    fontWeight:      '700',
    color:           ACCENT,
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize:        13,
    color:           'rgba(255,255,255,0.55)',
    fontWeight:      '500',
    textDecorationLine: 'underline',
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position:    'absolute',
    bottom:      0,
    fontSize:    11,
    color:       'rgba(255,255,255,0.3)',
    fontWeight:  '400',
    letterSpacing: 0.2,
  },
});
