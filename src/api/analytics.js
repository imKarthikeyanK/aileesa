/**
 * analytics.js — Provider-agnostic event instrumentation facade
 *
 * ARCHITECTURE
 * ────────────
 * All screens and contexts call this module — never a vendor SDK directly.
 * To switch analytics providers (PostHog → Mixpanel, Amplitude, etc.):
 *   1. Create src/api/analyticsProviders/<new-provider>.js implementing the contract.
 *   2. Change the import below to the new provider.
 *   That's it — zero changes anywhere else in the app.
 *
 * CONTRACT — every provider must implement:
 *   track(event, properties)   → void   Capture a named event with optional props
 *   identify(userId, traits)   → void   Associate subsequent events with a user
 *   reset()                    → void   Clear identity (on logout)
 *   screen(name, properties)   → void   Record a screen view (optional for web analytics)
 *
 * EVENT CATALOGUE
 * ───────────────
 * Auth
 *   auth_sheet_opened      { source }
 *   otp_requested          { channel }
 *   otp_verified           { is_new_user }
 *   otp_failed             { error_code, channel }
 *   logout
 *
 * Discovery
 *   store_listing_viewed   { store_count }
 *   store_card_tapped      { store_id, store_name, list_position, is_open }
 *   store_detail_viewed    { store_id, store_name, is_open }
 *   category_tab_tapped    { store_id, category_name, tab_index }
 *
 * Cart
 *   item_added             { item_id, item_name, store_id, price, quantity, is_multi_add }
 *   item_removed           { item_id, store_id, quantity }
 *   cart_conflict_shown    { existing_store_id, new_store_id }
 *   cart_conflict_resolved { action }   // 'replaced' | 'cancelled'
 *
 * Checkout (critical path)
 *   cart_viewed            { store_id, item_count, subtotal, grand_total, is_free_delivery }
 *   checkout_initiated     { store_id, item_count, grand_total, auth_state }
 *   address_picker_opened  { source }
 *   order_placed           { order_id, display_id, store_id, item_count, grand_total, payment_method }
 *   order_place_failed     { store_id, error_code, grand_total }
 *
 * Post-order
 *   order_success_viewed   { order_id, display_id }
 *   order_history_viewed   { order_count }
 *   order_detail_viewed    { order_id, order_status }
 *
 * Location
 *   serviceability_failed  { reason }
 */

import PostHogProvider from './analyticsProviders/posthog';

// ─── Active provider ───────────────────────────────────────────────────────────
// Swap this import to change the analytics backend. Contract must be satisfied.
const ACTIVE_PROVIDER = PostHogProvider;

// ─── Public facade ─────────────────────────────────────────────────────────────
export const Analytics = {
  /**
   * Track a named event with optional properties.
   * @param {string} event
   * @param {Record<string, unknown>} [properties]
   */
  track(event, properties) {
    try {
      ACTIVE_PROVIDER.track(event, properties);
    } catch {
      // Analytics must never crash the app.
    }
  },

  /**
   * Associate subsequent events with a user identity.
   * Call after successful login.
   * @param {string} userId
   * @param {Record<string, unknown>} [traits]   e.g. { name, phone }
   */
  identify(userId, traits) {
    try {
      ACTIVE_PROVIDER.identify(userId, traits);
    } catch {
      // Analytics must never crash the app.
    }
  },

  /**
   * Reset user identity. Call on logout.
   */
  reset() {
    try {
      ACTIVE_PROVIDER.reset();
    } catch {
      // Analytics must never crash the app.
    }
  },

  /**
   * Record a screen view.
   * @param {string} name
   * @param {Record<string, unknown>} [properties]
   */
  screen(name, properties) {
    try {
      ACTIVE_PROVIDER.screen(name, properties);
    } catch {
      // Analytics must never crash the app.
    }
  },
};
