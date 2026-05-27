/**
 * httpClient.js — Centralised fetch wrapper.
 *
 * Usage:
 *   import { httpGet, httpPost, httpPatch, httpPut } from './httpClient';
 *
 *   const data = await httpGet(url, { accessToken });
 *   const data = await httpPost(url, body, { accessToken });
 */

import { getHeaders } from './requestHeaders';

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function _request(method, url, { body, accessToken, errorFactory } = {}) {
  const headers = getHeaders({ accessToken });

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw networkError;
  }

  let data;
  try {
    data = await res.json();
  } catch (parseError) {
    throw parseError;
  }

  if (!res.ok) {
    const message = data?.message ?? data?.error ?? 'Request failed';
    const err = errorFactory
      ? errorFactory(data, res.status)
      : new Error(message);
    if (!err.data) err.data = data;
    throw err;
  }

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
