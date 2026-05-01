/**
 * Toast.js — Lightweight error/info toast notification.
 *
 * Usage:
 *   const [toastMsg, setToastMsg] = useState('');
 *   <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />
 *
 * When `message` becomes truthy the toast fades in, waits, then fades out
 * and calls `onDismiss` so the parent can clear the message.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FADE_MS  = 250;
const HOLD_MS  = 2500;

export default function Toast({ message, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets  = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDismiss?.();
    });

    return () => anim.stop();
  }, [message]); // re-run on every new message

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { opacity, bottom: insets.bottom + 108 },
      ]}
    >
      <Text style={styles.text} numberOfLines={3}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 20,
    backgroundColor: '#16172B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'center',
  },
});
