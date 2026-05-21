/**
 * LocationPickerScreen.web.js — Web-specific delivery address picker
 *
 * Metro automatically prefers `.web.js` over `.js` when bundling for web,
 * so this file is used on web and LocationPickerScreen.js is used on native.
 *
 * Key differences from the native version:
 *   • No react-native-maps (has zero web support) — replaced with a GPS
 *     detection card showing the detected address.
 *   • expo-location.reverseGeocodeAsync is NOT available on web — replaced
 *     with Nominatim OpenStreetMap REST API (free, no API key required).
 *   • expo-location GPS (requestForegroundPermissionsAsync +
 *     getCurrentPositionAsync) works on web via the browser Geolocation API.
 *     Requires HTTPS in production.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBar } from '../context/TabBarContext';
import { useAddress } from '../context/AddressContext';
import { useAuth } from '../context/AuthContext';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const ACCENT       = '#6200EE';
const ACCENT_LIGHT = '#EDE7F6';
const WHITE        = '#FFFFFF';
const BG           = '#F7F7FB';
const TEXT_PRI     = '#1A1A2E';
const TEXT_SEC     = '#64748B';
const TEXT_MUTED   = '#9CA3AF';
const BORDER       = '#EDECF5';
const ERROR_COLOR  = '#DC2626';
const SUCCESS      = '#10B981';

// ─── Address type options ──────────────────────────────────────────────────────

const ADDRESS_TYPES = [
  { id: 'home',   label: 'Home',   icon: 'home-outline' },
  { id: 'office', label: 'Office', icon: 'briefcase-outline' },
  { id: 'other',  label: 'Other',  icon: 'location-outline' },
];

// Default fallback coordinates (Bangalore)
const DEFAULT_COORDS = { latitude: 12.9716, longitude: 77.5946 };

// ─── Nominatim reverse geocoder ────────────────────────────────────────────────
// Uses OpenStreetMap Nominatim — free, no API key, rate limit: 1 req/s.

async function nominatimReverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'Aileesa/1.0 (https://aileesa.com)',
    },
  });
  if (!res.ok) throw new Error('Geocoding request failed');
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationPickerScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { coords: ctxCoords } = useLocation();

  // ── Hide bottom tab bar while on this screen ──────────────────────────────
  const { hideTabBar, showTabBar } = useTabBar();
  const { isAuthenticated, getAccessToken } = useAuth();
  const {
    addresses,
    isLoading: addressesLoading,
    selectedAddress,
    selectAddress,
    createAndSelectAddress,
  } = useAddress();
  useFocusEffect(useCallback(() => {
    hideTabBar();
    return () => showTabBar();
  }, [hideTabBar, showTabBar]));

  // ── Mode: list (authenticated + saved addresses) vs form (create new) ─────
  const forcedMode = route?.params?.mode;
  const userChoseForm = useRef(false);
  const [mode, setMode] = useState(() => {
    if (forcedMode === 'form') return 'form';
    if (forcedMode === 'list') return 'list';
    return isAuthenticated && addresses.length > 0 ? 'list' : 'form';
  });

  // Switch to list once addresses load in after async bootstrap
  useEffect(() => {
    if (forcedMode || userChoseForm.current) return;
    if (isAuthenticated && addresses.length > 0) setMode('list');
  }, [isAuthenticated, addresses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePickAddress = useCallback((addr) => {
    selectAddress(addr);
    navigation.goBack();
  }, [selectAddress, navigation]);

  // ── GPS detection ─────────────────────────────────────────────────────────
  const [coords, setCoords] = useState(ctxCoords ?? DEFAULT_COORDS);
  // 'idle' | 'detecting' | 'done' | 'error'
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsError, setGpsError]   = useState('');

  // ── Reverse geocode ───────────────────────────────────────────────────────
  const [isGeocoding,     setIsGeocoding]     = useState(false);
  const [detectedAddress, setDetectedAddress] = useState('');
  const geocodeTimerRef = useRef(null);

  // ── Address form ──────────────────────────────────────────────────────────
  const [houseNo,     setHouseNo]     = useState('');
  const [landmark,    setLandmark]    = useState('');
  const [city,        setCity]        = useState('');
  const [stateVal,    setStateVal]    = useState('');
  const [pincode,     setPincode]     = useState('');
  const [addressType, setAddressType] = useState('home');
  const [customName,  setCustomName]  = useState('');

  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saved,   setSaved]   = useState(false);

  // ── Reverse geocode via Nominatim ─────────────────────────────────────────

  const reverseGeocode = useCallback(async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const data = await nominatimReverseGeocode(lat, lng);
      const addr = data.address ?? {};

      // Build human-readable detected address line
      const parts = [
        addr.house_number,
        addr.road,
        addr.suburb ?? addr.neighbourhood ?? addr.city_district,
      ].filter(Boolean);
      setDetectedAddress(parts.join(', ') || data.display_name || '');

      // Auto-fill form (only when fields are still empty)
      setCity(prev     => prev || addr.city || addr.town || addr.village || addr.suburb || '');
      setStateVal(prev => prev || addr.state || '');
      setPincode(prev  => prev || addr.postcode || '');
    } catch {
      // Geocode failure is non-fatal — user can fill in form manually
      setDetectedAddress('');
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // ── Request GPS permission + position on mount ────────────────────────────

  const detectLocation = useCallback(async () => {
    setGpsStatus('detecting');
    setGpsError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('error');
        setGpsError('Location permission denied. Please fill in your address manually.');
        // Fall back to the coordinates from LocationContext if available
        if (ctxCoords) reverseGeocode(ctxCoords.latitude, ctxCoords.longitude);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setCoords({ latitude, longitude });
      setGpsStatus('done');
      reverseGeocode(latitude, longitude);
    } catch {
      setGpsStatus('error');
      setGpsError(
        'Could not detect location. Make sure your browser allows location access ' +
        'and the page is loaded over HTTPS.'
      );
      if (ctxCoords) reverseGeocode(ctxCoords.latitude, ctxCoords.longitude);
    }
  }, [ctxCoords, reverseGeocode]);

  useEffect(() => {
    detectLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!houseNo.trim())                               e.houseNo    = 'Required';
    if (!city.trim())                                  e.city       = 'Required';
    if (!stateVal.trim())                              e.stateVal   = 'Required';
    if (!pincode.trim())                               e.pincode    = 'Required';
    if (addressType === 'other' && !customName.trim()) e.customName = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    setSaveErr('');
    try {
      const label = addressType === 'other'
        ? customName.trim()
        : ADDRESS_TYPES.find(t => t.id === addressType)?.label ?? 'Home';

      await createAndSelectAddress({
        lat:            coords.latitude,
        lng:            coords.longitude,
        address_line_1: houseNo.trim(),
        address_line_2: '',
        landmark:       landmark.trim(),
        city:           city.trim(),
        state:          stateVal.trim(),
        pincode:        pincode.trim(),
        label,
        receiver_name:  '',
        receiver_phone: '',
      });
      setSaved(true);
      setTimeout(() => navigation.goBack(), 800);
    } catch {
      setSaveErr('Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── GPS status display helpers ────────────────────────────────────────────

  const gpsIconName =
    gpsStatus === 'done' ? 'navigate-circle' : 'navigate-circle-outline';
  const gpsIconBg =
    gpsStatus === 'done' ? '#E8F5E9' : ACCENT_LIGHT;
  const gpsIconColor =
    gpsStatus === 'done' ? SUCCESS : ACCENT;

  const gpsAddressText =
    gpsStatus === 'detecting'
      ? 'Detecting your location…'
      : isGeocoding
      ? 'Identifying address…'
      : gpsStatus === 'error'
      ? gpsError
      : detectedAddress || 'Location detected — fill in the details below';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'list' ? 'Choose delivery address' : 'Set delivery location'}
        </Text>
        {/* spacer keeps title centred */}
        <View style={styles.backBtn} />
      </View>

      <View style={styles.flex}>

        {/* ── List mode: saved addresses ─────────────────────────────────── */}
        {mode === 'list' && (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.listDivider}>
              <View style={styles.listDividerLine} />
              <Text style={styles.listDividerText}>SAVED ADDRESSES</Text>
              <View style={styles.listDividerLine} />
            </View>

            {addressesLoading ? (
              <View style={styles.listLoader}>
                <ActivityIndicator size="small" color={ACCENT} />
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.listEmpty}>
                <Ionicons name="location-outline" size={36} color={BORDER} />
                <Text style={styles.listEmptyText}>No saved addresses yet</Text>
              </View>
            ) : (
              addresses.map(addr => {
                const isSel = addr.id === selectedAddress?.id;
                const typeIcon = ADDRESS_TYPES.find(
                  t => t.label.toLowerCase() === (addr.label ?? '').toLowerCase(),
                )?.icon ?? 'location-outline';
                const displayText = addr.formatted_address
                  ?? [addr.address_line_1, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');

                return (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.addrRow, isSel && styles.addrRowSel]}
                    onPress={() => handlePickAddress(addr)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.addrTypeIcon, isSel && styles.addrTypeIconSel]}>
                      <Ionicons name={typeIcon} size={18} color={isSel ? WHITE : ACCENT} />
                    </View>
                    <View style={styles.addrTextBlock}>
                      <View style={styles.addrTitleRow}>
                        <Text style={[styles.addrLabel, isSel && styles.addrLabelSel]}>
                          {addr.label ?? 'Address'}
                        </Text>
                        {addr.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addrText} numberOfLines={2}>{displayText}</Text>
                      {addr.receiver_name ? (
                        <Text style={styles.addrReceiver} numberOfLines={1}>
                          {addr.receiver_name} · {addr.receiver_phone}
                        </Text>
                      ) : null}
                    </View>
                    {isSel && (
                      <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              style={styles.addNewBtn}
              onPress={() => { userChoseForm.current = true; setMode('form'); }}
              activeOpacity={0.8}
            >
              <View style={styles.addNewIcon}>
                <Ionicons name="add" size={20} color={ACCENT} />
              </View>
              <Text style={styles.addNewText}>Add new address</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── GPS detection card ─────────────────────────────────────────── */}
        {mode === 'form' && (<>
        <View style={styles.gpsCard}>
          <View style={styles.gpsLeft}>
            {gpsStatus === 'detecting' || isGeocoding ? (
              <View style={[styles.gpsIconWrap, { backgroundColor: ACCENT_LIGHT }]}>
                <ActivityIndicator size="small" color={ACCENT} />
              </View>
            ) : (
              <View style={[styles.gpsIconWrap, { backgroundColor: gpsIconBg }]}>
                <Ionicons name={gpsIconName} size={22} color={gpsIconColor} />
              </View>
            )}
            <View style={styles.gpsTextBlock}>
              <Text style={styles.gpsLabel}>Detected location</Text>
              <Text style={styles.gpsAddress} numberOfLines={2}>
                {gpsAddressText}
              </Text>
            </View>
          </View>

          {gpsStatus !== 'detecting' && (
            <TouchableOpacity
              style={styles.redetectBtn}
              onPress={detectLocation}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="refresh" size={16} color={ACCENT} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Address form ───────────────────────────────────────────────── */}
        <ScrollView
          style={styles.form}
          contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Complete address details</Text>

          <Field
            label="House / Flat / Building"
            required
            placeholder="e.g. 12B, Sunrise Apartments"
            value={houseNo}
            onChangeText={setHouseNo}
            error={errors.houseNo}
          />

          <Field
            label="Landmark"
            optional
            placeholder="e.g. Near Central Park"
            value={landmark}
            onChangeText={setLandmark}
          />

          <View style={styles.rowFields}>
            <Field
              style={styles.flex}
              label="City"
              required
              placeholder="City"
              value={city}
              onChangeText={setCity}
              error={errors.city}
            />
            <View style={styles.rowGap} />
            <Field
              style={styles.flex}
              label="Pincode"
              required
              placeholder="6 digits"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={6}
              error={errors.pincode}
            />
          </View>

          <Field
            label="State"
            required
            placeholder="State"
            value={stateVal}
            onChangeText={setStateVal}
            error={errors.stateVal}
          />

          {/* Address type selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Save address as</Text>
            <View style={styles.typeRow}>
              {ADDRESS_TYPES.map(t => {
                const sel = addressType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, sel && styles.typeChipSel]}
                    onPress={() => setAddressType(t.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={t.icon} size={15} color={sel ? WHITE : TEXT_SEC} />
                    <Text style={[styles.typeLabel, sel && styles.typeLabelSel]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {addressType === 'other' && (
            <Field
              label="Address name"
              required
              placeholder="e.g. Parents' house"
              value={customName}
              onChangeText={setCustomName}
              error={errors.customName}
            />
          )}

          {saveErr ? (
            <View style={styles.apiErrorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={ERROR_COLOR} />
              <Text style={styles.apiErrorText}>{saveErr}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, (saving || saved) && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator color={WHITE} />
            ) : saved ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={WHITE} />
                <Text style={styles.saveBtnText}>Saved!</Text>
              </>
            ) : (
              <Text style={styles.saveBtnText}>Save Address</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
        </>)}
      </View>
    </View>
  );
}

// ─── Reusable Field component ─────────────────────────────────────────────────

function Field({
  label, required, optional, placeholder,
  value, onChangeText, error, keyboardType, maxLength, style,
}) {
  return (
    <View style={[styles.fieldGroup, style]}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.requiredStar}> *</Text>}
        {optional && <Text style={styles.optionalNote}> (optional)</Text>}
      </Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={TEXT_MUTED}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        autoCorrect={false}
        autoCapitalize="words"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    height:            56,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    backgroundColor:   WHITE,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   12,
  },
  headerTitle: {
    fontSize:      17,
    fontWeight:    '700',
    color:         TEXT_PRI,
    letterSpacing: -0.3,
  },

  // ── GPS card ──────────────────────────────────────────────────────────────────
  gpsCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   WHITE,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  gpsLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  gpsIconWrap: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  gpsTextBlock: { flex: 1 },
  gpsLabel: {
    fontSize:      11,
    color:         TEXT_MUTED,
    fontWeight:    '600',
    marginBottom:  2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpsAddress: {
    fontSize:   13,
    color:      TEXT_PRI,
    fontWeight: '600',
    lineHeight: 18,
  },
  redetectBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: ACCENT_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Form ─────────────────────────────────────────────────────────────────────
  form:        { flex: 1, backgroundColor: BG },
  formContent: { paddingHorizontal: 20, paddingTop: 20 },

  sectionTitle: {
    fontSize:      16,
    fontWeight:    '800',
    color:         TEXT_PRI,
    letterSpacing: -0.3,
    marginBottom:  16,
  },

  fieldGroup:   { marginBottom: 14 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: TEXT_SEC, marginBottom: 6 },
  requiredStar: { color: ERROR_COLOR },
  optionalNote: { color: TEXT_MUTED, fontWeight: '400' },

  input: {
    backgroundColor:   WHITE,
    borderWidth:       1.5,
    borderColor:       BORDER,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   11,
    fontSize:          15,
    color:             TEXT_PRI,
  },
  inputError: {
    borderColor: ERROR_COLOR,
  },
  errorText: {
    fontSize:   12,
    color:      ERROR_COLOR,
    marginTop:  4,
    fontWeight: '500',
  },

  rowFields: { flexDirection: 'row', marginBottom: 14 },
  rowGap:    { width: 12 },

  typeRow: {
    flexDirection: 'row',
    gap:           10,
    flexWrap:      'wrap',
    marginTop:     4,
  },
  typeChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   WHITE,
    borderWidth:       1.5,
    borderColor:       BORDER,
  },
  typeChipSel: {
    backgroundColor: ACCENT,
    borderColor:     ACCENT,
  },
  typeLabel:    { fontSize: 13, color: TEXT_SEC, fontWeight: '600' },
  typeLabelSel: { color: WHITE },

  apiErrorRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderRadius:      10,
    marginBottom:      14,
    borderWidth:       1,
    borderColor:       '#FECACA',
  },
  apiErrorText: { fontSize: 13, color: ERROR_COLOR, flex: 1 },

  saveBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    backgroundColor: ACCENT,
    borderRadius:   14,
    paddingVertical: 16,
    marginTop:      8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize:      16,
    fontWeight:    '700',
    color:         WHITE,
    letterSpacing: -0.2,
  },

  // ── List mode ─────────────────────────────────────────────────────────────
  listDivider: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  listDividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  listDividerText: {
    fontSize: 11, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 0.8,
  },
  listLoader:    { paddingVertical: 40, alignItems: 'center' },
  listEmpty:     { paddingVertical: 40, alignItems: 'center', gap: 8 },
  listEmptyText: { fontSize: 14, color: TEXT_MUTED },

  addrRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   WHITE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  addrRowSel:     { backgroundColor: '#F3EEFF' },
  addrTypeIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  addrTypeIconSel: { backgroundColor: ACCENT },
  addrTextBlock:   { flex: 1 },
  addrTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  addrLabel:    { fontSize: 14, fontWeight: '700', color: TEXT_PRI },
  addrLabelSel: { color: ACCENT },
  addrText:     { fontSize: 12, color: TEXT_SEC, marginTop: 2, lineHeight: 17 },
  addrReceiver: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  defaultBadge: {
    backgroundColor:   '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
  },
  defaultBadgeText: { fontSize: 10, color: '#2E7D32', fontWeight: '700' },

  addNewBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 20,
    paddingVertical:   16,
    backgroundColor:   WHITE,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    BORDER,
    marginTop:         8,
  },
  addNewIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  addNewText: { flex: 1, fontSize: 14, fontWeight: '600', color: ACCENT },
});
