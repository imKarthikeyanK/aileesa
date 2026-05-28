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

const NON_SERVICEABLE_FALLBACK = {
  serviceable: false,
  city: null,
  zone: null,
  message: "We're not in your city yet. Coming soon!",
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
  const appStateRef = useRef(AppState.currentState);
  const serviceabilityRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const inFlightPromiseRef = useRef(null);
  const lastFlashAtRef = useRef(0);

  useEffect(() => {
    serviceabilityRef.current = state.serviceability;
  }, [state.serviceability]);

  // ── Central flash refresh helper (used by startup + checkpoints) ─────────
  // priority: 'normal' obeys cooldown, 'critical' bypasses cooldown.
  const runServiceabilityCheck = useCallback(async ({ reason = 'manual', force = false, priority = 'normal' } = {}) => {
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

      let coords;
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          latitude:  position.coords.latitude,
          longitude: position.coords.longitude,
        };
        dispatch({ type: 'SET_COORDS', payload: coords });
      } catch {
        dispatch({ type: 'SET_SERVICEABILITY', payload: NON_SERVICEABLE_FALLBACK });
        dispatch({ type: 'SET_FLASH_META', payload: { reason, updatedAt: now } });
        dispatch({ type: 'SET_STATUS', payload: 'done' });
        return NON_SERVICEABLE_FALLBACK;
      }

      dispatch({ type: 'SET_STATUS', payload: 'checking' });
      try {
        const result = await checkServiceability(coords);
        dispatch({ type: 'SET_SERVICEABILITY', payload: result });
        dispatch({ type: 'SET_FLASH_META', payload: { reason, updatedAt: now } });
        dispatch({ type: 'SET_STATUS', payload: 'done' });
        return result;
      } catch {
        dispatch({ type: 'SET_SERVICEABILITY', payload: NON_SERVICEABLE_FALLBACK });
        dispatch({ type: 'SET_FLASH_META', payload: { reason, updatedAt: now } });
        dispatch({ type: 'SET_STATUS', payload: 'done' });
        return NON_SERVICEABLE_FALLBACK;
      } finally {
        dispatch({ type: 'SET_FLASH_REFRESHING', payload: false });
        refreshInFlightRef.current = false;
        lastFlashAtRef.current = now;
      }
    })();

    inFlightPromiseRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      inFlightPromiseRef.current = null;
    }
  }, []);

  const refreshFlashCritical = useCallback(
    async ({ reason = 'critical_checkpoint' } = {}) => runServiceabilityCheck({ reason, priority: 'critical' }),
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
