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
 *   flush()                    → void   Force-send queued events (optional, safe to omit)
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
 * Navigation
 *   screen_viewed          { screen_name }  — fired via Analytics.screen()
 *
 * Discovery
 *   store_listing_viewed   { store_count }
 *   store_card_tapped      { store_id, store_name, list_position, is_open }
 *   store_detail_viewed    { store_id, store_name, is_open }
 *   category_tab_tapped    { store_id, category_name, tab_index }
 *   view_cart_cta_clicked  { source, store_id, item_count, total_amount }
 *
 * Cart
 *   item_added             { item_id, item_name, store_id, price, quantity, is_multi_add }
 *   item_removed           { item_id, store_id, quantity }
 *   cart_conflict_shown    { existing_store_id, existing_store_name, new_store_id, new_store_name }
 *   cart_conflict_resolved { action, existing_store_id, new_store_id }   // action: 'replaced' | 'cancelled'
 *   cart_viewed            { store_id, item_count, subtotal, grand_total, is_free_delivery }
 *
 * Checkout (critical path)
 *   place_order_cta_clicked { store_id, item_count, sub_total, delivery_fee, platform_fee, grand_total, payment_method, auth_state, has_address }
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

import { Platform } from 'react-native';
import PostHogProvider from './analyticsProviders/posthog';

// ─── Active provider ───────────────────────────────────────────────────────────
// Swap this import to change the analytics backend. Contract must be satisfied.
const ACTIVE_PROVIDER = PostHogProvider;

// ─── Global event params (always attached to track/screen events) ───────────
const _globalParams = {
  user_id: null,
  platform: Platform.OS ?? null,
  traffic_source: null,
  campaign_name: null,
};

// Best-effort attribution capture for web (UTM/deep-link style query params).
if (Platform.OS === 'web' && typeof globalThis?.location?.search === 'string') {
  try {
    const q = new URLSearchParams(globalThis.location.search);
    _globalParams.traffic_source = q.get('traffic_source') ?? q.get('utm_source') ?? null;
    _globalParams.campaign_name = q.get('campaign_name') ?? q.get('utm_campaign') ?? null;
  } catch {
    // No-op; defaults stay null.
  }
}

function withGlobalParams(properties) {
  return {
    user_id: _globalParams.user_id ?? null,
    platform: _globalParams.platform ?? null,
    traffic_source: _globalParams.traffic_source ?? null,
    campaign_name: _globalParams.campaign_name ?? null,
    ...(properties ?? {}),
  };
}

// ─── Public facade ─────────────────────────────────────────────────────────────
export const Analytics = {
  /** Update global analytics params (null when absent). */
  setGlobalParams(params = {}) {
    if (Object.prototype.hasOwnProperty.call(params, 'user_id')) {
      _globalParams.user_id = params.user_id ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'platform')) {
      _globalParams.platform = params.platform ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'traffic_source')) {
      _globalParams.traffic_source = params.traffic_source ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'campaign_name')) {
      _globalParams.campaign_name = params.campaign_name ?? null;
    }
  },

  /** Convenience setter for current authenticated user id. */
  setUserId(userId) {
    _globalParams.user_id = userId ?? null;
  },

  /**
   * Track a named event with optional properties.
   * @param {string} event
   * @param {Record<string, unknown>} [properties]
   */
  track(event, properties) {
    try {
      ACTIVE_PROVIDER.track(event, withGlobalParams(properties));
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
      _globalParams.user_id = userId ?? null;
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
      _globalParams.user_id = null;
      ACTIVE_PROVIDER.reset();
      // Ensure the reset event reaches the server immediately.
      ACTIVE_PROVIDER.flush?.();
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
      ACTIVE_PROVIDER.screen(name, withGlobalParams(properties));
    } catch {
      // Analytics must never crash the app.
    }
  },

  /**
   * Force-flush any queued events. Call before app background or
   * critical transitions to prevent data loss.
   */
  flush() {
    try {
      ACTIVE_PROVIDER.flush?.();
    } catch {
      // Analytics must never crash the app.
    }
  },
};
