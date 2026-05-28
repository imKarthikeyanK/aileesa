/**
 * addressApi.js — User address management
 *
 * Endpoints:
 *   POST   /aileesa/external/v1/addresses    → create an address
 *   GET    {base_url}/user-addresses         → list saved addresses
 *   PATCH  {base_url}/user-addresses/:id     → update label/default/receiver
 *
 * Auth headers (x-oz-token + x-oz-uid) are injected by getHeaders().
 * Pass is_anonymous: true for unauthenticated address creation; the backend
 * assigns a dummy user and merges it into the real account at order placement.
 */

import { AILEESA_API_URL, BASE_URL } from './env';
import { httpGet, httpPost, httpPatch } from './httpClient';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function _post(url, body, { accessToken } = {}) {
  return httpPost(url, body, { accessToken });
}

function _get(url, { accessToken } = {}) {
  return httpGet(url, { accessToken });
}

function _patch(url, body, { accessToken } = {}) {
  return httpPatch(url, body, { accessToken });
}

function _toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function _normalizeAddress(addr) {
  if (!addr || typeof addr !== 'object') return addr;
  const lat = _toNumOrNull(addr.lat ?? addr.latitude);
  const lng = _toNumOrNull(addr.lng ?? addr.longitude);
  return {
    ...addr,
    lat,
    lng,
  };
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const AddressAPI = {
  /**
   * POST /aileesa/external/v1/addresses
   *
   * payload: { lat, lng, address_line_1, address_line_2?, landmark?,
   *            city, state, pincode, label, receiver_name, receiver_phone,
   *            is_anonymous }
   *
   * 201: { status: 201, data: "address created successfully" }
   */
  async createAddress(payload, { accessToken } = {}) {
    return _post(`${AILEESA_API_URL}/addresses`, payload, { accessToken });
  },

  /**
   * GET {base_url}/user-addresses
   * Returns all saved address associations ordered default-first.
   *
   * 200: { status: 200, data: [ ...address objects ] }
   */
  async getUserAddresses({ accessToken } = {}) {
    const res = await _get(`${AILEESA_API_URL}/user-addresses`, { accessToken });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(_normalizeAddress);
  },

  /**
   * GET {base_url}/user-addresses/:id
   * Returns a single saved address object.
   *
   * 200: { status: 200, data: { ...address object } }
   */
  async getAddress(id, { accessToken } = {}) {
    const res = await _get(`${AILEESA_API_URL}/user-addresses/${id}`, { accessToken });
    return _normalizeAddress(res.data ?? null);
  },

  /**
   * PATCH {base_url}/user-addresses/:id
   * Updates label, is_default, receiver_name, receiver_phone.
   * When is_default=true the backend atomically unsets it on all other mappings.
   *
   * payload: { label?, is_default?, receiver_name?, receiver_phone? }
   */
  async updateUserAddress(id, payload, { accessToken } = {}) {
    return _patch(`${AILEESA_API_URL}/user-addresses/${id}`, payload, { accessToken });
  },
};

