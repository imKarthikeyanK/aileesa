---
description: "Use when creating or modifying React Context providers, reducers, hooks, or state logic. Covers Context pattern, useReducer conventions, and context value memoization."
applyTo: "src/context/**"
---

# State Management Conventions

## Context Pattern (always the same structure)
```js
const XxxContext = createContext(null);

export function XxxProvider({ children }) {
  // State logic here
  return <XxxContext.Provider value={value}>{children}</XxxContext.Provider>;
}

export function useXxx() {
  const ctx = useContext(XxxContext);
  if (!ctx) throw new Error('useXxx must be used inside <XxxProvider>.');
  return ctx;
}
```

## useReducer Pattern
- Use `useReducer` for complex state (CartContext, LocationContext)
- Define `INITIAL_STATE` outside the component
- Reducer function handles all `action.type` cases with a `default: return state`
- Export dispatch actions as `useCallback` memoized functions from the provider

## Context Value Memoization
- Wrap the context value object in `useMemo` with proper dependency array
- Prevent unnecessary re-renders — consumers depend on stable references

## Auth Flow
- **Login**: `sendOtp(phone)` → `verifyOtp(requestId, otp, displayName?)`
- **Token refresh**: Proactive 2-min-before-expiry via `setTimeout` timer
- **Storage**: SecureStore (native) / AsyncStorage (web) via `TokenStorage` adapter
- **Bootstrap**: On app start, validate stored refresh token → restore session or silent logout
- **Headers sync**: Call `setAuthState()` on user change via `useEffect`

## Location Flow
- **Phase 1 (Splash)**: Permission request only (`idle → requesting → done`)
- **Phase 2 (SLP)**: GPS → serviceability check (`locating → checking → done/error`)
- **Coordinate priority**: explicit coords → active address coords → GPS cache → fresh GPS
- **Flash**: 15s cooldown for normal refreshes; `priority: 'critical'` bypasses cooldown

## Cart Flow
- **Single-store enforcement**: Cross-store adds go to `pendingAdd` → conflict modal
- **Persistence**: AsyncStorage (native), localStorage (web), key `aileesa_cart`
- **Hydration**: On mount, load from storage; persist on every `items` change
- **Reducer actions**: ADD_ITEM, REMOVE_ITEM, CONFIRM_REPLACE, CANCEL_PENDING_ADD, CLEAR_CART, HYDRATE
