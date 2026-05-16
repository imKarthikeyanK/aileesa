/**
 * AddressContext.js — Global delivery address state
 *
 * Handles two flows:
 *
 * ANONYMOUS (not logged in)
 * ─────────────────────────
 * User fills the LocationPicker form → address created via API with
 * is_anonymous=true → full address data stored in-memory → exposed as
 * selectedAddress throughout the app (used in order delivery_info).
 *
 * AUTHENTICATED (logged in)
 * ─────────────────────────
 * On login → addresses fetched from GET /user-addresses → default (or first)
 * auto-selected.  User can create new addresses or switch selection from
 * CartScreen.
 *
 * Exposes via useAddress():
 *   selectedAddress        — currently active delivery address object | null
 *   addresses              — list of saved addresses (authenticated only)
 *   isLoading              — true while fetching addresses
 *   selectAddress(addr)    — manually set selected address from the list
 *   createAndSelectAddress(formData) — create via API then select locally
 *   refreshAddresses()     — re-fetch from API (authenticated only)
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
import { AddressAPI } from '../api/addressApi';

const AddressContext = createContext(null);

export function AddressProvider({ children }) {
  const { isAuthenticated, getAccessToken } = useAuth();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addresses,       setAddresses]       = useState([]);
  const [isLoading,       setIsLoading]       = useState(false);

  // In-memory store for the anonymous user's last created address.
  // Cleared when the user logs in (backend merges it via place-order).
  const anonymousAddressRef = useRef(null);

  // ── Fetch saved addresses for the authenticated user ─────────────────────
  const refreshAddresses = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const at   = await getAccessToken();
      const list = await AddressAPI.getUserAddresses({ accessToken: at });
      setAddresses(list);
      // Auto-select the default address, or the first one in the list
      if (list.length > 0) {
        setSelectedAddress(prev => {
          // If the currently selected address is already in the list, keep it
          if (prev?.id && list.some(a => a.id === prev.id)) return prev;
          return list.find(a => a.is_default) ?? list[0];
        });
      }
    } catch {
      // Non-critical — keep existing selection
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  // ── React to auth state changes ───────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      refreshAddresses();
    } else {
      // User logged out — clear saved list, restore any anonymous address
      setAddresses([]);
      setSelectedAddress(anonymousAddressRef.current ?? null);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create an address and set it as selected ──────────────────────────────
  /**
   * formData shape:
   *   { lat, lng, address_line_1, address_line_2?, landmark?,
   *     city, state, pincode, label,
   *     receiver_name, receiver_phone }
   *
   * Returns the local address object that was selected.
   */
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

    // Build a local representation of the new address
    const parts = [
      formData.address_line_1,
      formData.address_line_2,
      formData.landmark,
      formData.city,
      formData.state,
      formData.pincode,
    ].filter(Boolean);

    const localAddr = {
      // id / address_id will be populated after refreshAddresses() for auth users
      label:            formData.label,
      is_default:       false,
      receiver_name:    formData.receiver_name,
      receiver_phone:   formData.receiver_phone,
      lat:              formData.lat,
      lng:              formData.lng,
      address_line_1:   formData.address_line_1,
      address_line_2:   formData.address_line_2 ?? '',
      landmark:         formData.landmark       ?? '',
      city:             formData.city,
      state:            formData.state,
      pincode:          formData.pincode,
      formatted_address: parts.join(', '),
    };

    if (!isAuthenticated) {
      // Store locally so it survives between screens
      anonymousAddressRef.current = localAddr;
      setSelectedAddress(localAddr);
    } else {
      // Fetch the list so the new address (with its server-assigned ID) appears
      await refreshAddresses();
    }

    return localAddr;
  }, [isAuthenticated, getAccessToken, refreshAddresses]);

  const value = {
    selectedAddress,
    addresses,
    isLoading,
    selectAddress:          setSelectedAddress,
    createAndSelectAddress,
    refreshAddresses,
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
