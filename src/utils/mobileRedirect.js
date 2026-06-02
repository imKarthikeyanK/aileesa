import { Platform } from 'react-native';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.aileesa.app';
const APP_STORE_URL =
  'https://apps.apple.com/app/aileesa/id000000000'; // replace with real Apple ID

/**
 * On web, detect if the visitor is on a mobile device that doesn't have the
 * app installed (the OS fell back to the browser instead of intercepting the
 * App Link / Universal Link).
 *
 * - Android → Play Store
 * - iOS     → App Store
 * - Desktop → do nothing (serve the web app as-is)
 *
 * Call this once at startup (e.g. in App.js or a top-level useEffect).
 */
export function redirectMobileToStore() {
  // Only run on the web platform
  if (Platform.OS !== 'web') return;

  const ua = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    window.location.replace(PLAY_STORE_URL);
  } else if (isIOS) {
    window.location.replace(APP_STORE_URL);
  }
  // Desktop / other → fall through and render the web app normally
}
