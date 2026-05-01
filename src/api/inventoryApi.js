/**
 * inventoryApi.js — Inventory (products) for a given store.
 *
 * Paginated by sections: SECTIONS_PER_PAGE sections per page.
 * Swap with real fetch/axios without touching screen code.
 */

import { MOCK_INVENTORIES } from './mockData';

const SIMULATED_DELAY_MS = 600;
const SECTIONS_PER_PAGE = 2;

function delay() {
  return new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY_MS));
}

/**
 * GET /stores/:storeId/inventories?page=
 *
 * @param {{ storeId: string, page?: number }} options
 * @returns {Promise<{ data: object[], pagination: object }>}
 */
export async function getInventories({ storeId, page = 1 } = {}) {
  await delay();

  const allSections = MOCK_INVENTORIES[storeId] ?? [];

  if (allSections.length === 0) {
    return {
      data: [],
      pagination: { page: 1, per_page: SECTIONS_PER_PAGE, total_sections: 0, total_pages: 0, has_next: false },
    };
  }

  const total = allSections.length;
  const totalPages = Math.ceil(total / SECTIONS_PER_PAGE);
  const start = (page - 1) * SECTIONS_PER_PAGE;
  const data = allSections.slice(start, start + SECTIONS_PER_PAGE);

  return {
    data,
    pagination: {
      page,
      per_page: SECTIONS_PER_PAGE,
      total_sections: total,
      total_pages: totalPages,
      has_next: page < totalPages,
    },
  };
}
