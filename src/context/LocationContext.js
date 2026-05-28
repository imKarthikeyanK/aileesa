/**
 * LocationContext.js — Global location & serviceability state
 *
 * Status lifecycle:
 *   Phase 1 (Splash):  idle → requesting → done
 *   Phase 2 (SLP):     done → locating → checking → done | error
 *
 * Exposes via useLocation():
 *   status            — current lifecycle stage
 *   coords            — { latitude, longitude } | null
 *   serviceability    — { serviceable, city, zone, message } | null
 *   permissionStatus  — 'granted' | 'denied' | 'undetermined' | null
 *   errorMessage      — string | null
 *   requestPermission       — () => void  Phase 1: request OS permission (called by Splash)
 *   runServiceabilityCheck  — () => void  Phase 2: GPS + serviceability (called by SLP)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useReducer,
} from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { checkServiceability } from '../api/locationApi';

// ─── State shape ───────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  status:           'idle',        // 'idle' | 'requesting' | 'locating' | 'checking' | 'done' | 'denied' | 'error'
  coords:           null,          // { latitude, longitude } | null
  serviceability:   null,          // { serviceable, city, zone, message } | null
  flashReason:      null,          // string | null
  flashUpdatedAt:   null,          // number | null (epoch ms)
  isFlashRefreshing: false,        // boolean
  permissionStatus: null,          // 'granted' | 'denied' | 'undetermined' | null
  errorMessage:     null,          // string | null
};

const FLASH_THROTTLE_MS = 15000;
const GPS_TIMEOUT_MS    = 5000;
const GPS_CACHE_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours — reuse GPS fix for anonymous users

const NON_SERVICEABLE_FALLBACK = {
  serviceable: false,
  city: null,
  zone: null,
  message: "We're not in your city yet. Coming soon!",
};

const LOCATION_UNAVAILABLE_FALLBACK = {
  serviceable: false,
  locationUnavailable: true,   // distinguishes GPS failure from area non-serviceable
  city: null,
  zone: null,
  message: 'Unable to fetch your location. Please enable GPS and try again.',
};

/*
 * Flash checkpoint policy:
 * - Normal refresh (refreshFlash / runServiceabilityCheck): use for passive checkpoints
 *   like app foreground, where cooldown is acceptable.
 * - Critical refresh (refreshFlashCritical): use for decision-critical moments where UI
 *   must reflect fresh eligibility before action/render (cart open, address change, manual retry).
 * - PLP/SLP browsing should stay decoupled from flash churn and should not trigger automatic
 *   refreshes unless explicitly user-initiated.
 */

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_COORDS':
      return { ...state, coords: action.payload };
    case 'SET_SERVICEABILITY':
      return { ...state, serviceability: action.payload };
    case 'SET_FLASH_META':
      return {
        ...state,
        flashReason: action.payload?.reason ?? null,
        flashUpdatedAt: action.payload?.updatedAt ?? null,
      };
    case 'SET_FLASH_REFRESHING':
      return { ...state, isFlashRefreshing: !!action.payload };
    case 'SET_PERMISSION':
      return { ...state, permissionStatus: action.payload };
    case 'SET_ERROR':
      return { ...state, status: 'error', errorMessage: action.payload };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

const LocationCtx = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LocationProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const appStateRef        = useRef(AppState.currentState);
  const serviceabilityRef  = useRef(null);
  const refreshInFlightRef = useRef(false);
  const inFlightPromiseRef = useRef(null);
  const lastFlashAtRef     = useRef(0);
  // Persists the most recent GPS fix so repeated flash calls don't re-hit GPS
  const gpsCacheRef        = useRef({ coords: null, fetchedAt: 0 });
  // Registered by AddressContext — holds the auth user's selected address coords
  // so every flash checkpoint (including app foreground) uses them automatically.
  const activeAddrCoordsRef = useRef(null);

  // Called by AddressContext whenever selectedAddress changes.
  // Clears to null when user logs out or has no valid address.
  const setActiveAddressCoords = useCallback((coords) => {
    activeAddrCoordsRef.current =
      coords?.latitude != null && coords?.longitude != null ? coords : null;
  }, []);

  useEffect(() => {
    serviceabilityRef.current = state.serviceability;
  }, [state.serviceability]);

  const getCurrentPositionWithTimeout = useCallback(async () => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('GPS timeout'));
      }, GPS_TIMEOUT_MS);

      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((position) => {
          clearTimeout(timer);
          resolve(position);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }, []);

  const resolveCoords = useCallback(async ({ coords } = {}) => {
    // Priority 1 — caller-supplied coords (explicit, e.g. cart flash passing cartFlashCoords)
    if (coords?.latitude != null && coords?.longitude != null) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }

    // Priority 2 — active address coords (auth user's selected delivery address)
    // Registered by AddressContext; updated automatically whenever selectedAddress changes.
    const addrCoords = activeAddrCoordsRef.current;
    if (addrCoords?.latitude != null && addrCoords?.longitude != null) {
      return { latitude: addrCoords.latitude, longitude: addrCoords.longitude };
    }

    // Priority 3 — cached GPS fix from a previous fetch (anonymous users, < 24 hr old)
    const cache = gpsCacheRef.current;
    if (cache.coords != null && (Date.now() - cache.fetchedAt) < GPS_CACHE_TTL_MS) {
      return cache.coords;
    }

    // Priority 4 — acquire a fresh GPS fix and cache it
    try {
      const position = await getCurrentPositionWithTimeout();
      const fresh = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      gpsCacheRef.current = { coords: fresh, fetchedAt: Date.now() };
      return fresh;
    } catch {
      return null;
    }
  }, [getCurrentPositionWithTimeout]);

  // ── Central flash refresh helper (used by startup + checkpoints) ─────────
  // priority: 'normal' obeys cooldown, 'critical' bypasses cooldown.
  const runServiceabilityCheck = useCallback(async ({ reason = 'manual', force = false, priority = 'normal', coords } = {}) => {
    const now = Date.now();
    const bypassCooldown = force || priority === 'critical';

    if (!bypassCooldown && now - lastFlashAtRef.current < FLASH_THROTTLE_MS && serviceabilityRef.current) {
      return serviceabilityRef.current;
    }
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const refreshPromise = (async () => {
      refreshInFlightRef.current = true;
      dispatch({ type: 'SET_FLASH_REFRESHING', payload: true });
      dispatch({ type: 'SET_STATUS', payload: 'locating' });

      try {
        // Step 1 — resolve coordinates (caller-supplied or fresh GPS)
        let resolvedCoords;
        try {
          resolvedCoords = await resolveCoords({ coords });
          if (!resolvedCoords) throw new Error('location_unavailable');
          dispatch({ type: 'SET_COORDS', payload: resolvedCoords });
        } catch {
          dispatch({ type: 'SET_SERVICEABILITY', payload: LOCATION_UNAVAILABLE_FALLBACK });
          dispatch({ type: 'SET_FLASH_META', payload: { reason, updatedAt: now } });
          dispatch({ type: 'SET_STATUS', payload: 'done' });
          lastFlashAtRef.current = now;
          return LOCATION_UNAVAILABLE_FALLBACK;
        }

        // Step 2 — call flash API
        dispatch({ type: 'SET_STATUS', payload: 'checking' });
        try {
          const result = await checkServiceability(resolvedCoords);
          dispatch({ type: 'SET_SERVICEABILITY', payload: result });
          dispatch({ type: 'SET_FLASH_META', payload: { reason, updatedAt: now } });
          dispatch({ type: 'SET_STATUS', payload: 'done' });
          lastFlashAtRef.current = now;
          return result;
        } catch {
          dispatch({ type: 'SET_SERVICEABILITY', payload: NON_SERVICEABLE_FALLBACK });
          dispatch({ type: 'SET_FLASH_META', payload: { reason, updatedAt: now } });
          dispatch({ type: 'SET_STATUS', payload: 'done' });
          lastFlashAtRef.current = now;
          return NON_SERVICEABLE_FALLBACK;
        }
      } finally {
        // Always runs — covers GPS failure, API failure, and success paths
        dispatch({ type: 'SET_FLASH_REFRESHING', payload: false });
        refreshInFlightRef.current = false;
      }
    })();

    inFlightPromiseRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      inFlightPromiseRef.current = null;
    }
  }, [resolveCoords]);

  const refreshFlashCritical = useCallback(
    async ({ reason = 'critical_checkpoint', coords } = {}) => runServiceabilityCheck({ reason, priority: 'critical', coords }),
    [runServiceabilityCheck],
  );

  // ── Phase 1: request OS permission only (called by SplashScreen on mount) ──
  const requestPermission = useCallback(async () => {
    dispatch({ type: 'SET_STATUS',       payload: 'requesting' });
    dispatch({ type: 'SET_PERMISSION',   payload: null });
    dispatch({ type: 'SET_SERVICEABILITY', payload: null });
    dispatch({ type: 'SET_COORDS',       payload: null });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      dispatch({ type: 'SET_PERMISSION', payload: status });

      // Phase 1 bootstrap: once permission is granted, call flash immediately.
      if (status === 'granted') {
        await runServiceabilityCheck({ reason: 'bootstrap', force: true });
        return;
      }
    } catch {
      // On web without HTTPS, the call throws — treat as denied so Splash proceeds
      dispatch({ type: 'SET_PERMISSION', payload: 'denied' });
    }

    // Always mark done so SplashScreen transitions regardless of the outcome
    dispatch({ type: 'SET_STATUS', payload: 'done' });
  }, [runServiceabilityCheck]);

  // Checkpoint: app came back from background/inactive.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (
        /inactive|background/.test(prev) &&
        nextState === 'active' &&
        state.permissionStatus === 'granted'
      ) {
        runServiceabilityCheck({ reason: 'app_foreground' });
      }
    });
    return () => sub.remove();
  }, [state.permissionStatus, runServiceabilityCheck]);

  // Run permission request once on app start (Splash observes this)
  useEffect(() => { requestPermission(); }, []);

  return (
    <LocationCtx.Provider value={{
      ...state,
      requestPermission,
      runServiceabilityCheck,
      refreshFlash: runServiceabilityCheck,
      refreshFlashCritical,
      setActiveAddressCoords,
    }}>
      {children}
    </LocationCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocation() {
  const ctx = useContext(LocationCtx);
  if (!ctx) throw new Error('useLocation must be called inside <LocationProvider>.');
  return ctx;
}
