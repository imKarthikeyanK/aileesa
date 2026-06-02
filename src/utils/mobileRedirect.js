import { Platform } from 'react-native';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.aileesa.app';

/**
 * Handles cross-platform fallbacks when standard deep links land in the browser:
 * - Android → Force redirect straight to the Play Store.
 * - iOS     → Keep them on the web experience (Do nothing, let the web app load).
 * - Desktop → Keep them on the web experience.
 */
export function redirectMobileToStore() {
  // Guard clause: Only run this execution layer on the Web build
  if (Platform.OS !== 'web') return;

  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const isAndroid = /android/i.test(ua);

  if (isAndroid) {
    // Instantly replace the browser history state with the Play Store target
    window.location.replace(PLAY_STORE_URL);
  }
  
  // Notice: We completely removed the iOS check here.
  // By doing nothing on iOS and Desktop, the browser naturally falls through
  // and renders your React Native Web application normally, just like you wanted!
}
