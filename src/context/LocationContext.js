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
  useReducer,
} from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { checkServiceability } from '../api/locationApi';

// ─── State shape ───────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  status:           'idle',        // 'idle' | 'requesting' | 'locating' | 'checking' | 'done' | 'denied' | 'error'
  coords:           null,          // { latitude, longitude } | null
  serviceability:   null,          // { serviceable, city, zone, message } | null
  permissionStatus: null,          // 'granted' | 'denied' | 'undetermined' | null
  errorMessage:     null,          // string | null
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_COORDS':
      return { ...state, coords: action.payload };
    case 'SET_SERVICEABILITY':
      return { ...state, serviceability: action.payload };
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

  // ── Phase 1: request OS permission only (called by SplashScreen on mount) ──
  const requestPermission = useCallback(async () => {
    dispatch({ type: 'SET_STATUS',       payload: 'requesting' });
    dispatch({ type: 'SET_PERMISSION',   payload: null });
    dispatch({ type: 'SET_SERVICEABILITY', payload: null });
    dispatch({ type: 'SET_COORDS',       payload: null });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      dispatch({ type: 'SET_PERMISSION', payload: status });
    } catch {
      // On web without HTTPS, the call throws — treat as denied so Splash proceeds
      dispatch({ type: 'SET_PERMISSION', payload: 'denied' });
    }

    // Always mark done so SplashScreen transitions regardless of the outcome
    dispatch({ type: 'SET_STATUS', payload: 'done' });
  }, []);

  // ── Phase 2: GPS coords + serviceability check (called by SLP on mount) ────
  const runServiceabilityCheck = useCallback(async () => {
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
      const msg = Platform.OS === 'web'
        ? 'Could not determine your location. Ensure location services are enabled in your browser and the page is loaded over HTTPS.'
        : 'Could not determine your location. Please try again.';
      dispatch({ type: 'SET_ERROR', payload: msg });
      return;
    }

    dispatch({ type: 'SET_STATUS', payload: 'checking' });
    try {
      const result = await checkServiceability(coords);
      dispatch({ type: 'SET_SERVICEABILITY', payload: result });
      dispatch({ type: 'SET_STATUS', payload: 'done' });
    } catch {
      // Safety net: if the API layer throws unexpectedly, treat as non-serviceable.
      dispatch({
        type: 'SET_SERVICEABILITY',
        payload: {
          serviceable: false,
          city: null,
          zone: null,
          message: "We're not in your city yet. Coming soon!",
        },
      });
      dispatch({ type: 'SET_STATUS', payload: 'done' });
    }
  }, []);

  // Run permission request once on app start (Splash observes this)
  useEffect(() => { requestPermission(); }, []);

  return (
    <LocationCtx.Provider value={{ ...state, requestPermission, runServiceabilityCheck }}>
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
