/**
 * requestHeaders.js — Builds the standard x-oz-* request headers for every
 * backend call.
 *
 * Usage (in any API module's real fetch path):
 *
 *   import { getHeaders } from './requestHeaders';
 *
 *   const res = await fetch(url, {
 *     method: 'POST',
 *     headers: getHeaders({ accessToken }),   // merges x-oz-* + Content-Type + Bearer
 *     body: JSON.stringify(payload),
 *   });
 *
 * Auth state sync:
 *   Call setAuthState({ uid, loggedIn }) from AuthContext whenever the user
 *   logs in or out so x-oz-uid / x-oz-loggedin are always accurate.
 *
 *   import { setAuthState } from '../api/requestHeaders';
 *   // inside AuthContext, after verifyOtp:
 *   setAuthState({ uid: user.id, loggedIn: true });
 *   // inside _clearSession:
 *   setAuthState({ uid: null, loggedIn: false });
 */

import { Platform, Dimensions, PixelRatio } from 'react-native';
import * as Application from 'expo-application';
import { APP_NAME, APP_VERSION, BUILD_NUMBER } from './buildConfig';

// ─── Auth state (kept in sync by AuthContext) ─────────────────────────────────
let _authState = { uid: null, loggedIn: false };

/** Called by AuthContext on login / logout so headers stay accurate. */
export function setAuthState({ uid, loggedIn }) {
  _authState = { uid: uid ?? null, loggedIn: !!loggedIn };
}

// ─── Device ID — resolved once at module load time ────────────────────────────
// Stored as a Promise so concurrent calls await the same resolution.
const _deviceIdPromise = (async () => {
  try {
    if (Platform.OS === 'ios') {
      return (await Application.getIosIdForVendorAsync()) ?? 'unknown';
    }
    if (Platform.OS === 'android') {
      return Application.getAndroidId() ?? 'unknown';
    }
    // Web: best-effort fingerprint from navigator
    if (typeof navigator !== 'undefined') {
      return `web_${navigator.userAgent.length}_${(navigator.hardwareConcurrency ?? 0)}`;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
})();

// Eagerly start resolution; result is cached after first await.
let _cachedDeviceId = 'unknown';
_deviceIdPromise.then((id) => { _cachedDeviceId = id; });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the host OS when running on web (ios/android/mac/windows/linux). */
function _webDevicePlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua))             return 'android';
  if (/iphone|ipad|ipod/.test(ua))    return 'ios';
  if (/macintosh|mac os x/.test(ua))  return 'mac';
  if (/windows/.test(ua))             return 'windows';
  if (/linux/.test(ua))               return 'linux';
  return 'unknown';
}

/**
 * Returns the actual OS the app is running on, normalised to a lowercase
 * string that matches the x-oz-platform-os header convention:
 *   ios | android | macos | windows | linux | unknown
 *
 * On native this is derived from Platform.OS.
 * On web it is derived from the UA string (same logic as _webDevicePlatform
 * but uses 'macos' instead of 'mac' for clarity).
 */
function _platformOs() {
  if (Platform.OS === 'ios')     return 'ios';
  if (Platform.OS === 'android') return 'android';
  // web — detect the host machine's OS from the UA string
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua))            return 'android';
  if (/iphone|ipad|ipod/.test(ua))   return 'ios';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/windows/.test(ua))            return 'windows';
  if (/linux/.test(ua))              return 'linux';
  return 'unknown';
}

/** Two-letter country code derived from the device locale (e.g. 'IN', 'US'). */
function _countryCode() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    // locale is typically 'en-IN' or 'en-US' — grab the region tag
    const parts = locale.split('-');
    const region = parts[parts.length - 1];
    // Only return if it looks like a two-letter country code
    return /^[A-Z]{2}$/.test(region) ? region : 'IN';
  } catch {
    return 'IN';
  }
}

/** IANA timezone string (e.g. 'Asia/Kolkata'). */
function _timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a headers object containing:
 *  • Content-Type: application/json
 *  • Authorization: Bearer <token>  (when accessToken is supplied)
 *  • x-oz-app-name, x-oz-app-ver, x-oz-app-ver-int
 *  • x-oz-platform, x-oz-os-version, x-oz-device-id, x-oz-system-id
 *  • x-oz-screen-size, x-oz-screen-density
 *  • x-oz-country-code, x-oz-tz
 *  • x-oz-uid, x-oz-loggedin
 *  • x-oz-platform-os  (always — actual OS: ios | android | macos | windows | linux)
 *  • x-oz-device-platform  (web only — host OS of the browser, legacy)
 *
 * This function is synchronous and uses the cached device ID resolved at
 * startup.  If you need the resolved device ID before the first request, await
 * ensureDeviceId() first (optional — useful for health-check pings).
 *
 * @param {{ accessToken?: string }} [opts]
 */
export function getHeaders({ accessToken } = {}) {
  const platform  = Platform.OS;                            // 'ios' | 'android' | 'web'
  const osVersion = String(Platform.Version);
  const screen    = Dimensions.get('screen');

  const headers = {
    'Content-Type':          'application/json',
    'x-oz-app-name':         APP_NAME,
    'x-oz-app-ver':          APP_VERSION,
    'x-oz-app-ver-int':      String(BUILD_NUMBER),
    'x-oz-platform':         platform,
    'x-oz-os-version':       osVersion,
    'x-oz-device-id':        _cachedDeviceId,
    'x-oz-system-id':        `${platform}_${osVersion}`,
    'x-oz-screen-size':      `${Math.round(screen.width)}x${Math.round(screen.height)}`,
    'x-oz-screen-density':   String(PixelRatio.get()),
    'x-oz-country-code':     _countryCode(),
    'x-oz-tz':               _timezone(),
    'x-oz-uid':              _authState.uid ?? '',
    'x-oz-loggedin':         String(_authState.loggedIn),
    'x-oz-platform-os':      _platformOs(),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    headers['x-oz-token']    = accessToken;
  }

  if (platform === 'web') {
    headers['x-oz-device-platform'] = _webDevicePlatform();
  }

  return headers;
}

/**
 * Awaits the device ID resolution.  Call this at app startup (e.g. in App.js)
 * if you want to guarantee x-oz-device-id is populated for the very first
 * request.  Subsequent calls are instant (Promise already resolved).
 */
export async function ensureDeviceId() {
  _cachedDeviceId = await _deviceIdPromise;
}
