/**
 * AuthContext.js — Global authentication state (JWT + refresh token)
 *
 * TOKEN STORAGE
 * ─────────────
 * Currently uses an in-memory adapter — tokens are lost when the app restarts.
 * To persist sessions, swap TokenStorage for one of these:
 *
 *   // expo-secure-store (recommended — encrypted on device):
 *   import * as SecureStore from 'expo-secure-store';
 *   const TokenStorage = {
 *     get: (key) => SecureStore.getItemAsync(key),
 *     set: (key, val) => SecureStore.setItemAsync(key, val),
 *     del: (key) => SecureStore.deleteItemAsync(key),
 *   };
 *
 *   // @react-native-async-storage/async-storage (unencrypted):
 *   import AsyncStorage from '@react-native-async-storage/async-storage';
 *   const TokenStorage = {
 *     get: (key) => AsyncStorage.getItem(key),
 *     set: (key, val) => AsyncStorage.setItem(key, val),
 *     del: (key) => AsyncStorage.removeItem(key),
 *   };
 *
 * REFRESH STRATEGY
 * ────────────────
 * A timer proactively refreshes the access token 2 minutes before it expires.
 * On bootstrap the refresh token is validated; if it has expired the user is
 * silently logged out and shown the login prompt.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AuthAPI } from '../api/authApi';
import { setAuthState } from '../api/requestHeaders';

// ─── In-memory token storage (swap this object to persist sessions) ───────────
const _mem = {};
const TokenStorage = {
  get: async (key) => _mem[key] ?? null,
  set: async (key, val) => { _mem[key] = val; },
  del: async (key) => { delete _mem[key]; },
};

const KEYS = {
  ACCESS:  'auth.accessToken',
  REFRESH: 'auth.refreshToken',
  USER:    'auth.user',
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null);
  const [isBootstrapping, setBooting]   = useState(true);
  const refreshTimerRef                 = useRef(null);
  const refreshTokenRef                 = useRef(null); // in-memory fast path

  // ── Keep request headers in sync with auth state ──────────────────────────
  useEffect(() => {
    setAuthState({ uid: user?.id ?? null, loggedIn: !!user });
  }, [user]);

  // ── Schedule proactive token refresh ──────────────────────────────────────
  const scheduleRefresh = useCallback((expiresInSec) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 2 minutes before expiry (or immediately if very short-lived)
    const delay = Math.max(0, (expiresInSec - 120) * 1000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const rt = refreshTokenRef.current ?? await TokenStorage.get(KEYS.REFRESH);
        if (!rt) return;

        const { accessToken, refreshToken: newRt, expiresInSec: nextExpiry, user: freshUser } =
          await AuthAPI.refreshAccessToken(rt);

        const writes = [TokenStorage.set(KEYS.ACCESS, accessToken)];

        // Persist rotated refresh token when the backend issues a new one
        if (newRt) {
          refreshTokenRef.current = newRt;
          writes.push(TokenStorage.set(KEYS.REFRESH, newRt));
        }

        await Promise.all(writes);

        if (freshUser) {
          setUser(freshUser);
          await TokenStorage.set(KEYS.USER, JSON.stringify(freshUser));
        }

        scheduleRefresh(nextExpiry);
      } catch {
        // Refresh failed — clear session so user is shown login
        _clearSession();
      }
    }, delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear all auth state ──────────────────────────────────────────────────
  const _clearSession = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTokenRef.current = null;
    setUser(null);
    await Promise.all([
      TokenStorage.del(KEYS.ACCESS),
      TokenStorage.del(KEYS.REFRESH),
      TokenStorage.del(KEYS.USER),
    ]);
  }, []);

  // ── Bootstrap: restore session on app start ───────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [rt, rawUser] = await Promise.all([
          TokenStorage.get(KEYS.REFRESH),
          TokenStorage.get(KEYS.USER),
        ]);

        if (!rt) return; // No stored session

        refreshTokenRef.current = rt;

        // Validate by refreshing — this also gives us a fresh access token
        const { accessToken, refreshToken: newRt, expiresInSec, user: freshUser } =
          await AuthAPI.refreshAccessToken(rt);

        const writes = [TokenStorage.set(KEYS.ACCESS, accessToken)];

        // Persist rotated refresh token when the backend issues a new one
        if (newRt) {
          refreshTokenRef.current = newRt;
          writes.push(TokenStorage.set(KEYS.REFRESH, newRt));
        }

        await Promise.all(writes);

        const resolvedUser = freshUser ?? (rawUser ? JSON.parse(rawUser) : null);
        if (resolvedUser) {
          setUser(resolvedUser);
          await TokenStorage.set(KEYS.USER, JSON.stringify(resolvedUser));
        }

        scheduleRefresh(expiresInSec);
      } catch {
        // Stored session invalid or expired — silent logout
        await _clearSession();
      } finally {
        setBooting(false);
      }
    })();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────────────────

  /** Step 1: request OTP to be sent to a WhatsApp number */
  const sendOtp = useCallback(async (phone) => {
    return AuthAPI.sendOtp(phone);
  }, []);

  /**
   * Step 2: verify OTP and complete login.
   * displayName is collected in the UI and merged into the user profile.
   */
  const verifyOtp = useCallback(async (requestId, otp, displayName) => {
    const { accessToken, refreshToken, expiresInSec, user: apiUser } =
      await AuthAPI.verifyOtp(requestId, otp);

    const resolvedUser = {
      ...apiUser,
      name: displayName?.trim() || apiUser.name,
    };

    refreshTokenRef.current = refreshToken;

    await Promise.all([
      TokenStorage.set(KEYS.ACCESS,  accessToken),
      TokenStorage.set(KEYS.REFRESH, refreshToken),
      TokenStorage.set(KEYS.USER,    JSON.stringify(resolvedUser)),
    ]);

    setUser(resolvedUser);
    scheduleRefresh(expiresInSec);
  }, [scheduleRefresh]);

  /** Revoke refresh token on backend, then clear local session */
  const logout = useCallback(async () => {
    try {
      const rt = refreshTokenRef.current ?? await TokenStorage.get(KEYS.REFRESH);
      const at = await TokenStorage.get(KEYS.ACCESS);
      if (rt) await AuthAPI.revokeSession(rt, { accessToken: at });
    } catch {
      // Fire-and-forget — still clear locally even if backend call fails
    } finally {
      await _clearSession();
    }
  }, [_clearSession]);

  /** Update display name without re-authentication */
  const updateName = useCallback(async (name) => {
    if (!user) return;
    const updated = { ...user, name };
    setUser(updated);
    await TokenStorage.set(KEYS.USER, JSON.stringify(updated));
    // Sync to backend if available
    if (AuthAPI.updateUserName) {
      await AuthAPI.updateUserName(user.phone, name).catch(() => {});
    }
  }, [user]);

  /** Returns the current access token (for use in API calls) */
  const getAccessToken = useCallback(async () => {
    return TokenStorage.get(KEYS.ACCESS);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isBootstrapping,
    sendOtp,
    verifyOtp,
    logout,
    updateName,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
