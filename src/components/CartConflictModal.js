/**
 * CartConflictModal.js
 *
 * Shown automatically when the user tries to add an item from a store that
 * differs from the store whose items are already in the cart.
 *
 * Options:
 *   • Cancel  — dismisses the modal; the pending item is discarded
 *   • Replace Cart — clears the existing cart and adds the pending item
 *
 * The modal is driven entirely by CartContext.pendingAdd so it can live at the
 * root of the app and work from any screen.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';

// ─── Design tokens (matches app palette) ──────────────────────────────────────
const NAVY      = '#16172B';
const ACCENT    = '#6200EE';
const WHITE     = '#FFFFFF';
const BG        = '#F7F7FB';
const TEXT_PRI  = '#1A1A2E';
const TEXT_SEC  = '#64748B';
const BORDER    = '#EDECF5';
const DANGER    = '#EF4444';
const DANGER_BG = '#FEF2F2';

export default function CartConflictModal() {
  const { pendingAdd, items, confirmReplaceCart, cancelPendingAdd } = useCart();

  const visible = !!pendingAdd;

  // Existing store name derived from cart items
  const existingStoreName = items.length > 0 ? items[0].storeName : '';
  // New store name from the pending item
  const newStoreName = pendingAdd?.item?.storeName ?? '';

  // ── Sheet slide-up animation ───────────────────────────────────────────────
  const slideY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 260,
          mass: 0.9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      slideY.setValue(300);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  // Existing item count for display
  const existingItemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={cancelPendingAdd}
    >
      {/* Backdrop — tap to cancel */}
      <TouchableWithoutFeedback onPress={cancelPendingAdd}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideY }] }]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="cart-outline" size={32} color={DANGER} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Replace cart?</Text>

        {/* Body */}
        <Text style={styles.body}>
          Your cart has{' '}
          <Text style={styles.bodyBold}>
            {existingItemCount} {existingItemCount === 1 ? 'item' : 'items'}
          </Text>{' '}
          from{' '}
          <Text style={styles.bodyBold}>{existingStoreName}</Text>.{'\n'}
          Adding from{' '}
          <Text style={styles.bodyBold}>{newStoreName}</Text> will remove them.
        </Text>

        {/* Store comparison pills */}
        <View style={styles.storeRow}>
          <View style={styles.storePill}>
            <Ionicons name="storefront-outline" size={13} color={TEXT_SEC} />
            <Text style={styles.storePillText} numberOfLines={1}>
              {existingStoreName}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={TEXT_SEC} style={styles.arrow} />
          <View style={[styles.storePill, styles.storePillAccent]}>
            <Ionicons name="storefront-outline" size={13} color={ACCENT} />
            <Text style={[styles.storePillText, styles.storePillTextAccent]} numberOfLines={1}>
              {newStoreName}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.replaceBtn}
          onPress={confirmReplaceCart}
          activeOpacity={0.85}
        >
          <Text style={styles.replaceBtnText}>Yes, replace cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={cancelPendingAdd}
          activeOpacity={0.75}
        >
          <Text style={styles.cancelBtnText}>Keep current cart</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 23, 43, 0.55)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },

  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: BORDER,
    marginBottom: 20,
  },

  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: DANGER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRI,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 10,
  },

  body: {
    fontSize: 14,
    color: TEXT_SEC,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  bodyBold: {
    fontWeight: '700',
    color: TEXT_PRI,
  },

  // Store comparison row
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BG,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 130,
  },
  storePillAccent: {
    backgroundColor: '#EDE7F6',
    borderColor: '#D1C4E9',
  },
  storePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SEC,
    flexShrink: 1,
  },
  storePillTextAccent: {
    color: ACCENT,
  },
  arrow: {
    flexShrink: 0,
  },

  // Replace button — filled, danger-tinted
  replaceBtn: {
    backgroundColor: DANGER,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  replaceBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.1,
  },

  // Cancel button — ghost
  cancelBtn: {
    backgroundColor: BG,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRI,
  },
});
