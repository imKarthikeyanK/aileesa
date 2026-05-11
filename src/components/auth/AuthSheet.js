/**
 * AuthSheet.js — WhatsApp OTP authentication bottom sheet
 *
 * REPLACEABLE COMPONENT
 * ─────────────────────
 * This component owns the entire auth UI flow. The interface is:
 *   <AuthSheet visible={bool} onClose={fn} />
 *
 * To add a new login method (Google, Apple, email, etc.):
 *   1. Create a parallel component with the same { visible, onClose } props
 *   2. It should call useAuth().verifyOtp() or a new context method on success
 *   3. Swap or compose it with AuthSheet in YouScreen (or wherever it's rendered)
 *
 * STEPS
 * ─────
 *   PHONE → user enters name + WhatsApp number → sendOtp() called
 *   OTP   → user enters 6-char alphanumeric code → verifyOtp() called → onClose()
 *
 * DEV MODE
 * ────────
 * When IS_MOCK is true, a yellow banner in the OTP step displays the generated
 * OTP so testers can enter it without a real WhatsApp message.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  TextInput, Animated, Platform, Keyboard, Easing, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { IS_MOCK } from '../../api/authApi';

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY      = '#16172B';
const ACCENT    = '#E8445A';
const SUCCESS   = '#10B981';
const TEXT_SEC  = '#64748B';
const TEXT_MUTED = '#94A3B8';
const BG        = '#F5F6FA';
const BORDER    = '#E4E8F4';
const WHITE     = '#FFFFFF';

const OTP_LENGTH      = 6;
const RESEND_COOLDOWN = 30; // seconds

// ─── Step 1: Phone entry ────────────────────────────────────────────────────────
function PhoneStep({ onOtpSent, onClose }) {
  const { sendOtp } = useAuth();
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const canSend = phone.length === 10;

  const handleSend = async () => {
    if (!canSend || loading) return;
    setError('');
    setLoading(true);
    try {
      const result = await sendOtp(phone);
      onOtpSent({
        requestId: result.requestId,
        phone,
        devOtp: result._devOtp,
      });
    } catch (e) {
      setError(e.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.step}>
      <View style={styles.iconCircle}>
        <Ionicons name="logo-whatsapp" size={30} color="#25D366" />
      </View>

      <Text style={styles.stepTitle}>Login with WhatsApp</Text>
      <Text style={styles.stepSub}>
        We'll send a one-time code to your{'\n'}WhatsApp number
      </Text>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>WhatsApp number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.dialCode}>
            <Text style={styles.dialCodeText}>🇮🇳  +91</Text>
          </View>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="10-digit number"
            placeholderTextColor={TEXT_MUTED}
            value={phone}
            onChangeText={(t) => { setPhone(t.replace(/[^0-9]/g, '').slice(0, 10)); setError(''); }}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={10}
            onSubmitEditing={handleSend}
            autoFocus
          />
        </View>
      </View>

      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={ACCENT} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, (!canSend || loading) && styles.primaryBtnOff]}
        onPress={handleSend}
        disabled={!canSend || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={WHITE} size="small" />
          : (
            <>
              <Text style={styles.primaryBtnText}>Send Code</Text>
              <Ionicons name="arrow-forward" size={18} color={WHITE} />
            </>
          )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        By continuing you agree to our{' '}
        <Text style={styles.disclaimerLink}>Terms</Text>
        {' & '}
        <Text style={styles.disclaimerLink}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

// ─── Step 2: OTP verification ─────────────────────────────────────────────────
function OtpStep({ requestId, phone, name, devOtp, onSuccess, onBack }) {
  const { sendOtp, verifyOtp } = useAuth();

  const [otp, setOtp]                         = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [countdown, setCountdown]             = useState(RESEND_COOLDOWN);
  const [resending, setResending]             = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(requestId);
  const [currentDevOtp, setCurrentDevOtp]     = useState(devOtp);

  const inputRefs = useRef([]);
  const timerRef  = useRef(null);

  // Resend countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    // Auto-focus first box
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearInterval(timerRef.current);
  }, []);

  const otpString = otp.join('');
  const canVerify = otpString.length === OTP_LENGTH && !loading;

  const handleChange = (text, index) => {
    // Accept only alphanumeric, uppercase
    const char = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    const next  = [...otp];
    next[index] = char;
    setOtp(next);
    setError('');
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste — fills all boxes at once
  const handleChange_withPaste = (text, index) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length > 1) {
      // Multi-char paste
      const next = Array(OTP_LENGTH).fill('');
      [...cleaned].forEach((c, i) => { if (i < OTP_LENGTH) next[i] = c; });
      setOtp(next);
      const focusAt = Math.min(cleaned.length, OTP_LENGTH - 1);
      inputRefs.current[focusAt]?.focus();
      setError('');
    } else {
      handleChange(text, index);
    }
  };

  const handleVerify = async () => {
    if (!canVerify) return;
    setError('');
    setLoading(true);
    try {
      await verifyOtp(currentRequestId, otpString, name);
      onSuccess();
    } catch (e) {
      setError(e.message || 'Verification failed. Please try again.');
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const result = await sendOtp(phone);
      setCurrentRequestId(result.requestId);
      setCurrentDevOtp(result._devOtp);
      setOtp(Array(OTP_LENGTH).fill(''));
      // Reset countdown
      setCountdown(RESEND_COOLDOWN);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (e) {
      setError(e.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
  const ss = String(countdown % 60).padStart(2, '0');

  return (
    <View style={styles.step}>
      {/* Dev OTP banner — only shown in mock mode during development */}
      {IS_MOCK && !!currentDevOtp && (
        <View style={styles.devBanner}>
          <Ionicons name="bug-outline" size={13} color="#92400E" />
          <Text style={styles.devBannerText}>
            Dev OTP:{' '}
            <Text style={styles.devOtpValue}>{currentDevOtp}</Text>
          </Text>
        </View>
      )}

      {/* Back to phone step */}
      <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color={TEXT_SEC} />
        <Text style={styles.backLabel}>Change number</Text>
      </TouchableOpacity>

      <View style={styles.iconCircle}>
        <Ionicons name="chatbubble-ellipses-outline" size={28} color="#25D366" />
      </View>

      <Text style={styles.stepTitle}>Enter OTP</Text>
      <Text style={styles.stepSub}>
        Sent to{' '}
        <Text style={{ fontWeight: '700', color: NAVY }}>+91 {phone}</Text>
        {'\n'}via WhatsApp
      </Text>

      {/* 6-box OTP input */}
      <View style={styles.otpRow}>
        {otp.map((char, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputRefs.current[i] = r; }}
            style={[
              styles.otpBox,
              char     && styles.otpBoxFilled,
              !!error  && styles.otpBoxError,
            ]}
            value={char}
            onChangeText={(t) => handleChange_withPaste(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            maxLength={OTP_LENGTH} // allow full paste length
            keyboardType="default"
            autoCapitalize="characters"
            autoCorrect={false}
            selectTextOnFocus
            textAlign="center"
            editable={!loading}
          />
        ))}
      </View>

      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={ACCENT} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, !canVerify && styles.primaryBtnOff]}
        onPress={handleVerify}
        disabled={!canVerify}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={WHITE} size="small" />
          : (
            <>
              <Text style={styles.primaryBtnText}>Verify & Login</Text>
              <Ionicons name="checkmark-circle-outline" size={18} color={WHITE} />
            </>
          )}
      </TouchableOpacity>

      {/* Resend */}
      <TouchableOpacity
        style={styles.resendRow}
        onPress={handleResend}
        disabled={countdown > 0 || resending}
        activeOpacity={0.7}
      >
        {resending
          ? <ActivityIndicator size="small" color={TEXT_MUTED} />
          : countdown > 0
            ? (
              <Text style={styles.resendCooldown}>
                Resend in <Text style={{ fontWeight: '700' }}>{mm}:{ss}</Text>
              </Text>
            )
            : <Text style={styles.resendActive}>Resend OTP</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── AuthSheet — orchestrates both steps ──────────────────────────────────────
export default function AuthSheet({ visible, onClose }) {
  const insets    = useSafeAreaInsets();
  const slideY    = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const keyboardY = useRef(new Animated.Value(0)).current;

  const [step, setStep]     = useState('phone'); // 'phone' | 'otp'
  const [otpCtx, setOtpCtx] = useState(null);   // { requestId, phone, devOtp }

  // ── Keyboard avoidance ─────────────────────────────────────────────────────
  useEffect(() => {
    // On web the browser manages the virtual keyboard via viewport resize;
    // Keyboard.addListener is a no-op stub in react-native-web and the
    // keyboardY value stays at 0, which is the correct default.
    if (Platform.OS === 'web') return;

    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      Animated.timing(keyboardY, {
        toValue: -(e.endCoordinates.height - insets.bottom),
        duration: e.duration ?? 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e) => {
      Animated.timing(keyboardY, {
        toValue: 0,
        duration: e.duration ?? 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const s1 = Keyboard.addListener(showEv, onShow);
    const s2 = Keyboard.addListener(hideEv, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [insets.bottom]);

  // ── Sheet slide-in / slide-out ─────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0, useNativeDriver: true,
          damping: 18, stiffness: 180, mass: 0.75,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1, duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 700, duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 0, duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => { setStep('phone'); setOtpCtx(null); });
    }
  }, [visible]);

  const handleOtpSent = useCallback((ctx) => {
    setOtpCtx(ctx);
    setStep('otp');
  }, []);

  const handleSuccess = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setStep('phone');
    setOtpCtx(null);
  }, []);

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: bgOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Sheet — slides up from bottom, lifted further by keyboard */}
        <Animated.View
          style={[
            styles.sheet,
            {
              position: 'absolute', left: 0, right: 0, bottom: 0,
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY: Animated.add(slideY, keyboardY) }],
            },
          ]}
        >
          <View style={styles.handle} />

          {step === 'phone' && (
            <PhoneStep onOtpSent={handleOtpSent} onClose={onClose} />
          )}
          {step === 'otp' && otpCtx && (
            <OtpStep
              requestId={otpCtx.requestId}
              phone={otpCtx.phone}
              devOtp={otpCtx.devOtp}
              onSuccess={handleSuccess}
              onBack={handleBack}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 12,
  },

  // ── Step container ──────────────────────────────────────────────────────────
  step:       { gap: 14, paddingTop: 2, paddingBottom: 8 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginVertical: 2,
  },
  stepTitle: {
    fontSize: 22, fontWeight: '800', color: NAVY,
    letterSpacing: -0.4, textAlign: 'center',
  },
  stepSub: {
    fontSize: 13, color: TEXT_SEC,
    textAlign: 'center', lineHeight: 20,
  },

  // ── Fields ──────────────────────────────────────────────────────────────────
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SEC },
  input: {
    backgroundColor: BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: NAVY, fontWeight: '500',
  },
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dialCode: {
    backgroundColor: BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 13,
  },
  dialCodeText: { fontSize: 14, fontWeight: '600', color: NAVY },

  // ── OTP boxes ────────────────────────────────────────────────────────────────
  otpRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    gap: 7, marginVertical: 4,
  },
  otpBox: {
    // On web, flex:1 + aspectRatio causes the box to stretch to full sheet
    // height because there is no explicit height ancestor. Use fixed dimensions
    // on web and the original flex/aspectRatio approach on native.
    ...(Platform.OS === 'web'
      ? { width: 44, height: 54 }
      : { flex: 1, aspectRatio: 0.82 }),
    backgroundColor: BG, borderRadius: 12,
    borderWidth: 2, borderColor: BORDER,
    fontSize: 22, fontWeight: '800', color: NAVY,
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: NAVY, backgroundColor: WHITE },
  otpBoxError:  { borderColor: ACCENT, backgroundColor: '#FFF5F5' },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 2,
  },
  primaryBtnOff:  { opacity: 0.42 },
  primaryBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },

  // ── Resend ───────────────────────────────────────────────────────────────────
  resendRow:      { alignItems: 'center', paddingVertical: 2 },
  resendCooldown: { fontSize: 13, color: TEXT_MUTED },
  resendActive:   { fontSize: 13, fontWeight: '700', color: ACCENT },

  // ── Errors ───────────────────────────────────────────────────────────────────
  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 13, color: ACCENT, flex: 1 },

  // ── Dev OTP banner ───────────────────────────────────────────────────────────
  devBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    borderWidth: 1, borderColor: '#FDE68A',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  devBannerText: { fontSize: 13, color: '#92400E', fontWeight: '500', flex: 1 },
  devOtpValue:   { fontWeight: '900', letterSpacing: 3, fontSize: 15 },

  // ── Back row ─────────────────────────────────────────────────────────────────
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
  },
  backLabel: { fontSize: 13, color: TEXT_SEC, fontWeight: '500' },

  // ── Disclaimer ───────────────────────────────────────────────────────────────
  disclaimer:     { fontSize: 11, color: TEXT_MUTED, textAlign: 'center', lineHeight: 16 },
  disclaimerLink: { color: ACCENT, fontWeight: '600' },
});
