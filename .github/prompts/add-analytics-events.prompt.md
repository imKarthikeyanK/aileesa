---
description: "Add analytics tracking to a screen or component in the Aileesa app. Pass the file path and describe which user actions need tracking."
agent: "analytics-manager"
tools: [read, edit, search]
---

Add analytics instrumentation to the provided file following Aileesa's instrumentation patterns.

1. Import `Analytics` from `'../../api/analytics'` (adjust relative path as needed)
2. Track screen views via `Analytics.screen('screen_name', { relevant props })` in `useEffect` or `useFocusEffect`
3. Track user actions via `Analytics.track('{category}_{past_tense_verb}', { relevant properties })`
4. Use snake_case event names with the appropriate category prefix

Refer to the full event catalogue at `.github/skills/analytics-management/references/event-catalogue.md` for existing events.
Use the `/analytics-management` skill for detailed procedures, or the `@analytics-manager` agent for complex multi-file instrumentation.
