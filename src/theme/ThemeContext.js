import React, { createContext, useContext } from 'react';
import { theme } from './theme';

const ThemeContext = createContext(theme);

/**
 * ThemeProvider — wrap the app root to provide the design system globally.
 * Extend this with a `darkTheme` variant in the future if needed.
 */
export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Access the theme anywhere in the component tree. */
export function useTheme() {
  return useContext(ThemeContext);
}
