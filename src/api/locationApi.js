/**
 * locationApi.js — Service availability check
 *
 * Real endpoint: POST /flash
 *   Body:    { lat: number, lng: number }
 *   Response: { serviceable: boolean, city: string, zone: string, message: string,
 *               min_order_value: number|null, delivery_fee: number,
 *               free_delivery_above: number|null, platform_fee: number }
 *
 * Mock: returns serviceable=true for six major metro bounding boxes.
 *       All other coordinates → not serviceable.
 */

import { AILEESA_API_URL as BASE_URL, USE_MOCK } from './env';
import { httpPost } from './httpClient';

// ─── Real API helpers ─────────────────────────────────────────────────────────

function _post(path, body) {
  return httpPost(`${BASE_URL}${path}`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
const DELAY_MS = 1400;
const NON_SERVICEABLE_FALLBACK = {
  serviceable: false,
  city: null,
  zone: null,
  message: "We're not in your city yet. Coming soon!",
};

// ─── Serviceable Metro Zones ───────────────────────────────────────────────────
// Each zone defines an approximate bounding box [min, max].
// Production: replace this lookup with a real backend call.

const SERVICEABLE_ZONES = [
  {
    name: 'Bangalore',
    zone: 'KA-BLR',
    lat:  [12.85, 13.15],
    lng:  [77.45, 77.75],
  },
  {
    name: 'Mumbai',
    zone: 'MH-MUM',
    lat:  [18.85, 19.30],
    lng:  [72.75, 73.05],
  },
  {
    name: 'Delhi NCR',
    zone: 'DL-NCR',
    lat:  [28.40, 28.80],
    lng:  [76.85, 77.40],
  },
  {
    name: 'Hyderabad',
    zone: 'TS-HYD',
    lat:  [17.25, 17.55],
    lng:  [78.30, 78.65],
  },
  {
    name: 'Chennai',
    zone: 'TN-CHN',
    lat:  [12.90, 13.25],
    lng:  [80.10, 80.35],
  },
  {
    name: 'Pune',
    zone: 'MH-PUN',
    lat:  [18.45, 18.65],
    lng:  [73.75, 73.98],
  },
];

/**
 * checkServiceability({ latitude, longitude })
 * → Promise<{ serviceable, city, zone, message }>
 *
 * DEV MODE: Always returns serviceable = true.
 * To test non-serviceable flow, comment out the early return below
 * and let the bounding-box logic run.
 */
export async function checkServiceability({ latitude, longitude }) {
  if (USE_MOCK) {
    await new Promise(res => setTimeout(res, DELAY_MS));

    const devMatch = SERVICEABLE_ZONES.find(
      z =>
        latitude  >= z.lat[0] && latitude  <= z.lat[1] &&
        longitude >= z.lng[0] && longitude <= z.lng[1],
    ) ?? SERVICEABLE_ZONES[0]; // default to Bangalore when outside all zones

    return {
      serviceable:         true,
      city:                devMatch.name,
      zone:                devMatch.zone,
      message:             `Aileesa delivers in ${devMatch.name}!`,
      // Service levels — mirror production values in dev so the cart UI renders correctly
      min_order_value:     149,
      delivery_fee:        29,
      free_delivery_above: 199,
      platform_fee:        5,
    };
  }

  try {
    const res = await _post('/flash', { lat: latitude, lng: longitude });
    const payload = res?.data && typeof res.data === 'object' ? res.data : res;

    // Fail closed: any non-success/invalid shape is treated as non-serviceable.
    if ((res?.status != null && res.status !== 200) || typeof payload?.serviceable !== 'boolean') {
      return NON_SERVICEABLE_FALLBACK;
    }

    return {
      serviceable:         payload.serviceable,
      city:                payload?.city              ?? null,
      zone:                payload?.zone              ?? null,
      message:             payload?.message           ?? NON_SERVICEABLE_FALLBACK.message,
      // Service levels — null/0 treated as "no constraint / free" by CartScreen
      min_order_value:     payload?.min_order_value   ?? null,
      delivery_fee:        payload?.delivery_fee      ?? 0,
      free_delivery_above: payload?.free_delivery_above ?? null,
      platform_fee:        payload?.platform_fee      ?? 0,
      notice_txt:          payload?.notice_txt         ?? null,
    };
  } catch {
    return NON_SERVICEABLE_FALLBACK;
  }
}
