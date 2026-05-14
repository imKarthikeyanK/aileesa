/**
 * ordersApi.js — Order placement and order history endpoints.
 *
 * All functions return a Promise. Swap mock implementations with real
 * fetch/axios calls without touching any screen code.
 */

import { getHeaders } from './requestHeaders';
import { AILEESA_API_URL as BASE_URL } from './env';

// ─── Real API helpers ─────────────────────────────────────────────────────────

async function _get(path, { accessToken } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: getHeaders({ accessToken }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}

async function _post(path, body, { accessToken } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getHeaders({ accessToken }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}

// ─── Mock in-memory store ──────────────────────────────────────────────────────
// Pre-seeded with some history so the UI is non-empty from the start.

const _orders = [
  {
    id: 'BK-2025-0412',
    created_at: '2025-04-12T10:32:00.000Z',
    store_id: '1',
    store_name: 'Green Basket',
    items: [
      { id: 'item_001', product_id: 'p1', variant_id: 'v1', sku_code: 'SKU-001', name: 'Amul Butter (100 g)',         quantity: 2, price: 56,  base_price: 60  },
      { id: 'item_002', product_id: 'p2', variant_id: 'v2', sku_code: 'SKU-002', name: 'Full Cream Milk (500 ml)',    quantity: 1, price: 32,  base_price: 35  },
      { id: 'item_003', product_id: 'p3', variant_id: 'v3', sku_code: 'SKU-003', name: 'Brown Bread',                quantity: 1, price: 45,  base_price: 45  },
    ],
    sub_total:    133,
    tax:          16,
    delivery_fee: 29,
    platform_fee: 5,
    grand_total:  183,
    status: 'delivered',
    delivered_at: '2025-04-12T11:04:00.000Z',
    delivery_info: {
      address: '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
      lat: 13.0827,
      lng: 80.2707,
    },
    payment_method: 'UPI',
    payment_status: 'paid',
    delivery_time: '20-25',
    invoice_url: null,
    tracking: [
      { label: 'Order Placed',      done: true,  time: '10:32 AM' },
      { label: 'Store Confirmed',   done: true,  time: '10:34 AM' },
      { label: 'Packed & Ready',    done: true,  time: '10:48 AM' },
      { label: 'Out for Delivery',  done: true,  time: '10:52 AM' },
      { label: 'Delivered',         done: true,  time: '11:04 AM' },
    ],
  },
  {
    id: 'BK-2025-0389',
    created_at: '2025-04-05T14:18:00.000Z',
    store_id: '2',
    store_name: 'The Bread Box',
    items: [
      { id: 'item_010', product_id: 'p10', variant_id: 'v10', sku_code: 'SKU-010', name: 'Sourdough Loaf',             quantity: 1, price: 160, base_price: 160 },
      { id: 'item_011', product_id: 'p11', variant_id: 'v11', sku_code: 'SKU-011', name: 'Butter Croissant (2 pcs)',   quantity: 1, price: 90,  base_price: 90  },
    ],
    sub_total:    250,
    tax:          0,
    delivery_fee: 0,
    platform_fee: 5,
    grand_total:  255,
    status: 'delivered',
    delivered_at: '2025-04-05T14:55:00.000Z',
    delivery_info: {
      address: '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
      lat: 13.0827,
      lng: 80.2707,
    },
    payment_method: 'Cash on Delivery',
    payment_status: 'paid',
    delivery_time: '20-25',
    invoice_url: null,
    tracking: [
      { label: 'Order Placed',      done: true,  time: '2:18 PM' },
      { label: 'Store Confirmed',   done: true,  time: '2:20 PM' },
      { label: 'Packed & Ready',    done: true,  time: '2:34 PM' },
      { label: 'Out for Delivery',  done: true,  time: '2:38 PM' },
      { label: 'Delivered',         done: true,  time: '2:55 PM' },
    ],
  },
  {
    id: 'BK-2025-0301',
    created_at: '2025-03-21T08:05:00.000Z',
    store_id: '1',
    store_name: 'Green Basket',
    items: [
      { id: 'item_020', product_id: 'p20', variant_id: 'v20', sku_code: 'SKU-020', name: 'Tata Salt (1 kg)',           quantity: 1, price: 28,  base_price: 30  },
      { id: 'item_021', product_id: 'p21', variant_id: 'v21', sku_code: 'SKU-021', name: 'Fortune Sunflower Oil (1 L)', quantity: 1, price: 145, base_price: 150 },
    ],
    sub_total:    173,
    tax:          0,
    delivery_fee: 29,
    platform_fee: 5,
    grand_total:  207,
    status: 'cancelled',
    delivered_at: null,
    delivery_info: {
      address: '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
      lat: 13.0827,
      lng: 80.2707,
    },
    payment_method: 'UPI',
    payment_status: 'refunded',
    delivery_time: '20-25',
    invoice_url: null,
    tracking: [
      { label: 'Order Placed',      done: true,  time: '8:05 AM' },
      { label: 'Store Confirmed',   done: false, time: null },
      { label: 'Packed & Ready',    done: false, time: null },
      { label: 'Out for Delivery',  done: false, time: null },
      { label: 'Delivered',         done: false, time: null },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeid(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function buildTracking(now) {
  const base = new Date(now);
  const fmt  = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return [
    { label: 'Order Placed',     done: true,  time: fmt(base) },
    { label: 'Store Confirmed',  done: false, time: null },
    { label: 'Packed & Ready',   done: false, time: null },
    { label: 'Out for Delivery', done: false, time: null },
    { label: 'Delivered',        done: false, time: null },
  ];
}

// ─── API surface ──────────────────────────────────────────────────────────────

const MOCK_DELAY = 1200;

export const OrdersAPI = {
  /**
   * GET /orders
   * Returns the user's full order history, newest first.
   */
  async getOrders() {
    await new Promise(r => setTimeout(r, MOCK_DELAY));
    return [..._orders].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
  },

  /**
   * GET /orders/:id
   */
  async getOrder(id) {
    await new Promise(r => setTimeout(r, 500));
    const order = _orders.find(o => o.id === id);
    if (!order) throw new Error(`Order ${id} not found`);
    return { ...order };
  },

  /**
   * POST /orders/place-order
   * Places a new order and returns the created booking.
   */
  async placeOrder({ store_id, store_name, business_id, items, sub_total, tax, delivery_fee, platform_fee, grand_total, payment_method, delivery_info, delivery_time }) {
    await new Promise(r => setTimeout(r, 1400));

    const now      = new Date().toISOString();
    const newOrder = {
      id:            `BK-${makeid(6)}`,
      created_at:    now,
      store_id:      store_id ?? 'unknown',
      store_name:    store_name ?? 'Store',
      items,
      sub_total,
      tax:           tax ?? 0,
      delivery_fee,
      platform_fee,
      grand_total,
      status:        'processing',
      delivered_at:  null,
      delivery_info,
      payment_method: payment_method ?? 'COD',
      payment_status: 'paid',
      delivery_time,
      invoice_url:   null,
      tracking:      buildTracking(now),
    };

    _orders.push(newOrder);
    return { ...newOrder };
  },
};
