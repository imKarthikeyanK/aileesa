/**
 * LocationContext.js — Global location & serviceability state
 *
 * Status lifecycle:
 *   idle → requesting → locating → checking → done
 *                    ↘ denied (permission refused)
 *             (any step) → error
 *
 * Exposes via useLocation():
 *   status          — current lifecycle stage
 *   coords          — { latitude, longitude } | null
 *   serviceability  — { serviceable, city, zone, message } | null
 *   permissionStatus — 'granted' | 'denied' | 'undetermined' | null
 *   errorMessage    — string | null
 *   retryLocation   — () => void  (re-runs the whole flow)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
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

  const run = useCallback(async () => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_STATUS', payload: 'requesting' });

    // ── Step 1: Request OS permission ────────────────────────────────────────
    let permStatus;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      permStatus = status;
      dispatch({ type: 'SET_PERMISSION', payload: status });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to request location permission.' });
      return;
    }

    if (permStatus !== 'granted') {
      dispatch({ type: 'SET_STATUS', payload: 'denied' });
      return;
    }

    // ── Step 2: Get GPS coordinates ──────────────────────────────────────────
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
      dispatch({ type: 'SET_ERROR', payload: 'Could not determine your location. Please try again.' });
      return;
    }

    // ── Step 3: Check serviceability ─────────────────────────────────────────
    dispatch({ type: 'SET_STATUS', payload: 'checking' });
    try {
      const result = await checkServiceability(coords);
      dispatch({ type: 'SET_SERVICEABILITY', payload: result });
      dispatch({ type: 'SET_STATUS', payload: 'done' });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Could not verify service availability. Please try again.' });
    }
  }, []);

  // Run once on mount
  useEffect(() => { run(); }, []);

  return (
    <LocationCtx.Provider value={{ ...state, retryLocation: run }}>
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
