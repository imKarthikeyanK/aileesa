/**
 * authApi.js — Authentication API service layer
 *
 * ARCHITECTURE
 * ────────────
 * ACTIVE_PROVIDER selects the implementation at the bottom of this file.
 * To go live, change ACTIVE_PROVIDER to 'real' and fill in RealProvider.
 *
 * CONTRACT — both providers must implement:
 *   sendOtp(phone)               → { requestId, expiresInSec, _devOtp? }
 *   verifyOtp(requestId, otp)    → { accessToken, refreshToken, expiresInSec, user }
 *   refreshAccessToken(token)    → { accessToken, expiresInSec, user? }
 *   revokeSession(refreshToken)  → void
 *
 * OTP FORMAT: 6-char alphanumeric — 1 letter + 4 digits + 1 letter (e.g. "A3456B")
 * TOKENS:     Signed by backend in production; mock uses a simple encoded payload.
 *
 * Errors: all methods throw { code, message } on failure.
 *   Codes: INVALID_OTP | OTP_EXPIRED | TOKEN_EXPIRED | TOKEN_REVOKED | INVALID_TOKEN | NETWORK_ERROR
 */

// ─── Switch this to 'real' when backend is ready ──────────────────────────────
const ACTIVE_PROVIDER = 'mock'; // 'mock' | 'real'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function authError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Generates a 6-char alphanumeric OTP: 1 letter + 4 digits + 1 letter */
function generateOtp() {
  // Exclude ambiguous chars: I O 0 1
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const D = '23456789';
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  return pick(L) + pick(D) + pick(D) + pick(D) + pick(D) + pick(L);
}

/**
 * Encode a payload into a token string.
 * NOT cryptographically secure — mock only.
 * In production, the backend returns real signed JWTs.
 */
function encodeToken(payload) {
  return `v1.${encodeURIComponent(JSON.stringify(payload))}.aileesa`;
}

function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return null;
    return JSON.parse(decodeURIComponent(parts[1]));
  } catch {
    return null;
  }
}

// ─── Expiry constants (seconds) ───────────────────────────────────────────────
const ACCESS_TTL  = 15 * 60;        // 15 minutes
const REFRESH_TTL = 30 * 24 * 3600; // 30 days
const OTP_TTL     = 5  * 60;        // 5 minutes

// ─── Mock in-memory stores (reset on app restart) ─────────────────────────────
const _otpStore      = new Map(); // requestId → { otp, phone, expiresAt }
const _revokedJtis   = new Set(); // revoked refresh token jtis
const _usersByPhone  = new Map(); // phone → { id, name, phone }

// ─── Mock Provider ────────────────────────────────────────────────────────────
const MockProvider = {
  async sendOtp(phone) {
    await delay(700);

    const otp       = generateOtp();
    const requestId = generateId();
    const expiresAt = Date.now() + OTP_TTL * 1000;

    _otpStore.set(requestId, { otp, phone, expiresAt });

    // In production this triggers a real WhatsApp message via your backend.
    // In dev, log + expose the OTP so testers can enter it manually.
    if (__DEV__) {
      console.log(`[AuthMock] OTP for +91 ${phone} → ${otp}`);
    }

    return {
      requestId,
      expiresInSec: OTP_TTL,
      _devOtp: __DEV__ ? otp : undefined,
    };
  },

  async verifyOtp(requestId, otp) {
    await delay(800);

    const record = _otpStore.get(requestId);
    if (!record) {
      throw authError('OTP_EXPIRED', 'OTP has expired or is invalid. Please request a new one.');
    }
    if (Date.now() > record.expiresAt) {
      _otpStore.delete(requestId);
      throw authError('OTP_EXPIRED', 'OTP has expired. Please request a new one.');
    }
    if (record.otp !== otp.toUpperCase()) {
      throw authError('INVALID_OTP', 'The OTP you entered is incorrect. Please try again.');
    }

    _otpStore.delete(requestId);

    // Get or create user profile
    let user = _usersByPhone.get(record.phone);
    if (!user) {
      user = { id: generateId(), name: '', phone: record.phone };
      _usersByPhone.set(record.phone, user);
    }

    const accessPayload = {
      sub: user.id, phone: user.phone,
      jti: generateId(),
      exp: Date.now() + ACCESS_TTL * 1000,
    };
    const refreshPayload = {
      sub: user.id, phone: user.phone,
      jti: generateId(),
      exp: Date.now() + REFRESH_TTL * 1000,
    };

    return {
      accessToken:  encodeToken(accessPayload),
      refreshToken: encodeToken(refreshPayload),
      expiresInSec: ACCESS_TTL,
      user: { id: user.id, name: user.name, phone: user.phone },
    };
  },

  async refreshAccessToken(refreshToken) {
    await delay(400);

    const payload = decodeToken(refreshToken);
    if (!payload) throw authError('INVALID_TOKEN', 'Invalid refresh token.');
    if (Date.now() > payload.exp) throw authError('TOKEN_EXPIRED', 'Session expired. Please log in again.');
    if (_revokedJtis.has(payload.jti)) throw authError('TOKEN_REVOKED', 'Session revoked. Please log in again.');

    const user = _usersByPhone.get(payload.phone);
    const newPayload = {
      sub:   payload.sub,
      phone: payload.phone,
      jti:   generateId(),
      exp:   Date.now() + ACCESS_TTL * 1000,
    };

    return {
      accessToken:  encodeToken(newPayload),
      expiresInSec: ACCESS_TTL,
      user: user ? { id: user.id, name: user.name, phone: user.phone } : undefined,
    };
  },

  async revokeSession(refreshToken) {
    await delay(300);
    const payload = decodeToken(refreshToken);
    if (payload?.jti) _revokedJtis.add(payload.jti);
  },

  /** Mock-only: update the name stored for a phone number */
  async updateUserName(phone, name) {
    const user = _usersByPhone.get(phone);
    if (user) {
      user.name = name;
      _usersByPhone.set(phone, user);
    }
  },
};

// ─── Real Provider (production) ───────────────────────────────────────────────
// Fill in the BASE_URL and implement each method to call your backend.
const RealProvider = {
  BASE_URL: 'https://api.aileesa.com/v1/auth',

  async _post(path, body) {
    const res = await fetch(`${this.BASE_URL}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw authError(data.code ?? 'NETWORK_ERROR', data.message ?? 'An error occurred.');
    return data;
  },

  async sendOtp(phone) {
    return this._post('/otp/send', { phone });
  },

  async verifyOtp(requestId, otp) {
    return this._post('/otp/verify', { requestId, otp });
  },

  async refreshAccessToken(refreshToken) {
    return this._post('/token/refresh', { refreshToken });
  },

  async revokeSession(refreshToken) {
    return this._post('/token/revoke', { refreshToken });
  },

  async updateUserName(phone, name) {
    // TODO: PATCH /user/profile  { name }
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────
const providers = { mock: MockProvider, real: RealProvider };

/** The active auth API — swap ACTIVE_PROVIDER to switch implementations */
export const AuthAPI = providers[ACTIVE_PROVIDER];

/** True when running in mock mode — used to show dev UI (e.g. OTP banner) */
export const IS_MOCK = ACTIVE_PROVIDER === 'mock';
