/**
 * buildConfig.js — App versioning constants.
 *
 * BUILD_NUMBER is an integer that MUST be incremented before every production
 * release (App Store / Play Store submission).  Keep the matching native build
 * numbers in sync when bumping:
 *
 *   iOS     → app.json  expo.ios.buildNumber      (string, e.g. "2")
 *   Android → app.json  expo.android.versionCode  (integer, e.g. 2)
 *
 * APP_VERSION should track the user-visible semantic version in app.json
 * (expo.version).
 *
 * CI tip: replace BUILD_NUMBER with an env var so it can be injected at
 * build time without touching this file:
 *
 *   export const BUILD_NUMBER = Number(process.env.APP_BUILD_NUMBER ?? '1');
 *
 * For environment / base-URL config see src/api/env.js.
 */

export { ENV, BASE_URL, IS_DEV, IS_SBOX, IS_PROD } from './env';

export const APP_NAME    = 'aileesa';
export const APP_VERSION = '1.0.0';

/**
 * Integer build counter — increment once per production release.
 * Never decrement; never reuse values across platforms.
 */
export const BUILD_NUMBER = 1;
