---
name: analytics-management
description: "Use when adding, modifying, or auditing analytics events, screen tracking, or identify calls in the Aileesa app. Covers event naming conventions, the full event catalogue, instrumentation patterns (track/screen/identify), and the provider contract. Use for every user-facing action that needs instrumentation."
argument-hint: "Which screen or component needs analytics tracking?"
user-invocable: true
---

# Analytics Event Management

## When to Use
- Adding event tracking to a new screen or component
- Auditing existing events for consistency
- Adding a new user action that should be instrumented
- Fixing event properties or naming
- Setting up screen view tracking (`Analytics.screen()`)

## Architecture

```
Component → Analytics.track('event_name', { props }) 
              → withGlobalParams({ user_id, platform, ... })
                → PostHogProvider.capture(event, mergedProps)
                  → posthog-react-native SDK
```

**All instrumentation must go through the facade** — never import or call PostHog directly. To swap providers (e.g. to Mixpanel), create a new adapter in `src/api/analyticsProviders/` implementing the contract and change one import in `analytics.js`.

## Step-by-Step: Adding a New Event

### 1. Determine the Event Category
| Category   | Prefix       | Scope |
|------------|-------------|-------|
| Auth       | `auth_`      | Login/logout, OTP flow |
| Discovery  | `store_`     | Store browsing, search, category |
| Cart       | `cart_`      | Add/remove items, conflicts |
| Checkout   | `checkout_` / `order_` / `address_` | Purchase funnel |
| Post-order | `order_`     | History, detail views |
| Location   | `serviceability_` | Permission, GPS, flash |
| Navigation | `screen_view` | Screen views (via Analytics.screen) |
| Engagement | `cta_` / `view_` | CTA taps, content views |

### 2. Name the Event
Format: `{category}_{past_tense_verb}` or `{category}_{noun}_{past_tense_verb}`
- ✅ `item_added`, `store_card_tapped`, `order_placed`
- ❌ `addItem`, `onCardPress`, `orderSuccessView`

### 3. Choose Properties
- Include identifiers: `store_id`, `order_id`, `item_id`
- Include context: `auth_state`, `source`, `channel`
- Include quantitative data: `item_count`, `grand_total`, `price`
- Properties use snake_case matching the backend API contract
- Never include PII in event properties (phone, email, full name)

### 4. Instrument the Code
```js
// Screen view tracking (every screen must call this)
Analytics.screen('screen_name', {
  screen_prop_1: value,
  screen_prop_2: value,
});

// Action tracking
Analytics.track('event_name', {
  prop1: value1,
  prop2: value2,
});

// User identification (on login only)
Analytics.identify(userId, { name, phone });
```

### 5. Add to the Catalogue
Update the EVENT CATALOGUE JSDoc in `src/api/analytics.js` so the list stays accurate.

## Patterns by Component Type

### Screen (new screen)
```js
import { Analytics } from '../../api/analytics';

// In the component:
useEffect(() => {
  Analytics.screen('screen_name', { prop: value });
}, []);
```

### Screen with focus events
```js
useFocusEffect(useCallback(() => {
  Analytics.screen('screen_name', { prop: value });
  Analytics.track('event_name', { prop: value });
  return () => {
    // cleanup if needed
  };
}, []));
```

### Context (for cross-cutting events)
```js
// In AuthContext after login:
Analytics.identify(resolvedUser.id, { name: resolvedUser.name, phone: resolvedUser.phone });
Analytics.track('otp_verified', { is_new_user: isNewUser });
```

### Reusable component
```js
// Track inside the component itself (not the parent) for consistency.
// Pass a `source` prop for context:
<CartFloatingCard source="store_list_page" onPress={handlePress} />
// CartFloatingCard internally fires view_cart_cta_clicked — parents should NOT duplicate.
```

## Common Mistakes
1. **Calling `Analytics.track()` in parents when the child already fires it** — results in duplicate events (e.g., `view_cart_cta_clicked` is handled by `CartFloatingCard`)
2. **Missing `Analytics.screen()`** — every screen needs a screen view event for funnel analysis
3. **Not calling `Analytics.identify()` on bootstrap** — returning users won't have events linked to their profile
4. **Calling PostHog directly** — always use the `Analytics` facade
5. **Using camelCase or kebab-case event names** — use snake_case consistently
6. **Omitting critical context props** — always include identifiers (`_id` fields) and state flags (`auth_state`, `is_open`)

## Reference
- Full event catalogue with properties: [./references/event-catalogue.md](./references/event-catalogue.md)
- Analytics facade: `src/api/analytics.js`
- Provider contract: `src/api/analyticsProviders/posthog.js`
- Existing events can be grepped: `grep -r "Analytics\.track\|Analytics\.screen\|Analytics\.identify" src/`
