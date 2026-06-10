# Aileesa — Project Guidelines

## Tech Stack
- **Framework**: Expo SDK 54 (React Native 0.81.5, React 19.1)
- **Language**: JavaScript (JSX) — no TypeScript
- **Navigation**: React Navigation 7 (bottom tabs + native stacks)
- **State**: React Context + useReducer (no Redux/Zustand)
- **Analytics**: PostHog via facade pattern (`analytics.js`)
- **Build**: EAS Build with dev/sbox/prod profiles

## Code Style
- **File headers**: Every file starts with a JSDoc block comment explaining purpose
- **Naming**: PascalCase for components, camelCase for functions/vars, UPPER_CASE for constants
- **Imports order**: React → RN/Expo → third-party → internal absolute → internal relative
- **Styles**: `StyleSheet.create()` at bottom of component files
- **Exports**: Default export for components, named exports for contexts/utilities
- **Comments**: Use `// ─── Section headers ───` dividers for logical sections

## Architecture
- **Provider nesting** (in `App.js`): GestureHandlerRootView → SafeAreaProvider → AuthProvider → LocationProvider → ThemeProvider → CartProvider → AddressProvider
- **API layer**: Service modules with mock/real pattern (`USE_MOCK` flag in `env.js`); mock data in `mockData.js`
- **Context pattern**: `createContext` + `Provider` component + `useXxx()` hook — all in one file
- **Design system**: Tokens in `src/theme/theme.js`; referencing via `theme.colors.X`, `theme.typography.sizes.X`, etc.
- **Analytics**: Every user-facing action tracked via `Analytics.xxx()` — never call PostHog directly

## Key Conventions
1. **`USE_MOCK` switch**: API modules check this — never hardcode mock logic in components
2. **Platform checks**: Use `Platform.OS` for web/native differences (web uses AsyncStorage/localStorage, native uses SecureStore)
3. **Animations**: Always `useNativeDriver: true`; use `Animated.spring` for enters, `Animated.timing` for exits
4. **SafeArea**: Every screen uses `useSafeAreaInsets()` from `react-native-safe-area-context`
5. **Tab bar**: L2+ screens call `hideTabBar()` on focus, `showTabBar()` on blur via `useTabBar()`
6. **Feature flags**: Define as `const FEATURE_NAME = true/false` at top of the file
7. **Design tokens in screens**: Screens define local color constants rather than importing from theme
8. **API URLs**: Auth → `/ozauth/external/v1`, Business → `/aileesa/external/v1`
9. **Headers**: `requestHeaders.js` auto-attaches x-oz-* headers — just pass `{ accessToken }`
10. **Error handling**: Custom errors with `{ code, message }`; use `errorFactory` callback in httpClient

## Build & Test
- `npm start` — local Expo dev server
- `npm run ios` / `npm run android` / `npm run web` — platform-specific
- `npx eas build --profile development` — dev build
- `npx eas build --profile production` — prod build
- Bump `BUILD_NUMBER` in `src/api/buildConfig.js` + iOS `buildNumber` + Android `versionCode` per release

## Context Window Efficiency
- Prefer reading files with targeted line ranges over full file reads
- Use `semanticSearch` for concept-level queries, `grepSearch` for exact patterns
- Check `/memories/repo/aileesa-codebase.md` for quick architecture reference
- When editing, make focused replacements — avoid re-reading unchanged files
