/**
 * env.js — Runtime environment configuration.
 *
 * SWITCHING ENVIRONMENTS
 * ──────────────────────
 * Option 1 — Manual (local dev):
 *   Change ACTIVE_ENV below.  This is the only line you touch.
 *
 * Option 2 — EAS build profiles (CI / release):
 *   Set EXPO_PUBLIC_APP_ENV in each eas.json build profile:
 *
 *     "development": { "env": { "EXPO_PUBLIC_APP_ENV": "dev" } }
 *     "preview":     { "env": { "EXPO_PUBLIC_APP_ENV": "sbox" } }
 *     "production":  { "env": { "EXPO_PUBLIC_APP_ENV": "prod" } }
 *
 *   Expo bakes EXPO_PUBLIC_* vars into the bundle at build time, so
 *   process.env.EXPO_PUBLIC_APP_ENV is readable at runtime.
 *
 * Option 3 — Local .env files:
 *   Create .env.development / .env.production / .env.local with:
 *     EXPO_PUBLIC_APP_ENV=dev
 *   Expo CLI picks these up automatically (SDK 49+).
 *
 * ENVIRONMENT DEFINITIONS
 * ───────────────────────
 *  dev  — local / feature-branch backend; mocks usually on; verbose logging
 *  sbox — shared sandbox / QA backend; mocks off; mimics prod behaviour
 *  prod — production backend; mocks always off; no debug output
 */

// ─── Environment map ──────────────────────────────────────────────────────────

const ENVIRONMENTS = {
  dev: {
    name:       'dev',
    label:      'Development',
    apiBaseUrl: 'https://api-dev.aileesa.com/v1',
    /** Show dev-only UI (mock OTP banner, env badge, etc.) */
    debugUI:    true,
    /** Default auth provider when ACTIVE_PROVIDER in authApi.js is not 'real' */
    mockAuth:   true,
  },

  sbox: {
    name:       'sbox',
    label:      'Sandbox',
    apiBaseUrl: 'https://api-sbox.aileesa.com/v1',
    debugUI:    false,
    mockAuth:   false,
  },

  prod: {
    name:       'prod',
    label:      'Production',
    apiBaseUrl: 'https://api.aileesa.com/v1',
    debugUI:    false,
    mockAuth:   false,
  },
};

// ─── Active environment ───────────────────────────────────────────────────────
//
// Resolution order (first truthy value wins):
//   1. EXPO_PUBLIC_APP_ENV  — injected by EAS build profile or .env file
//   2. ACTIVE_ENV below     — manual override for local dev
//
// Valid values: 'dev' | 'sbox' | 'prod'

const ACTIVE_ENV = 'dev'; // ← change this for local overrides

const _envKey = process.env.EXPO_PUBLIC_APP_ENV ?? ACTIVE_ENV;

if (!ENVIRONMENTS[_envKey]) {
  throw new Error(
    `[env] Unknown environment "${_envKey}". Valid values: ${Object.keys(ENVIRONMENTS).join(', ')}.`
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Full config object for the active environment. */
export const ENV = ENVIRONMENTS[_envKey];

/** Base URL for all API calls — import this instead of hardcoding URLs. */
export const BASE_URL = ENV.apiBaseUrl;

/** Convenience flags */
export const IS_DEV  = ENV.name === 'dev';
export const IS_SBOX = ENV.name === 'sbox';
export const IS_PROD = ENV.name === 'prod';
