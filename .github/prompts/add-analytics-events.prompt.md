---
description: "Add analytics tracking to a screen or component in the Aileesa app. Pass the file path and describe which user actions need tracking."
agent: "agent"
tools: [read, edit, search]
---

Add analytics instrumentation to the provided file following Aileesa's analytics patterns:

1. Import `Analytics` from `'../../api/analytics'` (adjust relative path as needed)
2. Track screen views via `Analytics.screen('screen_name', { /* relevant props */ })` in `useFocusEffect`
3. Track user actions via `Analytics.track('event_name', { /* relevant properties */ })`
4. Use the event category prefixes: `auth_`, `store_`, `item_`, `cart_`, `checkout_`, `order_`, `address_`

Refer to the event catalogue in `src/api/analytics.js` for the full list of existing events.
