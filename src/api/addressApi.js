/**
 * addressApi.js — User address management
 *
 * Real endpoints:
 *   POST   /user/addresses        → save a new address
 *   GET    /user/addresses        → list saved addresses
 *   DELETE /user/addresses/:id    → delete an address
 *
 * Mock: all operations succeed with a simulated network delay.
 */

const DELAY_MS = 900;

// In-memory store for dev (resets on app reload)
let _savedAddresses = [];

/**
 * saveAddress(addressData)
 * → Promise<{ success: true, data: SavedAddress }>
 *
 * addressData shape:
 *   { latitude, longitude, fullAddress, houseNo, landmark?,
 *     city, state, pincode, type: 'home'|'office'|'other', name }
 */
export async function saveAddress(addressData) {
  await new Promise(res => setTimeout(res, DELAY_MS));

  const saved = {
    id:        `addr_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...addressData,
  };

  _savedAddresses = [saved, ..._savedAddresses];

  return { success: true, data: saved };
}

/**
 * getSavedAddresses()
 * → Promise<{ success: true, data: SavedAddress[] }>
 */
export async function getSavedAddresses() {
  await new Promise(res => setTimeout(res, 400));
  return { success: true, data: _savedAddresses };
}

/**
 * deleteAddress(id)
 * → Promise<{ success: true }>
 */
export async function deleteAddress(id) {
  await new Promise(res => setTimeout(res, 400));
  _savedAddresses = _savedAddresses.filter(a => a.id !== id);
  return { success: true };
}
