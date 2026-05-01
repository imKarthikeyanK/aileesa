/**
 * storeApi.js — Store list and store detail endpoints.
 *
 * All functions return a Promise. Swap the mock implementations here
 * with real fetch/axios calls without touching any screen code.
 */

import { MOCK_STORES, MOCK_STORE_DETAILS } from './mockData';

const SIMULATED_DELAY_MS = 700;
const PER_PAGE = 5;

function delay() {
  return new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY_MS));
}

/**
 * GET /stores?page=&category=
 *
 * @param {{ page?: number, category?: string | null }} options
 * @returns {Promise<{ data: object[], pagination: object }>}
 */
export async function getStores({ page = 1, category = null } = {}) {
  await delay();

  const filtered =
    category && category !== 'all'
      ? MOCK_STORES.filter(s => s.category === category)
      : MOCK_STORES;

  const total = filtered.length;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  const start = (page - 1) * PER_PAGE;
  const data = filtered.slice(start, start + PER_PAGE);

  return {
    data,
    pagination: {
      page,
      per_page: PER_PAGE,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
    },
  };
}

/**
 * GET /stores/:id
 *
 * @param {string} storeId
 * @returns {Promise<{ data: object }>}
 */
export async function getStoreDetail(storeId) {
  await delay();

  const store = MOCK_STORE_DETAILS[storeId];
  if (!store) {
    throw new Error(`Store "${storeId}" not found.`);
  }

  return { data: store };
}
