/**
 * LocationPickerScreen.js — Delivery address picker
 *
 * Flow:
 *   1. Opens with the user's GPS coordinates pre-centred on the map
 *   2. User drags the map; the pin stays fixed at centre
 *   3. onRegionChangeComplete → reverse-geocodes the new centre point
 *   4. Auto-fills the address form fields
 *   5. User completes/edits the form and taps "Save Address"
 *   6. Calls saveAddress() → mock success → navigation.goBack()
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBar } from '../context/TabBarContext';
import { saveAddress } from '../api/addressApi';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const ACCENT       = '#6200EE';
const ACCENT_LIGHT = '#EDE7F6';
const WHITE        = '#FFFFFF';
const BG           = '#F7F7FB';
const TEXT_PRI     = '#1A1A2E';
const TEXT_SEC     = '#64748B';
const TEXT_MUTED   = '#9CA3AF';
const BORDER       = '#EDECF5';
const SUCCESS      = '#10B981';
const ERROR_COLOR  = '#DC2626';

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = Math.round(SCREEN_H * 0.42);

// ─── Address type options ──────────────────────────────────────────────────────

const ADDRESS_TYPES = [
  { id: 'home',   label: 'Home',   icon: 'home-outline' },
  { id: 'office', label: 'Office', icon: 'briefcase-outline' },
  { id: 'other',  label: 'Other',  icon: 'location-outline' },
];

// Default region (Bangalore) — shown only when GPS coords are unavailable
const DEFAULT_REGION = {
  latitude:      12.9716,
  longitude:     77.5946,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationPickerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();

  // ── Hide bottom tab bar while on this screen ──────────────────────────────
  const { hideTabBar, showTabBar } = useTabBar();
  useFocusEffect(useCallback(() => {
    hideTabBar();
    return () => showTabBar();
  }, [hideTabBar, showTabBar]));

  // ── Map region ───────────────────────────────────────────────────────────────
  const [region, setRegion] = useState(() => ({
    latitude:      coords?.latitude  ?? DEFAULT_REGION.latitude,
    longitude:     coords?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta:  DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  }));

  // ── Reverse geocode ──────────────────────────────────────────────────────────
  const [isGeocoding,      setIsGeocoding]      = useState(false);
  const [detectedAddress,  setDetectedAddress]  = useState('');
  const geocodeTimerRef = useRef(null);

  // ── Address form ─────────────────────────────────────────────────────────────
  const [houseNo,     setHouseNo]    = useState('');
  const [landmark,    setLandmark]   = useState('');
  const [city,        setCity]       = useState('');
  const [stateVal,    setStateVal]   = useState('');
  const [pincode,     setPincode]    = useState('');
  const [addressType, setAddressType] = useState('home');
  const [customName,  setCustomName] = useState('');

  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saved,   setSaved]   = useState(false);

  // ── Reverse geocode helper ───────────────────────────────────────────────────

  const reverseGeocode = useCallback(async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        // Build a human-readable detected address line
        const parts = [r.streetNumber, r.street, r.district, r.subregion]
          .filter(Boolean);
        setDetectedAddress(parts.join(', ') || r.name || '');
        // Auto-fill form
        setCity(prev    => prev    || r.city      || r.subregion || '');
        setStateVal(prev => prev   || r.region    || '');
        setPincode(prev  => prev   || r.postalCode || '');
      }
    } catch {
      // Reverse geocode failure is non-fatal
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Run on mount with the initial coordinates
  useEffect(() => {
    reverseGeocode(region.latitude, region.longitude);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced reverse geocode on map drag end
  const handleRegionChangeComplete = useCallback((newRegion) => {
    setRegion(newRegion);
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(newRegion.latitude, newRegion.longitude);
    }, 300);
  }, [reverseGeocode]);

  useEffect(() => () => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!houseNo.trim())                          e.houseNo    = 'Required';
    if (!city.trim())                             e.city       = 'Required';
    if (!stateVal.trim())                         e.stateVal   = 'Required';
    if (!pincode.trim())                          e.pincode    = 'Required';
    if (addressType === 'other' && !customName.trim()) e.customName = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    setSaveErr('');
    try {
      const typeName = addressType === 'other'
        ? customName.trim()
        : ADDRESS_TYPES.find(t => t.id === addressType)?.label ?? 'Home';

      await saveAddress({
        latitude:    region.latitude,
        longitude:   region.longitude,
        fullAddress: detectedAddress,
        houseNo:     houseNo.trim(),
        landmark:    landmark.trim(),
        city:        city.trim(),
        state:       stateVal.trim(),
        pincode:     pincode.trim(),
        type:        addressType,
        name:        typeName,
      });
      setSaved(true);
      // Brief success flash then go back
      setTimeout(() => navigation.goBack(), 800);
    } catch {
      setSaveErr('Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={TEXT_PRI} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set delivery location</Text>
        {/* spacer keeps title centred */}
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 56}
      >
        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
          />

          {/* Fixed centre pin — the tip marks the selected point */}
          <View style={styles.pinWrap} pointerEvents="none">
            <View style={styles.pinIcon}>
              <Ionicons name="location" size={44} color={ACCENT} />
            </View>
            {/* Shadow oval below pin tip */}
            <View style={styles.pinShadow} />
          </View>

          {/* "Move pin" hint — fades after first drag */}
          <View style={styles.hintBadge} pointerEvents="none">
            <Ionicons name="move-outline" size={13} color={TEXT_SEC} />
            <Text style={styles.hintText}>Drag to move pin</Text>
          </View>

          {/* Geocoding overlay */}
          {isGeocoding && (
            <View style={styles.geocodingBadge}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.geocodingText}>Locating…</Text>
            </View>
          )}
        </View>

        {/* ── Detected address strip ──────────────────────────────────────── */}
        <View style={styles.detectedStrip}>
          <View style={styles.detectedIconWrap}>
            <Ionicons name="navigate-circle" size={22} color={ACCENT} />
          </View>
          <View style={styles.detectedTextBlock}>
            <Text style={styles.detectedLabel}>Pin location</Text>
            <Text style={styles.detectedAddress} numberOfLines={2}>
              {isGeocoding
                ? 'Detecting address…'
                : detectedAddress || 'Move the pin to your exact location'}
            </Text>
          </View>
        </View>

        {/* ── Address form ────────────────────────────────────────────────── */}
        <ScrollView
          style={styles.form}
          contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Complete address details</Text>

          {/* House / Flat / Building */}
          <Field
            label="House / Flat / Building"
            required
            placeholder="e.g. 12B, Sunrise Apartments"
            value={houseNo}
            onChangeText={setHouseNo}
            error={errors.houseNo}
          />

          {/* Landmark */}
          <Field
            label="Landmark"
            optional
            placeholder="e.g. Near Central Park"
            value={landmark}
            onChangeText={setLandmark}
          />

          {/* City + Pincode on same row */}
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

          {/* State */}
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
                    <Ionicons
                      name={t.icon}
                      size={15}
                      color={sel ? WHITE : TEXT_SEC}
                    />
                    <Text style={[styles.typeLabel, sel && styles.typeLabelSel]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Custom name (Other) */}
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

          {/* API error */}
          {saveErr ? (
            <View style={styles.apiErrorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={ERROR_COLOR} />
              <Text style={styles.apiErrorText}>{saveErr}</Text>
            </View>
          ) : null}

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (saving || saved) && styles.saveBtnDisabled,
            ]}
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
      </KeyboardAvoidingView>
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
  root:  { flex: 1, backgroundColor: BG },
  flex:  { flex: 1 },

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
    width:            40,
    height:           40,
    alignItems:       'center',
    justifyContent:   'center',
    borderRadius:     12,
  },
  headerTitle: {
    fontSize:    17,
    fontWeight:  '700',
    color:       TEXT_PRI,
    letterSpacing: -0.3,
  },

  // ── Map ───────────────────────────────────────────────────────────────────────
  mapWrapper: {
    width:    '100%',
    height:   MAP_HEIGHT,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Fixed centre pin
  pinWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pinIcon: {
    // Shift the icon up so its TIP (bottom) sits at map centre
    transform: [{ translateY: -22 }],
  },
  pinShadow: {
    width:           12,
    height:          6,
    borderRadius:    6,
    backgroundColor: 'rgba(0,0,0,0.18)',
    transform:       [{ translateY: -22 }],
  },

  hintBadge: {
    position:          'absolute',
    bottom:            12,
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      999,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.1,
    shadowRadius:      6,
    elevation:         3,
  },
  hintText: {
    fontSize:   12,
    color:      TEXT_SEC,
    fontWeight: '600',
  },

  geocodingBadge: {
    position:          'absolute',
    top:               12,
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               7,
    backgroundColor:   'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      999,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.12,
    shadowRadius:      6,
    elevation:         4,
  },
  geocodingText: {
    fontSize:   13,
    color:      ACCENT,
    fontWeight: '600',
  },

  // ── Detected address strip ────────────────────────────────────────────────────
  detectedStrip: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   WHITE,
    paddingHorizontal: 16,
    paddingVertical:   12,
    gap:               12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  detectedIconWrap: {
    width:            38,
    height:           38,
    borderRadius:     12,
    backgroundColor:  ACCENT_LIGHT,
    alignItems:       'center',
    justifyContent:   'center',
    flexShrink:       0,
  },
  detectedTextBlock: { flex: 1 },
  detectedLabel: {
    fontSize:    11,
    color:       TEXT_MUTED,
    fontWeight:  '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detectedAddress: {
    fontSize:   13,
    color:      TEXT_PRI,
    fontWeight: '600',
    lineHeight: 18,
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

  fieldGroup:  { marginBottom: 14 },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: TEXT_SEC, marginBottom: 6 },
  requiredStar: { color: ERROR_COLOR },
  optionalNote: { color: TEXT_MUTED, fontWeight: '400' },

  input: {
    backgroundColor:   WHITE,
    borderWidth:       1.5,
    borderColor:       BORDER,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   Platform.OS === 'ios' ? 12 : 10,
    fontSize:          14,
    color:             TEXT_PRI,
    fontWeight:        '500',
  },
  inputError: {
    borderColor: ERROR_COLOR,
  },
  errorText: {
    fontSize:   11,
    color:      ERROR_COLOR,
    fontWeight: '600',
    marginTop:  4,
  },

  rowFields: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  0,
  },
  rowGap: { width: 12 },

  // Address type chips
  typeRow: {
    flexDirection: 'row',
    gap:           10,
    flexWrap:      'wrap',
  },
  typeChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       BORDER,
    backgroundColor:   WHITE,
  },
  typeChipSel: {
    backgroundColor: ACCENT,
    borderColor:     ACCENT,
  },
  typeLabel: {
    fontSize:   13,
    fontWeight: '700',
    color:      TEXT_SEC,
  },
  typeLabelSel: { color: WHITE },

  // API error
  apiErrorRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    backgroundColor: '#FEF2F2',
    borderRadius:   10,
    padding:        12,
    marginBottom:   12,
    borderWidth:    1,
    borderColor:    '#FECACA',
  },
  apiErrorText: {
    flex:       1,
    fontSize:   13,
    color:      ERROR_COLOR,
    fontWeight: '500',
  },

  // Save button
  saveBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    backgroundColor:   ACCENT,
    borderRadius:      16,
    paddingVertical:   16,
    marginTop:         8,
    shadowColor:       ACCENT,
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.28,
    shadowRadius:      10,
    elevation:         5,
  },
  saveBtnDisabled: {
    backgroundColor: SUCCESS,
    shadowColor:     SUCCESS,
  },
  saveBtnText: {
    fontSize:   16,
    fontWeight: '800',
    color:      WHITE,
    letterSpacing: -0.2,
  },
});
