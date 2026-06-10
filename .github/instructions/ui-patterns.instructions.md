---
description: "Use when creating or modifying screens, components, styles, animations, or navigation. Covers design tokens, screen layout patterns, animation conventions, and component best practices."
applyTo: ["src/screens/**", "src/components/**", "src/navigation/**", "src/theme/**"]
---

# UI & Component Conventions

## Design Tokens
- Central theme in `src/theme/theme.js` — colors, typography, spacing, radii, shadows
- Screens define LOCAL color constants at the top (not imported from theme) for bundle efficiency
- Use theme tokens for typography sizes/weights when consistency matters

## Screen Layout Pattern
```js
export default function SomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Screen content */}
    </View>
  );
}
```

## Animation Conventions
- Always set `useNativeDriver: true` (exception: animating layout properties like `height`)
- `Animated.spring` for enter animations (damping: 16-22, stiffness: 200-260, mass: 0.8-0.9)
- `Animated.timing` for exit/transition animations (duration: 200-250ms)
- Use `useRef(new Animated.Value(X))` for animation values — never useState
- Wrap animation loops in `useEffect` with cleanup

## Navigation
- L1 screens (tab screens): keep tab bar visible
- L2+ screens (detail, cart): hide tab bar on focus via `useTabBar().hideTabBar()`
- Use `useFocusEffect` (not `useEffect`) for focus-dependent behavior
- Animation: `slide_from_right` for forward nav, `slide_from_bottom` for modals (LocationPicker)
- On web, set animation to `'none'` to avoid flicker

## Component Patterns
- **Forms**: Single hidden TextInput approach for OTP (focus never hops between boxes)
- **Floating CTAs**: `CartFloatingCard` pattern — absolute positioned, Animated.spring slide-in
- **Modals**: Bottom sheet style with slide-up Animated.spring + fade-in backdrop
- **Toast**: Positioned absolutely, Animated.sequence(fade-in → delay → fade-out)
- **Conflict modals**: Driven by context state at root level, not screen-level

## List Patterns
- Paginated FlatLists with `onEndReached` for infinite scroll (StoreListing, OrderHistory)
- SectionList for sectioned product views (StoreDetail inventory)
- RefreshControl for pull-to-refresh
- `useFocusEffect` for focus-based data reloading with cooldown window

## Feature Flags
- Define at top of screen file: `const FEATURE_NAME = true/false;`
- Use to gate WIP features without removing code
- Remove flag + dead code when feature ships
