/**
 * LocationPickerScreen.js — Delivery address picker
 *
 * Two modes:
 *
 * ── List mode (authenticated users, OR forced via route.params.mode = 'list')
 *    • "Use current location" row at top
 *    • Saved address rows with haversine distance chip
 *    • "Add new address" button → switches to Form mode
 *    Tap any row → selectAddress() → navigation.goBack()
 *
 * ── Form mode (anonymous, or logged-in adding a new address)
 *    • Map with draggable pin (reverse-geocodes on drag)
 *    • Address form auto-filled from GPS / existing anonymous address
 *    • Save → createAndSelectAddress() → navigation.goBack()
 *
 * Mode detection (auto):
 *   Authenticated + has saved addresses → List mode (unless params.mode='form')
 *   Everything else → Form mode
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useAddress } from '../context/AddressContext';
import { useAuth } from '../context/AuthContext';
import { AddressAPI } from '../api/addressApi';

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

const DEFAULT_REGION = {
  latitude:      12.9716,
  longitude:     77.5946,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

// ─── Haversine helpers ────────────────────────────────────────────────────────
function _haversineM(lat1, lng1, lat2, lng2) {
  if (lat2 == null || lng2 == null) return Infinity;
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _distLabel(lat1, lng1, lat2, lng2) {
  const m = _haversineM(lat1, lng1, lat2, lng2);
  if (!isFinite(m)) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function LocationPickerScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();
  const { isAuthenticated, getAccessToken } = useAuth();
  const {
    addresses,
    isLoading: addressesLoading,
    anonymousAddressId,
    selectedAddress,
    selectAddress,
    createAndSelectAddress,
    refreshAddresses,
    autoSelectClosestAddress,
  } = useAddress();

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  const { hideTabBar, showTabBar } = useTabBar();
  useFocusEffect(useCallback(() => {
    hideTabBar();
    return () => showTabBar();
  }, [hideTabBar, showTabBar]));

  // ── Mode detection ───────────────────────────────────────────────────────────
  // 'list': show saved addresses + "use current location" option
  // 'form': show map + address form
  const forcedMode = route?.params?.mode; // 'list' | 'form' | undefined
  const [mode, setMode] = useState(() => {
    if (forcedMode === 'form') return 'form';
    if (forcedMode === 'list') return 'list';
    return isAuthenticated && addresses.length > 0 ? 'list' : 'form';
  });

  // ─── LIST MODE STATE ─────────────────────────────────────────────────────────

  // Show "Use current location" only when GPS is available AND every saved
  // address is more than 100 m away (i.e. user has moved meaningfully).
  const showCurrentLocRow = coords != null && (
    addresses.length === 0 ||
    addresses.every(a => _haversineM(coords.latitude, coords.longitude, a.lat, a.lng) > 100)
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!coords) return;
    // Clear any previous form state and open form pre-centred on current coords.
    setHouseNo(''); setLandmark(''); setCity(''); setStateVal(''); setPincode('');
    setReceiverName(''); setReceiverPhone(''); setErrors({}); setSaveErr('');
    setAddressType('home'); setCustomName(''); setSaved(false);
    setEditingAddress(null);
    setRegion(r => ({ ...r, latitude: coords.latitude, longitude: coords.longitude }));
    setMode('form');
  }, [coords]);

  const handlePickAddress = useCallback((addr) => {
    selectAddress(addr);
    navigation.goBack();
  }, [selectAddress, navigation]);

  // ─── EDIT ADDRESS ────────────────────────────────────────────────────────────

  const [editingAddress, setEditingAddress] = useState(null);

  const handleEditAddress = useCallback((addr) => {
    setEditingAddress(addr);
    const typeMatch = ADDRESS_TYPES.find(
      t => t.label.toLowerCase() === (addr.label ?? '').toLowerCase(),
    );
    if (typeMatch) {
      setAddressType(typeMatch.id);
      setCustomName('');
    } else {
      setAddressType('other');
      setCustomName(addr.label ?? '');
    }
    setReceiverName(addr.receiver_name ?? '');
    setReceiverPhone(addr.receiver_phone ?? '');
    setErrors({}); setSaveErr(''); setSaved(false);
    setMode('form');
  }, []);

  // ─── FORM MODE STATE ─────────────────────────────────────────────────────────

  const [region, setRegion] = useState(() => ({
    latitude:      coords?.latitude  ?? DEFAULT_REGION.latitude,
    longitude:     coords?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta:  DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  }));

  const [isGeocoding,     setIsGeocoding]     = useState(false);
  const [detectedAddress, setDetectedAddress] = useState('');
  const geocodeTimerRef = useRef(null);

  const [houseNo,       setHouseNo]       = useState('');
  const [landmark,      setLandmark]      = useState('');
  const [city,          setCity]          = useState('');
  const [stateVal,      setStateVal]      = useState('');
  const [pincode,       setPincode]       = useState('');
  const [addressType,   setAddressType]   = useState('home');
  const [customName,    setCustomName]    = useState('');
  const [receiverName,  setReceiverName]  = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saved,   setSaved]   = useState(false);

  // Prefill form from existing anonymous address on revisit
  useEffect(() => {
    if (mode !== 'form') return;
    if (isAuthenticated) return;
    if (!anonymousAddressId) return;

    (async () => {
      try {
        const addr = await AddressAPI.getAddress(anonymousAddressId);
        if (!addr) return;
        setHouseNo(addr.address_line_1 ?? '');
        setLandmark(addr.landmark ?? '');
        setCity(addr.city ?? '');
        setStateVal(addr.state ?? '');
        setPincode(addr.pincode ?? '');
        setReceiverName(addr.receiver_name ?? '');
        setReceiverPhone(addr.receiver_phone ?? '');
        const typeMatch = ADDRESS_TYPES.find(t => t.label === addr.label);
        if (typeMatch) {
          setAddressType(typeMatch.id);
        } else if (addr.label) {
          setAddressType('other');
          setCustomName(addr.label);
        }
        if (addr.lat && addr.lng) {
          setRegion(r => ({ ...r, latitude: addr.lat, longitude: addr.lng }));
        }
      } catch {
        // prefill failure is non-fatal
      }
    })();
  }, [mode, isAuthenticated, anonymousAddressId]);

  // ── Reverse geocode helper ───────────────────────────────────────────────────

  const reverseGeocode = useCallback(async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.streetNumber, r.street, r.district, r.subregion].filter(Boolean);
        setDetectedAddress(parts.join(', ') || r.name || '');
        setCity(prev    => prev    || r.city      || r.subregion || '');
        setStateVal(prev => prev   || r.region    || '');
        setPincode(prev  => prev   || r.postalCode || '');
      }
    } catch {
      // non-fatal
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'form') return;
    reverseGeocode(region.latitude, region.longitude);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!houseNo.trim())                               e.houseNo       = 'Required';
    if (!city.trim())                                  e.city          = 'Required';
    if (!stateVal.trim())                              e.stateVal      = 'Required';
    if (!pincode.trim())                               e.pincode       = 'Required';
    if (addressType === 'other' && !customName.trim()) e.customName    = 'Required';
    if (!receiverName.trim())                          e.receiverName  = 'Required';
    if (!/^[6-9]\d{9}$/.test(receiverPhone.trim()))   e.receiverPhone = 'Enter a valid 10-digit mobile number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (saving) return;

    // ── Edit mode: only label + receiver fields can be updated via API ────────
    if (editingAddress) {
      const e = {};
      if (addressType === 'other' && !customName.trim()) e.customName    = 'Required';
      if (!receiverName.trim())                          e.receiverName  = 'Required';
      if (!/^[6-9]\d{9}$/.test(receiverPhone.trim()))   e.receiverPhone = 'Enter a valid 10-digit mobile number';
      setErrors(e);
      if (Object.keys(e).length > 0) return;

      setSaving(true);
      setSaveErr('');
      try {
        const label = addressType === 'other'
          ? customName.trim()
          : ADDRESS_TYPES.find(t => t.id === addressType)?.label ?? 'Home';
        const token = await getAccessToken();
        await AddressAPI.updateUserAddress(
          editingAddress.id,
          { label, receiver_name: receiverName.trim(), receiver_phone: receiverPhone.trim() },
          { accessToken: token },
        );
        await refreshAddresses();
        setSaved(true);
        setTimeout(() => navigation.goBack(), 700);
      } catch {
        setSaveErr('Failed to update address. Please try again.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Create mode ────────────────────────────────────────────────────────────
    if (!validate()) return;
    setSaving(true);
    setSaveErr('');
    try {
      const label = addressType === 'other'
        ? customName.trim()
        : ADDRESS_TYPES.find(t => t.id === addressType)?.label ?? 'Home';

      await createAndSelectAddress({
        lat:            region.latitude,
        lng:            region.longitude,
        address_line_1: houseNo.trim(),
        address_line_2: '',
        landmark:       landmark.trim(),
        city:           city.trim(),
        state:          stateVal.trim(),
        pincode:        pincode.trim(),
        label,
        receiver_name:  receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
      });
      setSaved(true);
      setTimeout(() => navigation.goBack(), 700);
    } catch {
      setSaveErr('Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Header title differs by mode ─────────────────────────────────────────────
  const headerTitle = editingAddress
    ? 'Edit address'
    : mode === 'list' ? 'Choose delivery address' : 'Set delivery location';

  // ── Render ────────────────────────────────────────────────────────────────────
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
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ════════════════════ LIST MODE ════════════════════ */}
      {mode === 'list' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Use current location (only shown when >100 m from all saved addresses) */}
          {showCurrentLocRow && (
            <TouchableOpacity
              style={styles.currentLocRow}
              onPress={handleUseCurrentLocation}
              activeOpacity={0.8}
            >
              <View style={styles.currentLocIcon}>
                <Ionicons name="navigate" size={20} color={ACCENT} />
              </View>
              <View style={styles.currentLocText}>
                <Text style={styles.currentLocTitle}>Use current location</Text>
                <Text style={styles.currentLocSub}>Add a new address at your current spot</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          )}

          {/* ── Divider ─────────────────────────────────────────── */}
          <View style={styles.listDivider}>
            <View style={styles.listDividerLine} />
            <Text style={styles.listDividerText}>SAVED ADDRESSES</Text>
            <View style={styles.listDividerLine} />
          </View>

          {/* ── Saved addresses ──────────────────────────────────── */}
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
              const dist = coords
                ? _distLabel(coords.latitude, coords.longitude, addr.lat, addr.lng)
                : null;
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
                      {dist && (
                        <View style={styles.distBadge}>
                          <Ionicons name="location-outline" size={10} color={TEXT_MUTED} />
                          <Text style={styles.distBadgeText}>{dist}</Text>
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
                  {/* Edit button */}
                  <TouchableOpacity
                    style={styles.editBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={e => { e.stopPropagation(); handleEditAddress(addr); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={18} color={TEXT_SEC} />
                  </TouchableOpacity>
                  {isSel && (
                    <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
                  )}
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Add new address ──────────────────────────────────── */}
          <TouchableOpacity
            style={styles.addNewBtn}
            onPress={() => { setEditingAddress(null); setMode('form'); }}
            activeOpacity={0.8}
          >
            <View style={styles.addNewIcon}>
              <Ionicons name="add" size={20} color={ACCENT} />
            </View>
            <Text style={styles.addNewText}>Add new address</Text>
            <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        </ScrollView>

      ) : (
      /* ════════════════════ FORM MODE ════════════════════ */
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {/* ── Map (hidden in edit mode) ────────────────────── */}
          {!editingAddress && (
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
              <View style={styles.pinWrap} pointerEvents="none">
                <View style={styles.pinIcon}>
                  <Ionicons name="location" size={44} color={ACCENT} />
                </View>
                <View style={styles.pinShadow} />
              </View>
              <View style={styles.hintBadge} pointerEvents="none">
                <Ionicons name="move-outline" size={13} color={TEXT_SEC} />
                <Text style={styles.hintText}>Drag to move pin</Text>
              </View>
              {isGeocoding && (
                <View style={styles.geocodingBadge}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={styles.geocodingText}>Locating…</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Detected address strip (hidden in edit mode) ──── */}
          {!editingAddress && (
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
          )}

          {/* ── Edit mode: address summary strip ─────────────── */}
          {editingAddress && (
            <View style={styles.editAddrSummary}>
              <View style={styles.editAddrSummaryIcon}>
                <Ionicons name="location" size={20} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.editAddrSummaryLabel}>Address</Text>
                <Text style={styles.editAddrSummaryText} numberOfLines={3}>
                  {editingAddress.formatted_address
                    ?? [editingAddress.address_line_1, editingAddress.city,
                        editingAddress.state, editingAddress.pincode].filter(Boolean).join(', ')}
                </Text>
              </View>
            </View>
          )}

          {/* ── Address form ──────────────────────────────────── */}
          <View style={styles.formContent}>
            <Text style={styles.sectionTitle}>
              {editingAddress ? 'Update label & contact' : 'Complete address details'}
            </Text>

            {/* Full address fields — only for new address creation */}
            {!editingAddress && (
              <>
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
              </>
            )}

            {/* Receiver fields — shown in both create and edit */}
            <Field
              label="Receiver name"
              required
              placeholder="Full name"
              value={receiverName}
              onChangeText={setReceiverName}
              error={errors.receiverName}
            />
            <Field
              label="Receiver phone"
              required
              placeholder="10-digit mobile number"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.receiverPhone}
            />

            {/* Address type chips */}
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
                <Text style={styles.saveBtnText}>
                  {editingAddress ? 'Update Address' : 'Save Address'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
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

  // ── Header ──────────────────────────────────────────────────────────────────
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

  // ── List mode ────────────────────────────────────────────────────────────────

  currentLocRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   WHITE,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  currentLocIcon: {
    width:           42,
    height:          42,
    borderRadius:    12,
    backgroundColor: ACCENT_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  currentLocText:  { flex: 1 },
  currentLocTitle: { fontSize: 14, fontWeight: '700', color: ACCENT, marginBottom: 2 },
  currentLocSub:   { fontSize: 12, color: TEXT_MUTED, fontWeight: '500' },

  listDivider: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               10,
  },
  listDividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  listDividerText: { fontSize: 10, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 1 },

  listLoader: { paddingVertical: 32, alignItems: 'center' },
  listEmpty:  { alignItems: 'center', paddingVertical: 28, gap: 10 },
  listEmptyText: { fontSize: 13, color: TEXT_MUTED, fontWeight: '500' },

  addrRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   WHITE,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  addrRowSel:     { backgroundColor: '#F5F0FF' },
  addrTypeIcon: {
    width:           42,
    height:          42,
    borderRadius:    12,
    backgroundColor: ACCENT_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  addrTypeIconSel: { backgroundColor: ACCENT },
  addrTextBlock:   { flex: 1 },
  addrTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  3,
    flexWrap:      'wrap',
  },
  addrLabel:    { fontSize: 14, fontWeight: '700', color: TEXT_PRI },
  addrLabelSel: { color: ACCENT },
  defaultBadge: {
    backgroundColor:   ACCENT_LIGHT,
    borderRadius:      999,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: ACCENT },
  distBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   BG,
    borderRadius:      999,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       BORDER,
  },
  distBadgeText: { fontSize: 10, color: TEXT_MUTED, fontWeight: '600' },
  addrText: {
    fontSize:     12,
    color:        TEXT_SEC,
    fontWeight:   '500',
    lineHeight:   17,
    marginBottom: 2,
  },
  addrReceiver: { fontSize: 11, color: TEXT_MUTED, fontWeight: '500' },

  addNewBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   WHITE,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               14,
    marginTop:         8,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    BORDER,
  },
  addNewIcon: {
    width:           42,
    height:          42,
    borderRadius:    12,
    backgroundColor: ACCENT_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  addNewText: { flex: 1, fontSize: 14, fontWeight: '700', color: ACCENT },

  editBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   10,
    backgroundColor: BG,
    flexShrink:     0,
  },

  // ── Edit mode address summary ────────────────────────────────────────────────
  editAddrSummary: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    backgroundColor:   WHITE,
    paddingHorizontal: 16,
    paddingVertical:   16,
    gap:               14,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: BORDER,
  },
  editAddrSummaryIcon: {
    width:           42,
    height:          42,
    borderRadius:    12,
    backgroundColor: ACCENT_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    marginTop:       2,
  },
  editAddrSummaryLabel: {
    fontSize:      11,
    fontWeight:    '600',
    color:         TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom:  4,
  },
  editAddrSummaryText: {
    fontSize:   13,
    color:      TEXT_PRI,
    fontWeight: '600',
    lineHeight: 19,
  },

  // ── Map ───────────────────────────────────────────────────────────────────────
  mapWrapper: {
    width:    '100%',
    height:   MAP_HEIGHT,
    overflow: 'hidden',
  },
  map: { ...StyleSheet.absoluteFillObject },
  pinWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pinIcon:   { transform: [{ translateY: -22 }] },
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
  hintText: { fontSize: 12, color: TEXT_SEC, fontWeight: '600' },
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
  geocodingText: { fontSize: 13, color: ACCENT, fontWeight: '600' },

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
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: ACCENT_LIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  detectedTextBlock: { flex: 1 },
  detectedLabel: {
    fontSize:      11,
    color:         TEXT_MUTED,
    fontWeight:    '600',
    marginBottom:  2,
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
  formContent:  { paddingHorizontal: 20, paddingTop: 20 },
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
    paddingVertical:   Platform.OS === 'ios' ? 12 : 10,
    fontSize:          14,
    color:             TEXT_PRI,
    fontWeight:        '500',
  },
  inputError: { borderColor: ERROR_COLOR },
  errorText: {
    fontSize:   11,
    color:      ERROR_COLOR,
    fontWeight: '600',
    marginTop:  4,
  },
  rowFields: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  rowGap:    { width: 12 },
  typeRow:   { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
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
  typeChipSel:  { backgroundColor: ACCENT, borderColor: ACCENT },
  typeLabel:    { fontSize: 13, fontWeight: '700', color: TEXT_SEC },
  typeLabelSel: { color: WHITE },
  apiErrorRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: '#FEF2F2',
    borderRadius:    10,
    padding:         12,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     '#FECACA',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: ERROR_COLOR, fontWeight: '500' },
  saveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: ACCENT,
    borderRadius:    16,
    paddingVertical: 16,
    marginTop:       8,
    shadowColor:     ACCENT,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.28,
    shadowRadius:    10,
    elevation:       5,
  },
  saveBtnDisabled: { backgroundColor: SUCCESS, shadowColor: SUCCESS },
  saveBtnText: {
    fontSize:      16,
    fontWeight:    '800',
    color:         WHITE,
    letterSpacing: -0.2,
  },
});
