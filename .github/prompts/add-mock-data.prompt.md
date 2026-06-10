---
description: "Add mock data fixtures for a new API endpoint in the Aileesa app. Pass the mock data shape and endpoint name."
agent: "agent"
tools: [read, edit, search]
---

Add mock data fixtures to `src/api/mockData.js` for a new API endpoint.

Follow these conventions:
1. Prefix constant names with `MOCK_` (e.g. `MOCK_NEW_FEATURES`)
2. Use snake_case field names matching backend contract
3. Keep mock data realistic — use real product names, addresses, prices
4. Export the constant for use in the API module
5. Update the API module to use the new mock data when `USE_MOCK` is true
