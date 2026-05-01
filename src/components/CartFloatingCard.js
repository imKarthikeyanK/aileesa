/**
 * CartFloatingCard.js — Sticky bottom CTA shown when cart has items.
 *
 * Filters items by storeId so each store's detail screen shows only
 * that store's cart count & total (multi-store cart is supported globally).
 *
 * Animates up on first item add, down when cart empties.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';

const NAVY   = '#16172B';
const AMBER  = '#FBBF24';
const WHITE  = '#FFFFFF';
const CARD_H = 60;

export default function CartFloatingCard({ storeId, onPress, bottomInset = 0 }) {
  const { items } = useCart();

  const storeItems  = items.filter(i => i.storeId === storeId);
  const itemCount   = storeItems.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = storeItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const translateY = useRef(new Animated.Value(CARD_H + 32)).current;
  const prevCount  = useRef(0);

  useEffect(() => {
    const wasEmpty = prevCount.current === 0;
    const isEmpty  = itemCount === 0;
    prevCount.current = itemCount;

    if (wasEmpty && !isEmpty) {
      // Slide up with spring
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 16,
        stiffness: 220,
        mass: 0.9,
      }).start();
    } else if (!wasEmpty && isEmpty) {
      // Slide back down
      Animated.timing(translateY, {
        toValue: CARD_H + 32,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [itemCount]);

  if (itemCount === 0) return null;

  const itemLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: bottomInset + 16, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.92}
      >
        {/* Left — count badge + label */}
        <View style={styles.leftSection}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{itemCount}</Text>
          </View>
          <Text style={styles.itemsLabel}>{itemLabel} in cart</Text>
        </View>

        {/* Right — total + arrow */}
        <View style={styles.rightSection}>
          <Text style={styles.totalText}>₹{totalAmount}</Text>
          <View style={styles.arrowBox}>
            <Text style={styles.viewCartText}>View Cart</Text>
            <Ionicons name="arrow-forward" size={15} color={WHITE} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    elevation: 12,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  card: {
    height: CARD_H,
    backgroundColor: NAVY,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },

  // Left
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countPill: {
    backgroundColor: AMBER,
    borderRadius: 8,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '800',
  },
  itemsLabel: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.85,
  },

  // Right
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
  arrowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewCartText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
  },
});
