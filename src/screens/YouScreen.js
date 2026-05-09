import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Animated, Linking, StatusBar, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AuthSheet from '../components/auth/AuthSheet';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG        = '#F5F6FA';
const SURFACE   = '#FFFFFF';
const NAVY      = '#16172B';
const ACCENT    = '#E8445A';
const SUCCESS   = '#10B981';
const TEXT_PRI  = '#16172B';
const TEXT_SEC  = '#64748B';
const TEXT_MUTED = '#94A3B8';
const BORDER    = '#E4E8F4';
const WHITE     = '#FFFFFF';

// ─── Static data ───────────────────────────────────────────────────────────────
const POLICY_ITEMS = [
  { id: 'privacy',  label: 'Privacy Policy',        icon: 'shield-checkmark-outline', color: '#3B82F6' },
  { id: 'terms',    label: 'Terms & Conditions',    icon: 'document-text-outline',    color: NAVY },
  { id: 'refund',   label: 'Refund & Cancellation', icon: 'refresh-circle-outline',   color: '#F59E0B' },
  { id: 'shipping', label: 'Shipping Policy',       icon: 'cube-outline',             color: SUCCESS },
  { id: 'about',    label: 'About Aileesa',         icon: 'information-circle-outline', color: '#8B5CF6' },
];

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <View style={styles.section}>
      {label && <Text style={styles.sectionLabel}>{label}</Text>}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ─── Menu row ──────────────────────────────────────────────────────────────────
function MenuRow({ icon, iconColor = NAVY, label, sublabel, onPress, last, danger }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, last && styles.menuRowLast]}
      onPress={onPress}
      activeOpacity={0.68}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.menuMid}>
        <Text style={[styles.menuLabel, danger && { color: ACCENT }]}>{label}</Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

// ─── Coming Soon modal ─────────────────────────────────────────────────────────
function ComingSoonModal({ visible, onClose }) {
  const scale   = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.82);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.comingSoonCard, { transform: [{ scale }], opacity }]}>
          <View style={styles.comingSoonOrb}>
            <Ionicons name="time-outline" size={32} color={ACCENT} />
          </View>
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonSub}>
            This feature is being baked fresh.{'\n'}Stay tuned!
          </Text>
          <TouchableOpacity style={styles.comingSoonBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.comingSoonBtnText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Edit name modal ───────────────────────────────────────────────────────────
function EditNameModal({ visible, currentName, onSave, onClose }) {
  const [name, setName] = useState(currentName || '');
  const scale   = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setName(currentName || '');
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.82);
      opacity.setValue(0);
    }
  }, [visible, currentName]);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            style={[styles.editNameCard, { transform: [{ scale }], opacity }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.editNameTitle}>Edit name</Text>
            <TextInput
              style={styles.editNameInput}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
              placeholder="Your name"
              placeholderTextColor={TEXT_MUTED}
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && onSave(name.trim())}
            />
            <View style={styles.editNameActions}>
              <TouchableOpacity style={styles.editNameCancel} onPress={onClose}>
                <Text style={styles.editNameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editNameSave, !name.trim() && { opacity: 0.42 }]}
                onPress={() => name.trim() && onSave(name.trim())}
                disabled={!name.trim()}
              >
                <Text style={styles.editNameSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function YouScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, updateName } = useAuth();

  const [authSheetVisible, setAuthSheetVisible] = useState(false);
  const [editNameVisible,  setEditNameVisible]  = useState(false);
  const [showComing,       setShowComing]       = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : null;

  const requireLogin = (then) => {
    if (!isAuthenticated) { setAuthSheetVisible(true); return; }
    then?.();
  };

  const handleSaveName = async (name) => {
    await updateName(name);
    setEditNameVisible(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>You</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile card ──────────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          {isAuthenticated ? (
            <>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials || '?'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name || 'User'}</Text>
                <Text style={styles.profilePhone}>+91 {user.phone}</Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditNameVisible(true)}>
                <Ionicons name="pencil-outline" size={15} color={ACCENT} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.avatarCircle, styles.avatarGuest]}>
                <Ionicons name="person-outline" size={26} color={TEXT_MUTED} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Guest User</Text>
                <Text style={styles.profilePhone}>Not logged in</Text>
              </View>
              <TouchableOpacity style={styles.loginCta} onPress={() => setAuthSheetVisible(true)} activeOpacity={0.85}>
                <Text style={styles.loginCtaText}>Login</Text>
                <Ionicons name="arrow-forward" size={14} color={WHITE} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Your orders ───────────────────────────────────────────────── */}
        <Section label="YOUR ORDERS">
          <MenuRow
            icon="bag-check-outline"
            iconColor={ACCENT}
            label="Past Orders"
            sublabel={isAuthenticated ? 'View your order history' : 'Login to view your orders'}
            onPress={() => requireLogin(() => navigation.navigate('Market', { screen: 'OrderHistory' }))}
            last
          />
        </Section>

        {/* ── Saved ─────────────────────────────────────────────────────── */}
        <Section label="SAVED">
          <MenuRow
            icon="heart-outline"
            iconColor="#E91E8C"
            label="Favourite Stores"
            sublabel={isAuthenticated ? 'Your saved stores' : 'Login to save stores'}
            onPress={() => requireLogin(() => setShowComing(true))}
            last
          />
        </Section>

        {/* ── Policies ──────────────────────────────────────────────────── */}
        <Section label="POLICIES & INFO">
          {POLICY_ITEMS.map((item, idx) => (
            <MenuRow
              key={item.id}
              icon={item.icon}
              iconColor={item.color}
              label={item.label}
              onPress={() => setShowComing(true)}
              last={idx === POLICY_ITEMS.length - 1}
            />
          ))}
        </Section>

        {/* ── Contact & Support ─────────────────────────────────────────── */}
        <Section label="CONTACT & SUPPORT">
          <MenuRow
            icon="logo-whatsapp"
            iconColor="#25D366"
            label="Chat on WhatsApp"
            sublabel="+91 73377 31123"
            onPress={() => Linking.openURL('https://wa.me/917337731123').catch(() => {})}
          />
          <MenuRow
            icon="mail-outline"
            iconColor={ACCENT}
            label="Email Support"
            sublabel="superkarthi789@gmail.com"
            onPress={() => Linking.openURL('mailto:superkarthi789@gmail.com').catch(() => {})}
            last
          />
        </Section>

        {/* ── Logout ────────────────────────────────────────────────────── */}
        {isAuthenticated && (
          <Section>
            <MenuRow
              icon="log-out-outline"
              iconColor={ACCENT}
              label="Logout"
              onPress={logout}
              danger
              last
            />
          </Section>
        )}

        {/* ── Version footer ────────────────────────────────────────────── */}
        <Text style={styles.version}>Aileesa v1.0.0  ·  Made with ♥ in India</Text>
      </ScrollView>

      <AuthSheet
        visible={authSheetVisible}
        onClose={() => setAuthSheetVisible(false)}
      />
      <EditNameModal
        visible={editNameVisible}
        currentName={user?.name}
        onSave={handleSaveName}
        onClose={() => setEditNameVisible(false)}
      />
      <ComingSoonModal
        visible={showComing}
        onClose={() => setShowComing(false)}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: BG,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: -0.5,
  },

  // ── Profile card ──────────────────────────────────────────────────────────
  profileCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGuest: { backgroundColor: '#F1F3F9' },
  avatarText:  { fontSize: 20, fontWeight: '800', color: ACCENT },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, fontWeight: '700', color: NAVY },
  profilePhone: { fontSize: 13, color: TEXT_SEC, fontWeight: '500' },
  editBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: ACCENT + '12',
  },
  loginCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  loginCtaText: { color: WHITE, fontSize: 13, fontWeight: '700' },

  // ── Section ───────────────────────────────────────────────────────────────
  section: { marginTop: 22, marginHorizontal: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 0.9,
    marginBottom: 7,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  // ── Menu row ──────────────────────────────────────────────────────────────
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  menuRowLast:  { borderBottomWidth: 0 },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuMid:     { flex: 1, gap: 1 },
  menuLabel:   { fontSize: 14, fontWeight: '600', color: NAVY },
  menuSublabel: { fontSize: 12, color: TEXT_MUTED, fontWeight: '400', marginTop: 1 },

  // ── Version ───────────────────────────────────────────────────────────────
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 28,
    marginBottom: 6,
  },

  // ── Shared modal backdrop ─────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Coming soon ───────────────────────────────────────────────────────────
  comingSoonCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    padding: 28,
    marginHorizontal: 32,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  comingSoonOrb: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: ACCENT + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  comingSoonTitle: { fontSize: 20, fontWeight: '800', color: NAVY, letterSpacing: -0.3 },
  comingSoonSub:   { fontSize: 13, color: TEXT_SEC, textAlign: 'center', lineHeight: 20 },
  comingSoonBtn:   {
    marginTop: 8,
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  comingSoonBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },

  // ── Edit name modal ───────────────────────────────────────────────────────
  editNameCard: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 28,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  editNameTitle:  { fontSize: 17, fontWeight: '800', color: NAVY, letterSpacing: -0.3 },
  editNameInput: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: NAVY,
    fontWeight: '500',
  },
  editNameActions:    { flexDirection: 'row', gap: 10 },
  editNameCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center',
  },
  editNameCancelText: { fontSize: 14, fontWeight: '600', color: TEXT_SEC },
  editNameSave: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: NAVY, alignItems: 'center',
  },
  editNameSaveText: { fontSize: 14, fontWeight: '700', color: WHITE },
});

