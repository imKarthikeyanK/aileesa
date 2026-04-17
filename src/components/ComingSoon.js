/**
 * ComingSoon — Reusable "Coming Soon" screen with a Lottie-style animated orb.
 *
 * Uses React Native's Animated API to produce:
 *   • A floating, gently pulsing orb
 *   • Two expanding concentric rings that fade out (ripple effect)
 *   • A subtle entrance fade + slide-up for the text block
 *
 * No external Lottie dependency required.
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

// ─── Ripple Ring ───────────────────────────────────────────────────────────────

function RippleRing({ delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.9,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [delay, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.ring,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

// ─── Animated Orb ─────────────────────────────────────────────────────────────

function AnimatedOrb() {
  const floatY = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Gentle float
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -12,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle breathe scale
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, {
          toValue: 1.07,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(orbScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatY, orbScale]);

  return (
    <View style={styles.orbContainer}>
      {/* Ripple rings behind the orb */}
      <RippleRing delay={0} />
      <RippleRing delay={700} />

      {/* The orb itself */}
      <Animated.View
        style={[
          styles.orb,
          {
            transform: [{ translateY: floatY }, { scale: orbScale }],
          },
        ]}
      >
        {/* Inner glossy highlight */}
        <View style={styles.orbHighlight} />
        {/* Center glyph — stylised "A" for Aileesa */}
        <Text style={styles.orbGlyph}>A</Text>
      </Animated.View>
    </View>
  );
}

// ─── ComingSoon ────────────────────────────────────────────────────────────────

export default function ComingSoon({
  title = 'Coming Soon',
  subtitle = "We're crafting something special for you.",
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        delay: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 650,
        delay: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <AnimatedOrb />

        <View style={styles.textBlock}>
          <Text style={styles.eyebrow}>AILEESA</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>In Development</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const ORB_SIZE = 72;
const RING_SIZE = ORB_SIZE + 20;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing['8'],
  },

  // Orb
  orbContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing['8'],
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.accent,
  },
  orbHighlight: {
    position: 'absolute',
    top: 10,
    left: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  orbGlyph: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.black,
    color: theme.colors.text.inverse,
    letterSpacing: theme.typography.letterSpacing.tight,
  },

  // Text
  textBlock: {
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: theme.typography.sizes['2xs'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
    letterSpacing: theme.typography.letterSpacing.widest,
    marginBottom: theme.spacing['2'],
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.text.primary,
    letterSpacing: theme.typography.letterSpacing.tight,
    textAlign: 'center',
    marginBottom: theme.spacing['2'],
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: theme.spacing['5'],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentDim,
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['2'],
    borderRadius: theme.radii.full,
    gap: 6,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
  },
  pillText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.accent,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});
