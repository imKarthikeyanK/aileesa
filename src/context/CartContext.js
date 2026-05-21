/**
 * CartContext.js — Global cart state with reducer pattern.
 *
 * Single-store cart enforcement:
 *   If a user tries to add an item from a different store while the cart
 *   already holds items from another store, the add is intercepted and stored
 *   in `pendingAdd`.  A conflict modal reads this and offers:
 *     • Cancel  → calls cancelPendingAdd() — nothing changes
 *     • Replace → calls confirmReplaceCart() — clears the old cart and adds
 *                 the pending item from the new store
 *
 * Each item shape:
 *   { id, name, unit, price, base_price, icon, icon_bg, icon_color,
 *     storeId, storeName, max_quantity_per_item, quantity }
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'aileesa_cart';

// ─── localStorage helpers (web only) ─────────────────────────────────────────
function loadFromStorage() {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveToStorage(items) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

const CartContext = createContext(null);

// pendingAdd: { item } | null  — set when a cross-store add is attempted
const initialState = { items: [], pendingAdd: null };

function getInitialState() {
  const saved = loadFromStorage();
  if (saved && Array.isArray(saved)) return { items: saved, pendingAdd: null };
  return initialState;
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const incoming = action.item;

      // ── Single-store guard ──────────────────────────────────────────────
      // If the cart is non-empty and the new item belongs to a different store,
      // park it as pendingAdd so the UI can ask the user what to do.
      if (
        state.items.length > 0 &&
        state.items[0].storeId !== incoming.storeId
      ) {
        return { ...state, pendingAdd: { item: incoming } };
      }

      const idx = state.items.findIndex(
        i => i.id === incoming.id && i.storeId === incoming.storeId,
      );

      if (idx >= 0) {
        const existing = state.items[idx];
        const max = existing.max_quantity_per_item ?? Infinity;
        if (existing.quantity >= max) return state; // already at cap

        const next = state.items.slice();
        next[idx] = { ...existing, quantity: existing.quantity + 1 };
        return { ...state, items: next };
      }

      return {
        ...state,
        items: [...state.items, { ...incoming, quantity: 1 }],
      };
    }

    case 'REMOVE_ITEM': {
      const { itemId, storeId } = action;
      const idx = state.items.findIndex(
        i => i.id === itemId && i.storeId === storeId,
      );
      if (idx < 0) return state;

      const existing = state.items[idx];
      if (existing.quantity === 1) {
        return {
          ...state,
          items: state.items.filter((_, i) => i !== idx),
        };
      }

      const next = state.items.slice();
      next[idx] = { ...existing, quantity: existing.quantity - 1 };
      return { ...state, items: next };
    }

    // User chose to replace the existing cart with the pending item's store
    case 'CONFIRM_REPLACE': {
      if (!state.pendingAdd) return state;
      return {
        items: [{ ...state.pendingAdd.item, quantity: 1 }],
        pendingAdd: null,
      };
    }

    // User cancelled the cross-store add — discard the pending item
    case 'CANCEL_PENDING_ADD':
      return { ...state, pendingAdd: null };

    case 'CLEAR_CART':
      return initialState;

    case 'HYDRATE':
      // Native only: populate cart from AsyncStorage on first mount.
      // Skip if already hydrated from web localStorage (items.length > 0).
      if (state.items.length > 0) return state;
      return { ...state, items: action.items };

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, getInitialState);

  // Native: hydrate cart from AsyncStorage once on mount
  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) dispatch({ type: 'HYDRATE', items });
        } catch {}
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist items whenever they change (web → localStorage, native → AsyncStorage)
  useEffect(() => {
    saveToStorage(state.items); // web only (no-op on native)
    if (Platform.OS !== 'web') {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)).catch(() => {});
    }
  }, [state.items]);

  const addItem = useCallback(item => {
    dispatch({ type: 'ADD_ITEM', item });
  }, []);

  const removeItem = useCallback((itemId, storeId) => {
    dispatch({ type: 'REMOVE_ITEM', itemId, storeId });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const confirmReplaceCart = useCallback(() => {
    dispatch({ type: 'CONFIRM_REPLACE' });
  }, []);

  const cancelPendingAdd = useCallback(() => {
    dispatch({ type: 'CANCEL_PENDING_ADD' });
  }, []);

  const getItemQuantity = useCallback(
    (itemId, storeId) => {
      const item = state.items.find(
        i => i.id === itemId && i.storeId === storeId,
      );
      return item ? item.quantity : 0;
    },
    [state.items],
  );

  const value = useMemo(
    () => ({
      items: state.items,
      pendingAdd: state.pendingAdd,
      itemCount: state.items.reduce((s, i) => s + i.quantity, 0),
      totalAmount: state.items.reduce((s, i) => s + i.price * i.quantity, 0),
      addItem,
      removeItem,
      clearCart,
      confirmReplaceCart,
      cancelPendingAdd,
      getItemQuantity,
    }),
    [state.items, state.pendingAdd, addItem, removeItem, clearCart, confirmReplaceCart, cancelPendingAdd, getItemQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
