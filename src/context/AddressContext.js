/**
 * AddressContext.js — Global delivery address state
 *
 * Handles two flows:
 *
 * ANONYMOUS (not logged in)
 * ─────────────────────────
 * User fills the LocationPicker form → address created via API with
 * is_anonymous=true → full address data + server id stored in-memory →
 * exposed as selectedAddress throughout the app.
 * anonymousAddressId is exposed so LocationPicker can prefill the form
 * on revisit using GET /user-addresses/:id.
 *
 * AUTHENTICATED (logged in)
 * ─────────────────────────
 * On login → addresses fetched from GET /user-addresses → closest address
 * auto-selected based on haversine distance from current coords (when
 * available), otherwise default (or first) address is selected.
 * autoSelectClosestAddress(coords) can be called at any time to re-run
 * the proximity selection after coords become available.
 *
 * Exposes via useAddress():
 *   selectedAddress             — currently active delivery address object | null
 *   addresses                  — list of saved addresses (authenticated only)
 *   isLoading                  — true while fetching addresses
 *   anonymousAddressId         — id of the anonymous user's saved address | null
 *   selectAddress(addr)        — manually set selected address
 *   createAndSelectAddress(formData) — create via API then select locally
 *   refreshAddresses(coords?)  — re-fetch from API (authenticated only); auto-selects closest when coords provided
 *   autoSelectClosestAddress(coords) — pick closest saved address from coords
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { AddressAPI } from '../api/addressApi';

const AddressContext = createContext(null);

// ─── Haversine distance (metres) ──────────────────────────────────────────────
function _haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function AddressProvider({ children }) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshFlashCritical } = useLocation();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addresses,       setAddresses]       = useState([]);
  const [isLoading,       setIsLoading]       = useState(false);
  // id of the anonymous user's server-side address (used for prefill on revisit)
  const [anonymousAddressId, setAnonymousAddressId] = useState(null);

  // In-memory store for the anonymous user's last created address.
  const anonymousAddressRef = useRef(null);

  const toCoords = useCallback((addr) => {
    if (!addr || addr.lat == null || addr.lng == null) return null;
    return { latitude: addr.lat, longitude: addr.lng };
  }, []);

  // ── Auto-select closest address given coords ──────────────────────────────
  const autoSelectClosestAddress = useCallback((coords, list) => {
    const pool = list ?? [];
    if (!coords || pool.length === 0) return;
    const { latitude, longitude } = coords;
    let closest = pool[0];
    let minDist = Infinity;
    for (const addr of pool) {
      if (addr.lat == null || addr.lng == null) continue;
      const d = _haversineM(latitude, longitude, addr.lat, addr.lng);
      if (d < minDist) { minDist = d; closest = addr; }
    }
    setSelectedAddress(closest);
  }, []);

  // ── Fetch saved addresses for the authenticated user ─────────────────────
  const refreshAddresses = useCallback(async (coords) => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const at   = await getAccessToken();
      const list = await AddressAPI.getUserAddresses({ accessToken: at });
      setAddresses(list);
      if (list.length > 0) {
        if (coords) {
          autoSelectClosestAddress(coords, list);
        } else {
          setSelectedAddress(prev => {
            if (prev?.id && list.some(a => a.id === prev.id)) return prev;
            return list.find(a => a.is_default) ?? list[0];
          });
        }
      }
    } catch {
      // Non-critical — keep existing selection
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken, autoSelectClosestAddress]);

  // ── React to auth state changes ───────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      refreshAddresses();
    } else {
      setAddresses([]);
      setSelectedAddress(anonymousAddressRef.current ?? null);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create an address and set it as selected ──────────────────────────────
  const createAndSelectAddress = useCallback(async (formData) => {
    const at = isAuthenticated ? await getAccessToken() : undefined;

    const payload = {
      lat:            formData.lat,
      lng:            formData.lng,
      address_line_1: formData.address_line_1,
      address_line_2: formData.address_line_2 ?? '',
      landmark:       formData.landmark       ?? '',
      city:           formData.city,
      state:          formData.state,
      pincode:        formData.pincode,
      label:          formData.label,
      receiver_name:  formData.receiver_name,
      receiver_phone: formData.receiver_phone,
      is_anonymous:   !isAuthenticated,
    };

    await AddressAPI.createAddress(payload, { accessToken: at });

    const parts = [
      formData.address_line_1,
      formData.address_line_2,
      formData.landmark,
      formData.city,
      formData.state,
      formData.pincode,
    ].filter(Boolean);

    const localAddr = {
      label:             formData.label,
      is_default:        false,
      receiver_name:     formData.receiver_name,
      receiver_phone:    formData.receiver_phone,
      lat:               formData.lat,
      lng:               formData.lng,
      address_line_1:    formData.address_line_1,
      address_line_2:    formData.address_line_2 ?? '',
      landmark:          formData.landmark       ?? '',
      city:              formData.city,
      state:             formData.state,
      pincode:           formData.pincode,
      formatted_address: parts.join(', '),
    };

    if (!isAuthenticated) {
      // Fetch the list to capture the server-assigned id for future prefills
      try {
        const list = await AddressAPI.getUserAddresses();
        // Match by address_line_1 + city + pincode (most specific unique combo)
        const match = list.find(
          a => a.address_line_1 === formData.address_line_1 &&
               a.city           === formData.city &&
               a.pincode        === formData.pincode,
        );
        if (match) {
          localAddr.id = match.id;
          setAnonymousAddressId(match.id);
        }
      } catch {
        // id fetch failure is non-fatal
      }
      anonymousAddressRef.current = localAddr;
      setSelectedAddress(localAddr);
    } else {
      await refreshAddresses();
    }

    // Checkpoint: location/address changed — refresh flash state.
    refreshFlashCritical({
      reason: 'address_change',
      coords: isAuthenticated ? { latitude: formData.lat, longitude: formData.lng } : undefined,
    });

    return localAddr;
  }, [isAuthenticated, getAccessToken, refreshAddresses, refreshFlashCritical]);

  const selectAddress = useCallback((addr) => {
    setSelectedAddress(addr);
    // Checkpoint: saved address switched by the user.
    refreshFlashCritical({
      reason: 'address_change',
      coords: isAuthenticated ? toCoords(addr) : undefined,
    });
  }, [isAuthenticated, refreshFlashCritical, toCoords]);

  const value = {
    selectedAddress,
    addresses,
    isLoading,
    anonymousAddressId,
    selectAddress,
    createAndSelectAddress,
    refreshAddresses,
    autoSelectClosestAddress,
  };

  return (
    <AddressContext.Provider value={value}>
      {children}
    </AddressContext.Provider>
  );
}

export function useAddress() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddress must be used inside <AddressProvider>');
  return ctx;
}
