/**
 * mockData.js — Centralised mock fixtures for all API endpoints.
 *
 * Field conventions (snake_case, matching backend contract):
 *   store list / detail  →  id, name, category, rating, review_count,
 *                           delivery_time, distance, cover_bg, icon,
 *                           icon_color, tag, tag_color, is_open
 *   store detail extras  →  address, phone, timing, total_orders, total_products
 *   inventory item       →  id, name, unit, price, base_price (MRP),
 *                           icon, icon_bg, icon_color, badge,
 *                           active, multi_add, max_quantity_per_item
 *
 * Swap these fixtures for real HTTP responses without touching any screen code.
 */

// ─── Store List ────────────────────────────────────────────────────────────────

export const MOCK_STORES = [
  {
    id: '1',
    name: 'Green Basket',
    category: 'Grocery',
    rating: 4.8,
    review_count: 1240,
    delivery_time: '15–25 min',
    distance: '0.8 km',
    cover_bg: '#E8F5E9',
    icon: 'leaf',
    icon_color: '#2E7D32',
    tag: 'Popular',
    tag_color: '#6200EE',
    is_open: true,
  },
  {
    id: '2',
    name: 'The Bread Box',
    category: 'Bakery',
    rating: 4.7,
    review_count: 856,
    delivery_time: '20–30 min',
    distance: '1.2 km',
    cover_bg: '#FFF8E1',
    icon: 'cafe',
    icon_color: '#E65100',
    tag: 'New',
    tag_color: '#10B981',
    is_open: true,
  },
  {
    id: '3',
    name: 'MediQuick',
    category: 'Pharmacy',
    rating: 4.6,
    review_count: 540,
    delivery_time: '10–20 min',
    distance: '0.5 km',
    cover_bg: '#E3F2FD',
    icon: 'medkit',
    icon_color: '#1565C0',
    tag: 'Open 24×7',
    tag_color: '#1565C0',
    is_open: true,
  },
  {
    id: '4',
    name: 'TechHub Local',
    category: 'Electronics',
    rating: 4.5,
    review_count: 320,
    delivery_time: '30–45 min',
    distance: '2.1 km',
    cover_bg: '#F3E5F5',
    icon: 'hardware-chip',
    icon_color: '#6A1B9A',
    tag: null,
    tag_color: null,
    is_open: false,
  },
  {
    id: '5',
    name: 'Style Street',
    category: 'Fashion',
    rating: 4.4,
    review_count: 628,
    delivery_time: '25–35 min',
    distance: '1.7 km',
    cover_bg: '#FCE4EC',
    icon: 'shirt',
    icon_color: '#AD1457',
    tag: 'Trending',
    tag_color: '#AD1457',
    is_open: true,
  },
  {
    id: '6',
    name: 'Daily Picks',
    category: 'Grocery',
    rating: 4.9,
    review_count: 2100,
    delivery_time: '12–20 min',
    distance: '0.3 km',
    cover_bg: '#E0F7FA',
    icon: 'cart',
    icon_color: '#00695C',
    tag: 'Top Rated',
    tag_color: '#FBBF24',
    is_open: true,
  },
  {
    id: '7',
    name: 'PureHerbs',
    category: 'Wellness',
    rating: 4.6,
    review_count: 410,
    delivery_time: '18–28 min',
    distance: '1.4 km',
    cover_bg: '#F1F8E9',
    icon: 'flower',
    icon_color: '#558B2F',
    tag: 'Organic',
    tag_color: '#10B981',
    is_open: true,
  },
  {
    id: '8',
    name: 'Pet Paradise',
    category: 'Pet Supplies',
    rating: 4.8,
    review_count: 290,
    delivery_time: '30–40 min',
    distance: '2.3 km',
    cover_bg: '#FFF3E0',
    icon: 'paw',
    icon_color: '#E65100',
    tag: 'New',
    tag_color: '#6200EE',
    is_open: true,
  },
];

// ─── Store Details (list item + extended fields) ───────────────────────────────

export const MOCK_STORE_DETAILS = {
  '1': {
    ...MOCK_STORES[0],
    address: '12, MG Road, Koramangala, Bangalore – 560034',
    phone: '+91 98765 43210',
    timing: '7 AM – 11 PM',
    total_orders: 12400,
    total_products: 48,
  },
  '2': {
    ...MOCK_STORES[1],
    address: '7, Residency Road, Shivajinagar, Bangalore – 560025',
    phone: '+91 98765 43211',
    timing: '6 AM – 10 PM',
    total_orders: 8560,
    total_products: 32,
  },
  '3': {
    ...MOCK_STORES[2],
    address: '3, Brigade Road, Commercial Street, Bangalore – 560001',
    phone: '+91 98765 43212',
    timing: '24 Hours',
    total_orders: 5400,
    total_products: 60,
  },
  '4': {
    ...MOCK_STORES[3],
    address: '41, Indiranagar 100ft Road, Bangalore – 560038',
    phone: '+91 98765 43213',
    timing: '10 AM – 9 PM',
    total_orders: 3200,
    total_products: 24,
  },
  '5': {
    ...MOCK_STORES[4],
    address: '8, UB City Mall, Vittal Mallya Rd, Bangalore – 560001',
    phone: '+91 98765 43214',
    timing: '10 AM – 10 PM',
    total_orders: 6280,
    total_products: 120,
  },
  '6': {
    ...MOCK_STORES[5],
    address: '22, HSR Layout 5th Sector, Bangalore – 560102',
    phone: '+91 98765 43215',
    timing: '6 AM – 12 AM',
    total_orders: 21000,
    total_products: 80,
  },
  '7': {
    ...MOCK_STORES[6],
    address: '14, Jayanagar 4th Block, Bangalore – 560041',
    phone: '+91 98765 43216',
    timing: '8 AM – 9 PM',
    total_orders: 4100,
    total_products: 36,
  },
  '8': {
    ...MOCK_STORES[7],
    address: '6, Bannerghatta Road, JP Nagar, Bangalore – 560078',
    phone: '+91 98765 43217',
    timing: '9 AM – 9 PM',
    total_orders: 2900,
    total_products: 45,
  },
};

// ─── Inventories (per store, sections; paginated 2 sections/page) ──────────────
// active        : whether item can be added to cart
// multi_add     : true → quantity stepper; false → single ADD/ADDED toggle
// max_quantity_per_item: upper bound enforced by stepper

export const MOCK_INVENTORIES = {
  // ── Green Basket (Grocery) ─────────────────────────────────────────────────
  '1': [
    {
      id: 'gr-pop',
      title: 'Popular',
      items: [
        { id: 'g1', name: 'Organic Bananas', unit: '6 pcs', price: 49, base_price: 60, icon: 'nutrition', icon_bg: '#E8F5E9', icon_color: '#2E7D32', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 10 },
        { id: 'g2', name: 'Farm Fresh Eggs', unit: 'Dozen', price: 89, base_price: 99, icon: 'egg-outline', icon_bg: '#FFF8E1', icon_color: '#F57F17', badge: null, active: true, multi_add: true, max_quantity_per_item: 5 },
        { id: 'g3', name: 'Amul Butter', unit: '500 g', price: 270, base_price: 280, icon: 'cube-outline', icon_bg: '#E3F2FD', icon_color: '#1565C0', badge: null, active: true, multi_add: true, max_quantity_per_item: 3 },
      ],
    },
    {
      id: 'gr-new',
      title: 'New Arrivals',
      items: [
        { id: 'g4', name: 'Hass Avocado', unit: '2 pcs', price: 120, base_price: 140, icon: 'leaf', icon_bg: '#E8F5E9', icon_color: '#2E7D32', badge: 'New', active: true, multi_add: true, max_quantity_per_item: 6 },
        { id: 'g5', name: 'Quinoa Seeds', unit: '500 g', price: 210, base_price: 240, icon: 'flower-outline', icon_bg: '#F3E5F5', icon_color: '#7B1FA2', badge: 'New', active: false, multi_add: true, max_quantity_per_item: 4 },
      ],
    },
    {
      id: 'gr-fruits',
      title: 'Fruits & Veggies',
      items: [
        { id: 'g6', name: 'Red Apples', unit: '1 kg', price: 159, base_price: 180, icon: 'nutrition', icon_bg: '#FCE4EC', icon_color: '#C62828', badge: null, active: true, multi_add: true, max_quantity_per_item: 5 },
        { id: 'g7', name: 'Baby Spinach', unit: '250 g', price: 45, base_price: 55, icon: 'leaf-outline', icon_bg: '#E8F5E9', icon_color: '#388E3C', badge: null, active: true, multi_add: true, max_quantity_per_item: 8 },
        { id: 'g8', name: 'Cherry Tomatoes', unit: '300 g', price: 65, base_price: 70, icon: 'ellipse-outline', icon_bg: '#FCE4EC', icon_color: '#B71C1C', badge: null, active: false, multi_add: true, max_quantity_per_item: 5 },
      ],
    },
  ],

  // ── The Bread Box (Bakery) ─────────────────────────────────────────────────
  '2': [
    {
      id: 'bk-pop',
      title: 'Popular',
      items: [
        { id: 'b1', name: 'Sourdough Loaf', unit: '400 g', price: 120, base_price: 140, icon: 'cafe', icon_bg: '#FFF8E1', icon_color: '#E65100', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 3 },
        { id: 'b2', name: 'Butter Croissant', unit: '2 pcs', price: 80, base_price: 90, icon: 'cafe-outline', icon_bg: '#FFF8E1', icon_color: '#BF360C', badge: null, active: true, multi_add: true, max_quantity_per_item: 5 },
        { id: 'b3', name: 'Cinnamon Roll', unit: '1 pc', price: 65, base_price: 75, icon: 'radio-button-off', icon_bg: '#FBE9E7', icon_color: '#BF360C', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
    {
      id: 'bk-fresh',
      title: 'Fresh Today',
      items: [
        { id: 'b4', name: 'Blueberry Muffin', unit: '2 pcs', price: 110, base_price: 120, icon: 'ellipse', icon_bg: '#EDE7F6', icon_color: '#4527A0', badge: 'Fresh', active: true, multi_add: true, max_quantity_per_item: 4 },
        { id: 'b5', name: 'Banana Bread', unit: '300 g', price: 95, base_price: 110, icon: 'nutrition-outline', icon_bg: '#FFF8E1', icon_color: '#F9A825', badge: 'New', active: false, multi_add: true, max_quantity_per_item: 3 },
      ],
    },
    {
      id: 'bk-cakes',
      title: 'Cakes & Pastries',
      items: [
        { id: 'b6', name: 'Chocolate Truffle', unit: '1 slice', price: 130, base_price: 150, icon: 'heart', icon_bg: '#FCE4EC', icon_color: '#C62828', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'b7', name: 'Tiramisu Cup', unit: '1 pc', price: 160, base_price: 180, icon: 'snow-outline', icon_bg: '#E8EAF6', icon_color: '#283593', badge: null, active: true, multi_add: true, max_quantity_per_item: 2 },
      ],
    },
  ],

  // ── MediQuick (Pharmacy) ───────────────────────────────────────────────────
  '3': [
    {
      id: 'ph-pop',
      title: 'Popular',
      items: [
        { id: 'ph1', name: 'Vitamin C 1000 mg', unit: '30 tabs', price: 189, base_price: 220, icon: 'medical', icon_bg: '#E3F2FD', icon_color: '#1565C0', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 5 },
        { id: 'ph2', name: 'Hand Sanitizer', unit: '200 ml', price: 79, base_price: 99, icon: 'water', icon_bg: '#E0F7FA', icon_color: '#00838F', badge: null, active: true, multi_add: true, max_quantity_per_item: 6 },
        { id: 'ph3', name: 'Paracetamol 500', unit: 'Strip of 10', price: 22, base_price: 25, icon: 'medkit', icon_bg: '#E3F2FD', icon_color: '#1565C0', badge: null, active: true, multi_add: true, max_quantity_per_item: 10 },
      ],
    },
    {
      id: 'ph-new',
      title: 'New Arrivals',
      items: [
        { id: 'ph4', name: 'Omega-3 Fish Oil', unit: '60 caps', price: 349, base_price: 399, icon: 'fish', icon_bg: '#E0F7FA', icon_color: '#006064', badge: 'New', active: true, multi_add: true, max_quantity_per_item: 3 },
        { id: 'ph5', name: 'Collagen Gummies', unit: '30 pcs', price: 499, base_price: 549, icon: 'star', icon_bg: '#FFF8E1', icon_color: '#F9A825', badge: 'New', active: false, multi_add: true, max_quantity_per_item: 2 },
      ],
    },
    {
      id: 'ph-skin',
      title: 'Skincare',
      items: [
        { id: 'ph6', name: 'Sunscreen SPF 50', unit: '100 ml', price: 280, base_price: 320, icon: 'sunny', icon_bg: '#FFF9C4', icon_color: '#F9A825', badge: null, active: true, multi_add: true, max_quantity_per_item: 3 },
        { id: 'ph7', name: 'Daily Moisturizer', unit: '75 ml', price: 199, base_price: 230, icon: 'water-outline', icon_bg: '#E3F2FD', icon_color: '#1565C0', badge: null, active: true, multi_add: true, max_quantity_per_item: 4 },
      ],
    },
  ],

  // ── TechHub Local (Electronics) ────────────────────────────────────────────
  '4': [
    {
      id: 'el-pop',
      title: 'Popular',
      items: [
        { id: 'e1', name: 'USB-C Cable 2 m', unit: '1 pc', price: 299, base_price: 399, icon: 'hardware-chip', icon_bg: '#F3E5F5', icon_color: '#6A1B9A', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 5 },
        { id: 'e2', name: 'Wireless Earbuds', unit: '1 pair', price: 1299, base_price: 1599, icon: 'headset', icon_bg: '#EDE7F6', icon_color: '#4527A0', badge: null, active: false, multi_add: true, max_quantity_per_item: 2 },
        { id: 'e3', name: '20 W Fast Charger', unit: '1 pc', price: 649, base_price: 799, icon: 'flash', icon_bg: '#FFF8E1', icon_color: '#F9A825', badge: null, active: true, multi_add: true, max_quantity_per_item: 3 },
      ],
    },
    {
      id: 'el-new',
      title: 'New Arrivals',
      items: [
        { id: 'e4', name: 'Smart Watch Band', unit: '1 pc', price: 499, base_price: 599, icon: 'watch', icon_bg: '#F3E5F5', icon_color: '#6A1B9A', badge: 'New', active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'e5', name: 'Screen Protector', unit: '2 pcs', price: 249, base_price: 299, icon: 'phone-portrait', icon_bg: '#E8EAF6', icon_color: '#283593', badge: 'New', active: true, multi_add: true, max_quantity_per_item: 4 },
      ],
    },
    {
      id: 'el-acc',
      title: 'Accessories',
      items: [
        { id: 'e6', name: 'Laptop Stand', unit: '1 pc', price: 799, base_price: 999, icon: 'desktop', icon_bg: '#EDE7F6', icon_color: '#4527A0', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'e7', name: 'XL Mouse Pad', unit: '1 pc', price: 349, base_price: 449, icon: 'game-controller', icon_bg: '#F3E5F5', icon_color: '#6A1B9A', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
  ],

  // ── Style Street (Fashion) ─────────────────────────────────────────────────
  '5': [
    {
      id: 'fa-pop',
      title: 'Popular',
      items: [
        { id: 'f1', name: 'Classic White Tee', unit: 'S / M / L / XL', price: 499, base_price: 699, icon: 'shirt', icon_bg: '#FCE4EC', icon_color: '#AD1457', badge: 'Top Pick', active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'f2', name: 'Slim Chinos', unit: '30–36 in', price: 1299, base_price: 1799, icon: 'person-outline', icon_bg: '#EDE7F6', icon_color: '#4527A0', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'f3', name: 'Canvas Sneakers', unit: '6–11 UK', price: 1499, base_price: 1999, icon: 'walk-outline', icon_bg: '#FFF8E1', icon_color: '#F9A825', badge: null, active: false, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
    {
      id: 'fa-new',
      title: 'New Arrivals',
      items: [
        { id: 'f4', name: 'Linen Kurta', unit: 'S / M / L / XL', price: 799, base_price: 999, icon: 'shirt-outline', icon_bg: '#E8F5E9', icon_color: '#2E7D32', badge: 'New', active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'f5', name: 'Sling Bag', unit: '1 pc', price: 899, base_price: 1199, icon: 'bag', icon_bg: '#FCE4EC', icon_color: '#AD1457', badge: 'New', active: true, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
    {
      id: 'fa-acc',
      title: 'Accessories',
      items: [
        { id: 'f6', name: 'Leather Belt', unit: 'S / M / L', price: 599, base_price: 799, icon: 'ellipse', icon_bg: '#FBE9E7', icon_color: '#BF360C', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'f7', name: 'Aviator Sunglasses', unit: '1 pc', price: 699, base_price: 999, icon: 'eye-outline', icon_bg: '#E8EAF6', icon_color: '#283593', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
  ],

  // ── Daily Picks (Grocery) ──────────────────────────────────────────────────
  '6': [
    {
      id: 'dp-pop',
      title: 'Popular',
      items: [
        { id: 'dp1', name: 'Tata Salt', unit: '1 kg', price: 24, base_price: 28, icon: 'cube', icon_bg: '#E8F5E9', icon_color: '#2E7D32', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 10 },
        { id: 'dp2', name: 'Fortune Rice', unit: '5 kg', price: 280, base_price: 310, icon: 'nutrition', icon_bg: '#FFF8E1', icon_color: '#E65100', badge: null, active: true, multi_add: true, max_quantity_per_item: 4 },
        { id: 'dp3', name: 'Aashirvaad Atta', unit: '10 kg', price: 420, base_price: 460, icon: 'flower', icon_bg: '#FFF8E1', icon_color: '#F57F17', badge: null, active: true, multi_add: true, max_quantity_per_item: 3 },
      ],
    },
    {
      id: 'dp-dairy',
      title: 'Dairy & Beverages',
      items: [
        { id: 'dp4', name: 'Nandini Full Cream Milk', unit: '1 L', price: 64, base_price: 68, icon: 'water', icon_bg: '#E3F2FD', icon_color: '#1565C0', badge: 'Fresh', active: true, multi_add: true, max_quantity_per_item: 8 },
        { id: 'dp5', name: 'Tropicana Orange', unit: '1 L', price: 120, base_price: 135, icon: 'sunny', icon_bg: '#FFF9C4', icon_color: '#F9A825', badge: null, active: true, multi_add: true, max_quantity_per_item: 5 },
        { id: 'dp6', name: 'Amul Lassi', unit: '200 ml × 6', price: 90, base_price: null, icon: 'cafe', icon_bg: '#FFF8E1', icon_color: '#BF360C', badge: null, active: false, multi_add: true, max_quantity_per_item: 4 },
      ],
    },
    {
      id: 'dp-snacks',
      title: 'Snacks & Instant',
      items: [
        { id: 'dp7', name: 'Lays Classic Salted', unit: '80 g', price: 20, base_price: 20, icon: 'leaf-outline', icon_bg: '#FFF8E1', icon_color: '#F9A825', badge: null, active: true, multi_add: true, max_quantity_per_item: 10 },
        { id: 'dp8', name: 'Maggi Noodles', unit: '4 packs × 70 g', price: 60, base_price: 68, icon: 'restaurant', icon_bg: '#FCE4EC', icon_color: '#C62828', badge: null, active: true, multi_add: true, max_quantity_per_item: 6 },
      ],
    },
  ],

  // ── PureHerbs (Wellness) ───────────────────────────────────────────────────
  '7': [
    {
      id: 'wl-pop',
      title: 'Popular',
      items: [
        { id: 'w1', name: 'Ashwagandha 500 mg', unit: '60 caps', price: 349, base_price: 399, icon: 'flower', icon_bg: '#F1F8E9', icon_color: '#558B2F', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 3 },
        { id: 'w2', name: 'Moringa Powder', unit: '200 g', price: 259, base_price: 299, icon: 'leaf', icon_bg: '#E8F5E9', icon_color: '#2E7D32', badge: null, active: true, multi_add: true, max_quantity_per_item: 4 },
        { id: 'w3', name: 'Immunity Shots', unit: '6 pcs', price: 180, base_price: 210, icon: 'flash', icon_bg: '#FFF9C4', icon_color: '#F9A825', badge: null, active: true, multi_add: true, max_quantity_per_item: 5 },
      ],
    },
    {
      id: 'wl-new',
      title: 'New Arrivals',
      items: [
        { id: 'w4', name: 'Collagen Serum', unit: '30 ml', price: 799, base_price: 949, icon: 'sparkles', icon_bg: '#EDE7F6', icon_color: '#6A1B9A', badge: 'New', active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'w5', name: 'Magnesium Spray', unit: '100 ml', price: 549, base_price: 649, icon: 'water', icon_bg: '#E0F7FA', icon_color: '#00838F', badge: 'New', active: false, multi_add: true, max_quantity_per_item: 3 },
      ],
    },
    {
      id: 'wl-yoga',
      title: 'Yoga & Fitness',
      items: [
        { id: 'w6', name: 'Premium Yoga Mat', unit: '6 mm', price: 899, base_price: 1099, icon: 'fitness', icon_bg: '#F1F8E9', icon_color: '#558B2F', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'w7', name: 'Resistance Bands', unit: 'Set of 3', price: 399, base_price: 499, icon: 'barbell-outline', icon_bg: '#EDE7F6', icon_color: '#4527A0', badge: null, active: true, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
  ],

  // ── Pet Paradise (Pet Supplies) ────────────────────────────────────────────
  '8': [
    {
      id: 'pt-pop',
      title: 'Popular',
      items: [
        { id: 'pt1', name: 'Royal Canin Dog Food', unit: '2 kg', price: 899, base_price: 999, icon: 'paw', icon_bg: '#FFF3E0', icon_color: '#E65100', badge: 'Top Pick', active: true, multi_add: true, max_quantity_per_item: 4 },
        { id: 'pt2', name: 'Cat Litter Crystal', unit: '4 kg', price: 649, base_price: 749, icon: 'star-outline', icon_bg: '#F3E5F5', icon_color: '#6A1B9A', badge: null, active: true, multi_add: true, max_quantity_per_item: 3 },
        { id: 'pt3', name: 'Pet Shampoo', unit: '200 ml', price: 249, base_price: 299, icon: 'water', icon_bg: '#E0F7FA', icon_color: '#006064', badge: null, active: true, multi_add: true, max_quantity_per_item: 5 },
      ],
    },
    {
      id: 'pt-new',
      title: 'New Arrivals',
      items: [
        { id: 'pt4', name: 'Interactive Toy', unit: '1 pc', price: 349, base_price: 449, icon: 'game-controller', icon_bg: '#FCE4EC', icon_color: '#AD1457', badge: 'New', active: true, multi_add: false, max_quantity_per_item: 1 },
        { id: 'pt5', name: 'GPS Pet Collar', unit: '1 pc', price: 1499, base_price: 1799, icon: 'locate', icon_bg: '#EDE7F6', icon_color: '#4527A0', badge: 'New', active: false, multi_add: false, max_quantity_per_item: 1 },
      ],
    },
    {
      id: 'pt-health',
      title: 'Health & Care',
      items: [
        { id: 'pt6', name: 'Flea Treatment', unit: '3 doses', price: 549, base_price: 649, icon: 'shield', icon_bg: '#E8F5E9', icon_color: '#2E7D32', badge: null, active: true, multi_add: true, max_quantity_per_item: 3 },
        { id: 'pt7', name: 'Dental Chews', unit: '15 pcs', price: 299, base_price: 349, icon: 'happy', icon_bg: '#FFF8E1', icon_color: '#F9A825', badge: null, active: true, multi_add: true, max_quantity_per_item: 4 },
      ],
    },
  ],
};
