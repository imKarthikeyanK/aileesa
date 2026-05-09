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
  useMemo,
  useReducer,
} from 'react';

const CartContext = createContext(null);

// pendingAdd: { item } | null  — set when a cross-store add is attempted
const initialState = { items: [], pendingAdd: null };

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

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

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
