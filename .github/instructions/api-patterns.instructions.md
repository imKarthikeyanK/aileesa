---
description: "Use when creating or modifying API service modules, HTTP client calls, mock data, or request headers. Covers the mock/real provider pattern, httpClient usage, and requestHeaders conventions."
applyTo: "src/api/**"
---

# API Layer Conventions

## Mock/Real Provider Pattern
Every API module follows this structure:
```js
import { USE_MOCK } from './env';

export const SomeAPI = {
  async someMethod(params, { accessToken } = {}) {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, SIMULATED_DELAY_MS));
      // Return mock data
    }
    return _get('/endpoint', { accessToken });
  },
};
```

## HTTP Client Usage
- Use `httpGet`, `httpPost`, `httpPatch`, `httpPut` from `httpClient.js`
- Never use raw `fetch()` — always go through httpClient
- Pass `{ accessToken, errorFactory }` as the options parameter
- `errorFactory` callback receives `(data, statusCode)` — return a custom Error with `.code`

## Request Headers
- Import `getHeaders` from `requestHeaders.js`
- Headers auto-include: x-oz-app-version, x-oz-platform-os, x-oz-device-id, x-oz-token, x-oz-uid
- Call `setAuthState({ uid, loggedIn })` from AuthContext on login/logout

## Response Shape
Real API returns `{ status, data }` wrapper. Mock APIs return data directly.

## URL Convention
- Auth endpoints: `AUTH_API_URL` = `${BASE_URL}/ozauth/external/v1`
- Business endpoints: `AILEESA_API_URL` = `${BASE_URL}/aileesa/external/v1`

## Mock Data
- Centralized in `mockData.js` with `MOCK_` prefix (e.g. `MOCK_STORES`, `MOCK_INVENTORIES`)
- Fields use snake_case matching backend contract
- Mock delays simulate realistic latency (600-1400ms)

## Environment (`env.js`)
- Resolution order: `EXPO_PUBLIC_APP_ENV` → `ACTIVE_ENV` fallback → `__DEV__` fallback
- `USE_MOCK` is derived from the active environment — never set it manually
- Export `IS_DEV`, `IS_SBOX`, `IS_PROD` for conditional logic
