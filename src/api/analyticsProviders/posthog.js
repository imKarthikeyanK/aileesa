/**
 * analyticsProviders/posthog.js — PostHog adapter
 *
 * Implements the Analytics provider contract:
 *   track(event, properties)
 *   identify(userId, traits)
 *   reset()
 *   screen(name, properties)
 *   flush()
 *
 * To swap providers, create a new file in this directory following the same
 * contract and update ACTIVE_PROVIDER in analytics.js.
 */

import { AppState } from 'react-native';
import PostHog from 'posthog-react-native';
import { POSTHOG_API_KEY, POSTHOG_HOST, IS_DEV } from '../env';

// ─── Singleton client ─────────────────────────────────────────────────────────
// Initialised once at module load. Disabled when no key is configured.
const client = new PostHog(POSTHOG_API_KEY || 'phc_placeholder', {
  host: POSTHOG_HOST,
  disabled: !POSTHOG_API_KEY,
  // Flush immediately in dev; batch in production (every 20 events or 10s).
  flushAt: IS_DEV ? 1 : 20,
  flushInterval: IS_DEV ? 0 : 10000,
});

// ─── Flush queued events on app background ──────────────────────────────────
// Prevents event loss when the user backgrounds the app before the batch
// interval fires. No-op when already flushed or client is disabled.
let _appStateSub = null;

function _setupBackgroundFlush() {
  if (_appStateSub) return;
  _appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'background' || nextState === 'inactive') {
      client.flush();
    }
  });
}

// Start listening immediately — safe even if client is disabled (flush is no-op).
_setupBackgroundFlush();

// ─── Provider contract ────────────────────────────────────────────────────────

const PostHogProvider = {
  track(event, properties) {
    client.capture(event, properties);
  },

  identify(userId, traits) {
    client.identify(userId, traits);
  },

  reset() {
    client.reset();
  },

  screen(name, properties) {
    client.screen(name, properties);
  },

  /** Force-flush any queued events. Useful before app background or logout. */
  flush() {
    client.flush();
  },
};

export default PostHogProvider;
