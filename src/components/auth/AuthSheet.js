/**
 * AuthSheet.js — OTP authentication bottom sheet
 *
 * CHANNEL CONTROL
 * ───────────────
 * Set OTP_CHANNEL in src/api/authApi.js:
 *   'SMS' — 4-digit numeric OTP, number-only keypad, SMS-branded UI
 *   'WA'  — 6-char alphanumeric OTP, WhatsApp-branded UI (legacy)
 *
 * KEYBOARD FIX
 * ────────────
 * OTP input uses a single hidden TextInput (off-screen) shared by all boxes.
 * The styled boxes are decorative views driven by the value string.
 * Because focus never hops between inputs, the keyboard type never resets.
 *
 * STEPS
 * ─────
 *   PHONE → user enters WhatsApp/mobile number → sendOtp() called
 *   OTP   → user enters OTP code → verifyOtp() called → onClose()
 *
 * DEV MODE
 * ────────
 * When IS_MOCK is true, a yellow banner in the OTP step displays the generated
 * OTP so testers can enter it without a real message.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  TextInput, Animated, Platform, Keyboard, Easing, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { IS_MOCK, OTP_CHANNEL, OTP_LENGTH } from '../../api/authApi';
import { Analytics } from '../../api/analytics';

// ─── Channel flag ─────────────────────────────────────────────────────────────────────
const IS_SMS = OTP_CHANNEL === 'SMS';

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY      = '#16172B';
const ACCENT    = '#E8445A';
const SUCCESS   = '#10B981';
const TEXT_SEC  = '#64748B';
const TEXT_MUTED = '#94A3B8';
const BG        = '#F5F6FA';
const BORDER    = '#E4E8F4';
const WHITE     = '#FFFFFF';

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

  // ─ Channel-specific UI config ────────────────────────────────────────────────
  const channelIcon  = IS_SMS ? 'chatbox-outline'   : 'logo-whatsapp';
  const channelColor = IS_SMS ? '#6200EE'            : '#25D366';
  const channelTitle = IS_SMS ? 'Login with OTP'     : 'Login with WhatsApp';
  const channelSub   = IS_SMS
    ? 'We’ll send a one-time code to your\nmobile number via SMS'
    : 'We’ll send a one-time code to your\nWhatsApp number';
  const fieldLabel   = IS_SMS ? 'Mobile number'      : 'WhatsApp number';

  return (
    <View style={styles.step}>
      <View style={styles.iconCircle}>
        <Ionicons name={channelIcon} size={30} color={channelColor} />
      </View>

      <Text style={styles.stepTitle}>{channelTitle}</Text>
      <Text style={styles.stepSub}>{channelSub}</Text>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{fieldLabel}</Text>
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
//
// KEYBOARD FIX: A single hidden TextInput captures all keystrokes.
// The visible boxes are decorative Views built from the value string.
// Focus never hops between inputs → keyboard type never auto-resets.
//
function OtpStep({ requestId, phone, devOtp, onSuccess, onBack }) {
  const { sendOtp, verifyOtp } = useAuth();

  const [value,            setValue]            = useState('');
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [countdown,        setCountdown]        = useState(RESEND_COOLDOWN);
  const [resending,        setResending]        = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(requestId);
  const [currentDevOtp,    setCurrentDevOtp]    = useState(devOtp);

  const hiddenRef = useRef(null);
  const timerRef  = useRef(null);

  // ─ Channel UI config ──────────────────────────────────────────────────────────
  const channelSub       = IS_SMS
    ? `Sent to +91 ${phone} via SMS`
    : `Sent to +91 ${phone} via WhatsApp`;
  const channelIcon      = IS_SMS ? 'chatbox-outline' : 'chatbubble-ellipses-outline';
  const channelIconColor = IS_SMS ? '#6200EE'         : '#25D366';

  // Keyboard and filter settings per channel
  const kbType   = IS_SMS ? 'number-pad' : 'default';
  const kbCaps   = IS_SMS ? 'none'       : 'characters';
  const sanitise = (t) => IS_SMS
    ? t.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH)
    : t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, OTP_LENGTH);

  // ─ Countdown ──────────────────────────────────────────────────────────────────
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startTimer();
    setTimeout(() => hiddenRef.current?.focus(), 300);
    return () => clearInterval(timerRef.current);
  }, []);

  const canVerify = value.length === OTP_LENGTH && !loading;

  // ─ Input ──────────────────────────────────────────────────────────────────────
  const handleChange = (text) => {
    const clean = sanitise(text);
    setValue(clean);
    setError('');
    if (clean.length === OTP_LENGTH) {
      handleVerify(clean);
    }
  };

  // ─ Verify ─────────────────────────────────────────────────────────────────────
  const handleVerify = async (overrideValue) => {
    const otp = overrideValue ?? value;
    if (otp.length !== OTP_LENGTH || loading) return;
    setError('');
    setLoading(true);
    try {
      await verifyOtp(currentRequestId, otp);
      onSuccess();
    } catch (e) {
      Analytics.track('otp_failed', { error_code: e.code ?? 'UNKNOWN', channel: OTP_CHANNEL });
      setError(e.message || 'Verification failed. Please try again.');
      setValue('');
      setTimeout(() => hiddenRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // ─ Resend ─────────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const result = await sendOtp(phone);
      setCurrentRequestId(result.requestId);
      setCurrentDevOtp(result._devOtp);
      setValue('');
      setCountdown(RESEND_COOLDOWN);
      startTimer();
      setTimeout(() => hiddenRef.current?.focus(), 100);
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
        <Ionicons name={channelIcon} size={28} color={channelIconColor} />
      </View>

      <Text style={styles.stepTitle}>Enter OTP</Text>
      <Text style={styles.stepSub}>{channelSub}</Text>

      {/*
        Hidden TextInput — the real input target.
        keyboardType is fixed for the lifetime of OtpStep; the OS keyboard
        never reassesses the type because focus never moves to another input.
        Tapping the decorative box row (below) re-focuses this input.
      */}
      <TextInput
        ref={hiddenRef}
        value={value}
        onChangeText={handleChange}
        onSubmitEditing={handleVerify}
        keyboardType={kbType}
        autoCapitalize={kbCaps}
        autoCorrect={false}
        maxLength={OTP_LENGTH}
        editable={!loading}
        style={styles.hiddenInput}
        accessible={false}
        importantForAccessibility="no"
      />

      {/* Decorative OTP boxes — tap anywhere to re-focus hidden input */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hiddenRef.current?.focus()}
        style={styles.otpRow}
      >
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const char    = value[i] ?? '';
          const isCaret = !loading && i === Math.min(value.length, OTP_LENGTH - 1);
          return (
            <View
              key={i}
              style={[
                styles.otpBox,
                char    && styles.otpBoxFilled,
                isCaret && styles.otpBoxCaret,
                !!error && styles.otpBoxError,
              ]}
            >
              <Text style={styles.otpBoxText}>{char}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

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
export default function AuthSheet({ visible, onClose, source }) {
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
      Analytics.track('auth_sheet_opened', { source: source ?? 'unknown' });
      // Reset to off-screen before animating in. If a previous close animation
      // was interrupted the value may be at a stale intermediate position,
      // which causes the sheet to "stick" instead of sliding up from the bottom.
      slideY.setValue(700);
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
    // fontSize must be ≥ 16 to prevent iOS Safari from auto-zooming the
    // viewport when the field is focused.
    fontSize: 16, color: NAVY, fontWeight: '500',
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
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxText: {
    fontSize: 22, fontWeight: '800', color: NAVY,
  },
  otpBoxFilled: { borderColor: NAVY, backgroundColor: WHITE },
  otpBoxCaret:  { borderColor: ACCENT },
  otpBoxError:  { borderColor: ACCENT, backgroundColor: '#FFF5F5' },
  // Hidden input sits off-screen; we just need it focusable.
  // fontSize: 16 prevents iOS Safari from auto-zooming when it gains focus.
  hiddenInput: {
    position: 'absolute', top: -9999, left: -9999,
    width: 1, height: 1, opacity: 0,
    fontSize: 16,
  },

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
