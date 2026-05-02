/**
 * locationApi.js — Service availability check
 *
 * Real endpoint: POST /serviceability
 *   Body:    { lat: number, lng: number }
 *   Response: { serviceable: boolean, city: string, zone: string, message: string }
 *
 * Mock: returns serviceable=true for six major metro bounding boxes.
 *       All other coordinates → not serviceable.
 */

const DELAY_MS = 1400;

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
  await new Promise(res => setTimeout(res, DELAY_MS));

  // ── DEV override: always serviceable ──────────────────────────────────────
  // Remove or comment this block to re-enable real bounding-box checks.
  const devMatch = SERVICEABLE_ZONES.find(
    z =>
      latitude  >= z.lat[0] && latitude  <= z.lat[1] &&
      longitude >= z.lng[0] && longitude <= z.lng[1],
  ) ?? SERVICEABLE_ZONES[0]; // default to Bangalore when outside all zones

  return {
    serviceable: true,
    city:        devMatch.name,
    zone:        devMatch.zone,
    message:     `Aileesa delivers in ${devMatch.name}!`,
  };

  /* ── Production bounding-box logic (unreachable in dev) ────────────────────
  const match = SERVICEABLE_ZONES.find(
    z =>
      latitude  >= z.lat[0] && latitude  <= z.lat[1] &&
      longitude >= z.lng[0] && longitude <= z.lng[1],
  );

  if (match) {
    return { serviceable: true, city: match.name, zone: match.zone,
             message: `Aileesa delivers in ${match.name}!` };
  }
  return { serviceable: false, city: null, zone: null,
           message: "We're not in your area yet — but expanding rapidly!" };
  ─────────────────────────────────────────────────────────────────────────── */
}
