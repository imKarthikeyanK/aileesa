/**
 * CartContext.js — Global cart state with reducer pattern.
 *
 * Cart items carry storeId + storeName so the cart can hold items
 * from multiple stores and the CartScreen can group them.
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

const initialState = { items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const incoming = action.item;
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
      itemCount: state.items.reduce((s, i) => s + i.quantity, 0),
      totalAmount: state.items.reduce((s, i) => s + i.price * i.quantity, 0),
      addItem,
      removeItem,
      clearCart,
      getItemQuantity,
    }),
    [state.items, addItem, removeItem, clearCart, getItemQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
