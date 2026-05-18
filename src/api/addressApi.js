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
    const res = await _get(`${BASE_URL}/user-addresses`, { accessToken });
    return res.data ?? [];
  },

  /**
   * PATCH {base_url}/user-addresses/:id
   * Updates label, is_default, receiver_name, receiver_phone.
   * When is_default=true the backend atomically unsets it on all other mappings.
   *
   * payload: { label?, is_default?, receiver_name?, receiver_phone? }
   */
  async updateUserAddress(id, payload, { accessToken } = {}) {
    return _patch(`${BASE_URL}/user-addresses/${id}`, payload, { accessToken });
  },
};

