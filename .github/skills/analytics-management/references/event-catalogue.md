# Aileesa Analytics Event Catalogue

> **Keep this in sync with the JSDoc in `src/api/analytics.js`.**  
> When adding a new event, update both this file and the JSDoc.

---

## Auth

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `auth_sheet_opened` | `{ source }` | `AuthSheet.js` | Auth bottom sheet opens |
| `otp_requested` | `{ channel }` | `AuthContext.js` | User requests OTP |
| `otp_verified` | `{ is_new_user }` | `AuthContext.js` | OTP verification succeeds |
| `otp_failed` | `{ error_code, channel }` | `AuthSheet.js` | OTP verification fails |
| `logout` | — | `AuthContext.js` | User logs out |

---

## Navigation

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `screen_viewed` | `{ screen_name, ... }` | Per-screen `useEffect` / `useFocusEffect` | Screen gains focus |
| _Fire via `Analytics.screen(name, props)` — the provider translates this to `screen(name, ...)`_ | | |

| Screen | `Analytics.screen()` Call | Location |
|--------|--------------------------|----------|
| Store Listing | `Analytics.screen('store_listing', { store_count })` | `StoreListingScreen.js` — on first data load |
| Store Detail | `Analytics.screen('store_detail', { store_id, store_name })` | `StoreDetailScreen.js` — on mount |
| Cart | `Analytics.screen('cart', { item_count, auth_state })` | `CartScreen.js` — in focus effect |
| Order Success | `Analytics.screen('order_success', { order_id, display_id })` | `OrderSuccessScreen.js` — on mount |
| Order History | `Analytics.screen('order_history', { order_count })` | `OrderHistoryScreen.js` — on data load |
| You (Profile) | `Analytics.screen('you', { is_authenticated })` | `YouScreen.js` — on mount |
| Explore | `Analytics.screen('explore')` | `ExploreScreen.js` — on mount |

---

## Discovery

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `store_listing_viewed` | `{ store_count }` | `StoreListingScreen.js` | First page of stores loads |
| `store_card_tapped` | `{ store_id, store_name, list_position, is_open }` | `StoreListingScreen.js` | User taps a store card |
| `store_detail_viewed` | `{ store_id, store_name, is_open }` | `StoreDetailScreen.js` | Store detail page loads |
| `category_tab_tapped` | `{ store_id, category_name, tab_index }` | `StoreDetailScreen.js` | User switches category tab |
| `view_cart_cta_clicked` | `{ source, store_id, item_count, total_amount }` | `CartFloatingCard.js` | User taps floating cart CTA |

> `source` values: `'store_list_page'`, `'product_list_page'`

---

## Cart

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `item_added` | `{ item_id, item_name, store_id, price, quantity, is_multi_add }` | `StoreDetailScreen.js` | User adds item to cart |
| `item_removed` | `{ item_id, store_id, quantity }` | `StoreDetailScreen.js` | User removes item from cart |
| `cart_conflict_shown` | `{ existing_store_id, existing_store_name, new_store_id, new_store_name }` | `CartConflictModal.js` | Cross-store add detected |
| `cart_conflict_resolved` | `{ action, existing_store_id, new_store_id }` | `CartConflictModal.js` | User chooses replace or cancel |
| `cart_viewed` | `{ store_id, item_count, subtotal, grand_total, is_free_delivery }` | `CartScreen.js` | Cart page loads with fresh flash data |

> `cart_conflict_resolved.action`: `'replaced'` | `'cancelled'`

---

## Checkout (Critical Path)

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `place_order_cta_clicked` | `{ store_id, item_count, sub_total, delivery_fee, platform_fee, grand_total, payment_method, auth_state, has_address }` | `CartScreen.js` | User taps "Place Order" |
| `checkout_initiated` | `{ store_id, item_count, grand_total, auth_state }` | `CartScreen.js` | User enters the checkout flow |
| `address_picker_opened` | `{ source }` | `CartScreen.js` | Address selection sheet opens |
| `order_placed` | `{ order_id, display_id, store_id, item_count, grand_total, payment_method }` | `CartScreen.js` | Order API call succeeds |
| `order_place_failed` | `{ store_id, error_code, grand_total }` | `CartScreen.js` | Order API call fails |

---

## Post-Order

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `order_success_viewed` | `{ order_id, display_id }` | `OrderSuccessScreen.js` | Order success confirmation screen |
| `order_history_viewed` | `{ order_count }` | `OrderHistoryScreen.js` | Order history list loads |
| `order_detail_viewed` | `{ order_id, order_status }` | `BookingDetailScreen.js` | Single order detail loads |

---

## Location

| Event | Properties | Where Fired | Trigger |
|-------|-----------|-------------|---------|
| `serviceability_failed` | `{ reason }` | `LocationContext.js` | Flash/GPS check fails |

---

## Adding a New Event Checklist

- [ ] Event name follows `{category}_{past_tense_verb}` snake_case
- [ ] Event is tracked via `Analytics.track()` — never PostHog directly
- [ ] Properties include relevant identifiers (`*_id` fields)
- [ ] Properties include state context (`auth_state`, `is_open`, etc.)
- [ ] Properties are snake_case, matching backend conventions
- [ ] `Analytics.screen()` is called if this is a screen view
- [ ] Event is added to this catalogue file
- [ ] Event is added to the JSDoc in `src/api/analytics.js`
- [ ] No duplicate event already exists covering the same action
- [ ] If firing from a reusable component, check parent screens aren't also firing it
