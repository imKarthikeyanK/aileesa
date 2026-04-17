// Aileesa — Global Design System
// Premium, modern, local-commerce aesthetic

export const theme = {
  colors: {
    background: '#F5F6FA',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F1F8',

    primary: '#16172B',        // Deep navy — authority & premium
    accent: '#E8445A',         // Vibrant red — action & energy
    accentSoft: '#FFF0F3',     // Accent wash for backgrounds
    accentDim: '#F5B8C0',      // Muted accent for borders

    amber: '#FBBF24',          // Ratings & highlights
    success: '#10B981',        // Positive states
    info: '#3B82F6',           // Informational

    text: {
      primary: '#16172B',
      secondary: '#64748B',
      muted: '#94A3B8',
      inverse: '#FFFFFF',
      placeholder: '#B0B9CC',
    },

    border: '#E4E8F4',
    borderStrong: '#CBD5E1',
    divider: '#F1F3F9',

    tabActive: '#E8445A',
    tabInactive: '#94A3B8',
    tabBar: '#FFFFFF',

    // Card accent colors for store avatars
    cardAccents: ['#FFE5EC', '#E8F5E9', '#E3F2FD', '#FFF8E1', '#F3E5F5', '#E0F7FA'],
  },

  typography: {
    sizes: {
      '2xs': 10,
      xs: 11,
      sm: 13,
      base: 15,
      md: 16,
      lg: 18,
      xl: 22,
      '2xl': 26,
      '3xl': 32,
      '4xl': 40,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    lineHeights: {
      tight: 1.2,
      snug: 1.35,
      normal: 1.5,
      relaxed: 1.65,
    },
    letterSpacing: {
      tighter: -1,
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      wider: 1,
      widest: 2.5,
    },
  },

  spacing: {
    '0.5': 2,
    '1': 4,
    '2': 8,
    '3': 12,
    '4': 16,
    '5': 20,
    '6': 24,
    '8': 32,
    '10': 40,
    '12': 48,
    '16': 64,
  },

  radii: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 28,
    '3xl': 36,
    full: 9999,
  },

  shadows: {
    xs: {
      shadowColor: '#16172B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    sm: {
      shadowColor: '#16172B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#16172B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: '#16172B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    accent: {
      shadowColor: '#E8445A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};
