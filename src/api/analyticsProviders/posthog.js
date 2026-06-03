/**
 * analyticsProviders/posthog.js — PostHog adapter
 *
 * Implements the Analytics provider contract:
 *   track(event, properties)
 *   identify(userId, traits)
 *   reset()
 *   screen(name, properties)
 *
 * To swap providers, create a new file in this directory following the same
 * contract and update ACTIVE_PROVIDER in analytics.js.
 */

import PostHog from 'posthog-react-native';
import { POSTHOG_API_KEY, POSTHOG_HOST, IS_DEV } from '../env';

// Singleton client — initialised once at module load.
// Disabled when no key is configured (local dev without a PostHog project).
const client = new PostHog(POSTHOG_API_KEY || 'phc_placeholder', {
  host: POSTHOG_HOST,
  disabled: !POSTHOG_API_KEY,
  // Flush immediately in dev; batch in production.
  flushAt: IS_DEV ? 1 : 20,
  flushInterval: IS_DEV ? 0 : 10000,
});

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
};

export default PostHogProvider;
