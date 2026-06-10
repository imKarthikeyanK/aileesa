---
name: aileesa-domain
description: "Domain knowledge for Aileesa local-commerce app. Use when implementing features across the full stack — authentication, location/serviceability, cart/checkout, store listings, order management, and analytics instrumentation. Covers architectural decisions, data flow, and cross-cutting concerns."
argument-hint: "Describe the Aileesa feature or screen you're working on"
user-invocable: true
---

# Aileesa Domain Knowledge

## When to Use
- Implementing or modifying auth flow (OTP, token refresh, session management)
- Working with location permission, GPS, serviceability (flash) checks
- Cart operations (add/remove items, cross-store conflict, persistence)
- Store listing, detail, and inventory screens
- Order placement flow (cart → checkout → success)
- Analytics instrumentation
- Address management (anonymous or authenticated)
- Navigation and deep linking setup

## Architecture Overview

### Data Flow by Feature

**Authentication**
```
Phone → sendOtp(phone) → { requestId, _devOtp }
OTP   → verifyOtp(requestId, code, displayName?) → { accessToken, refreshToken, user }
       → TokenStorage.set() → setAuthState() → Analytics.setUserId()
Refresh → scheduleRefresh(expiresInSec) → 2min-before-expiry timer
Bootstrap → TokenStorage.get(REFRESH) → AuthAPI.refreshAccessToken() → restore user
```

**Location → Serviceability**
```
Splash: requestPermission() → granted/denied → onDone()
SLP:    runServiceabilityCheck() → resolveCoords() → POST /flash
        → { serviceable, city, zone, message, min_order_value, delivery_fee, ... }
Coords priority: explicit > active address > GPS cache (24h) > fresh GPS (5s timeout)
Flash:  normal (15s cooldown) vs critical (bypass cooldown)
```

**Cart → Checkout**
```
addItem(item): single-store guard → pendingAdd if cross-store
               → CartConflictModal → confirmReplaceCart() | cancelPendingAdd()
Checkout: CartScreen → address picker → placeOrder() → OrderSuccess
Flash values (min_order_value, delivery_fee, free_delivery_above) from LocationContext
```

### Context Interaction Map
```
AuthContext → (user, isAuthenticated, tokens)
    ↓
AddressContext → (selectedAddress, addresses)  ← uses AuthContext.isAuthenticated
    ↓
LocationContext → (coords, serviceability, flash)  ← gets activeAddrCoords from AddressContext
    ↓
CartContext → (items, pendingAdd, totalAmount)  ← independent, typed persistence
```

### Navigation Hierarchy
```
Tab Navigator (Market, Explore, You)
├── Market Stack
│   ├── StoreListing (L1)  — tab visible, collapsible header, paginated FlatList
│   ├── StoreDetail (L2)   — tab hidden, parallax hero, sectioned inventory
│   ├── Cart (L2)          — tab hidden, scrollable review + sticky CTA
│   ├── OrderSuccess (L2)  — confirmation screen, gesture disabled
│   ├── BookingDetail (L2) — order tracking
│   └── LocationPicker (L2) — slideFromBottom, address entry form
├── Explore (L1)           — placeholder (ComingSoon)
└── You Stack
    ├── YouHome (L1)       — profile, auth gate, settings
    ├── OrderHistory (L1/L2) — order list with status pills
    └── BookingDetail (L2) — shared with Market stack
```

### Deep Linking Patterns
```
Universal links: https://www.aileesa.com/market, https://aileesa.com/store/:storeId
Custom scheme:   aileesa://cart, aileesa://orders/:orderId
Dev mode also:   http://localhost:8081
```

## Cross-Cutting Concerns

### Analytics Event Categories
Every user-facing action must be tracked:
- **Auth**: `auth_sheet_opened`, `otp_requested`, `otp_verified`, `otp_failed`, `logout`
- **Discovery**: `store_listing_viewed`, `store_card_tapped`, `store_detail_viewed`, `category_tab_tapped`
- **Cart**: `item_added`, `item_removed`, `cart_conflict_shown`, `cart_conflict_resolved`
- **Checkout**: `cart_viewed`, `checkout_initiated`, `address_picker_opened`, `order_placed`, `order_place_failed`
- **Post-order**: `order_success_viewed`, `order_history_viewed`, `order_detail_viewed`
- **Location**: `serviceability_failed`

### Platform-Specific Behaviors
| Concern | Native | Web |
|---------|--------|-----|
| Token storage | SecureStore (encrypted) | AsyncStorage / localStorage |
| Cart persistence | AsyncStorage | localStorage |
| Location | Expo Location API | Geolocation API (when available) |
| Tab bar hide | slide down | slide down + 200dp overshoot |
| Deep links | Universal links + intent filters | URL pattern matching |
| Navigation animation | slide_from_right | none (to avoid flicker) |

### Error Handling Patterns
- API errors: `{ code, message }` object thrown from service layer
- Network errors: Caught by httpClient, re-thrown
- Token errors: `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `INVALID_TOKEN` codes
- OTP errors: `INVALID_OTP`, `OTP_EXPIRED` — specific user-facing messages
- Serviceability errors: Graceful fallback with `locationUnavailable` flag
- Toast notifications for transient errors; modals for blocking issues

## Reference Files
- Design tokens: `src/theme/theme.js`
- Environment config: `src/api/env.js`
- Mock fixtures: `src/api/mockData.js`
- Analytics events catalogue (in JSDoc): `src/api/analytics.js`
