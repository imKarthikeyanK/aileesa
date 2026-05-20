/**
 * httpClient.js — Centralised fetch wrapper with request/response logging.
 *
 * Logging is always enabled in dev/sbox; suppressed in prod.
 * Every request prints:   → METHOD  URL  (+ abbreviated headers)
 * Every success prints:   ← STATUS  URL  body-preview
 * Every error prints:     ✗ STATUS  URL  message + full stack trace
 *
 * Usage:
 *   import { httpGet, httpPost, httpPatch, httpPut } from './httpClient';
 *
 *   const data = await httpGet(url, { accessToken });
 *   const data = await httpPost(url, body, { accessToken });
 */

import { getHeaders } from './requestHeaders';
import { IS_PROD } from './env';

// ─── Logger ───────────────────────────────────────────────────────────────────

const LOG_ENABLED = !IS_PROD;

/** Safe JSON truncation for logging — keeps logs readable for large bodies. */
function _preview(value, maxLen = 500) {
  try {
    const str = JSON.stringify(value);
    return str.length > maxLen ? str.slice(0, maxLen) + ' …' : str;
  } catch {
    return String(value);
  }
}

/** Strip Authorization from header log to avoid token leaks. */
function _safeHeaders(headers) {
  const safe = { ...headers };
  if (safe['Authorization']) safe['Authorization'] = 'Bearer [redacted]';
  return safe;
}

function _logRequest(method, url, headers, body) {
  if (!LOG_ENABLED) return;
  console.log(
    `\n[API] → ${method.toUpperCase()}  ${url}`,
    '\n  headers:', _safeHeaders(headers),
    body !== undefined ? `\n  body: ${_preview(body)}` : '',
  );
}

function _logResponse(method, url, status, data) {
  if (!LOG_ENABLED) return;
  console.log(
    `[API] ← ${status}  ${url}`,
    `\n  body: ${_preview(data)}`,
  );
}

function _logError(method, url, status, error) {
  if (!LOG_ENABLED) return;
  console.error(
    `[API] ✗ ${status ?? 'ERR'}  ${url}`,
    `\n  message: ${error?.message}`,
    error?.data ? `\n  response: ${_preview(error.data)}` : '',
    error?.stack ? `\n  stack:\n${error.stack}` : '',
  );
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function _request(method, url, { body, accessToken, errorFactory } = {}) {
  const headers = getHeaders({ accessToken });
  _logRequest(method, url, headers, body);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // Network-level failure (offline, DNS, TLS)
    _logError(method, url, null, networkError);
    throw networkError;
  }

  let data;
  try {
    data = await res.json();
  } catch (parseError) {
    _logError(method, url, res.status, parseError);
    throw parseError;
  }

  if (!res.ok) {
    const message = data?.message ?? data?.error ?? 'Request failed';
    const err = errorFactory
      ? errorFactory(data, res.status)
      : new Error(message);
    if (!err.data) err.data = data;
    _logError(method, url, res.status, err);
    throw err;
  }

  _logResponse(method, url, res.status, data);
  return data;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function httpGet(url, { accessToken, errorFactory } = {}) {
  return _request('GET', url, { accessToken, errorFactory });
}

export function httpPost(url, body, { accessToken, errorFactory } = {}) {
  return _request('POST', url, { body, accessToken, errorFactory });
}

export function httpPatch(url, body, { accessToken, errorFactory } = {}) {
  return _request('PATCH', url, { body, accessToken, errorFactory });
}

export function httpPut(url, body, { accessToken, errorFactory } = {}) {
  return _request('PUT', url, { body, accessToken, errorFactory });
}
