/**
 * ordersApi.js — Order placement and order history endpoints.
 *
 * All functions return a Promise. Swap mock implementations with real
 * fetch/axios calls without touching any screen code.
 */

// ─── Mock in-memory store ──────────────────────────────────────────────────────
// Pre-seeded with some history so the UI is non-empty from the start.

const _orders = [
  {
    id: 'BK-2025-0412',
    createdAt: '2025-04-12T10:32:00.000Z',
    storeId: '1',
    storeName: 'Green Basket',
    items: [
      { name: 'Amul Butter (100 g)', qty: 2, price: 56 },
      { name: 'Full Cream Milk (500 ml)', qty: 1, price: 32 },
      { name: 'Brown Bread', qty: 1, price: 45 },
    ],
    subtotal: 189,
    delivery: 29,
    platform: 5,
    grandTotal: 223,
    status: 'delivered',
    deliveredAt: '2025-04-12T11:04:00.000Z',
    address: '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
    paymentMethod: 'UPI',
    paymentStatus: 'paid',
    invoiceUrl: null,
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
    createdAt: '2025-04-05T14:18:00.000Z',
    storeId: '2',
    storeName: 'The Bread Box',
    items: [
      { name: 'Sourdough Loaf', qty: 1, price: 160 },
      { name: 'Butter Croissant (2 pcs)', qty: 1, price: 90 },
    ],
    subtotal: 250,
    delivery: 0,
    platform: 5,
    grandTotal: 255,
    status: 'delivered',
    deliveredAt: '2025-04-05T14:55:00.000Z',
    address: '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'paid',
    invoiceUrl: null,
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
    createdAt: '2025-03-21T08:05:00.000Z',
    storeId: '1',
    storeName: 'Green Basket',
    items: [
      { name: 'Tata Salt (1 kg)',   qty: 1, price: 28 },
      { name: 'Fortune Sunflower Oil (1 L)', qty: 1, price: 145 },
    ],
    subtotal: 173,
    delivery: 29,
    platform: 5,
    grandTotal: 207,
    status: 'cancelled',
    deliveredAt: null,
    address: '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
    paymentMethod: 'UPI',
    paymentStatus: 'refunded',
    invoiceUrl: null,
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
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
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
   * POST /orders
   * Places a new order and returns the created booking.
   */
  async placeOrder({ items, subtotal, delivery, platform, grandTotal, storeGroups }) {
    await new Promise(r => setTimeout(r, 1400));

    const now     = new Date().toISOString();
    const store   = storeGroups?.[0] ?? {};
    const newOrder = {
      id:            `BK-${makeid(6)}`,
      createdAt:     now,
      storeId:       store.storeId ?? 'unknown',
      storeName:     store.storeName ?? 'Store',
      items:         items.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
      subtotal,
      delivery,
      platform,
      grandTotal,
      status:        'processing',
      deliveredAt:   null,
      address:       '14, Sunrise Apartments, Anna Nagar, Chennai - 600040',
      paymentMethod: 'UPI',
      paymentStatus: 'paid',
      invoiceUrl:    null,
      tracking:      buildTracking(now),
    };

    _orders.push(newOrder);
    return { ...newOrder };
  },
};
