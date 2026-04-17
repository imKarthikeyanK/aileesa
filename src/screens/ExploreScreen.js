import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import ComingSoon from '../components/ComingSoon';
import { theme } from '../theme/theme';

export default function ExploreScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ComingSoon
        title="Explore"
        subtitle="Discover local gems, trending stores, and curated collections near you."
      />
    </SafeAreaView>
  );
}
