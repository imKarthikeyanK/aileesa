import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import ComingSoon from '../components/ComingSoon';
import { theme } from '../theme/theme';

export default function YouScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ComingSoon
        title="Your Space"
        subtitle="Orders, addresses, rewards, and your personal settings will live here."
      />
    </SafeAreaView>
  );
}
