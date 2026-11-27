import crypto from 'node:crypto';

const DEFAULT_TOKEN_SECRET = process.env.ERP_JWT_SECRET || 'erpklinik-cloud-vps-hmac-2026-secret-key';
const ENC_KEY = crypto.createHash('sha256').update(DEFAULT_TOKEN_SECRET + ':aes-bridging').digest();

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain), salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (!stored.startsWith('scrypt:')) {
    return String(plain) === String(stored);
  }
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(String(plain), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signJwt(payload, expiresInSeconds = 86400) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const sig = crypto.createHmac('sha256', DEFAULT_TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', DEFAULT_TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(body));
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function encryptSecret(plain) {
  if (!plain || isMaskedValue(plain)) return '';
  if (String(plain).startsWith('enc:')) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored) {
  if (!stored) return '';
  if (!String(stored).startsWith('enc:')) return String(stored);
  try {
    const [, ivHex, tagHex, dataHex] = String(stored).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function isMaskedValue(val) {
  if (!val) return true;
  const s = String(val).trim();
  return s === '' || /^[•*]+/.test(s);
}

export function maskSecretSummary(stored) {
  const plain = decryptSecret(stored);
  if (!plain || isMaskedValue(plain)) {
    return { hasSecret: false, masked: '' };
  }
  const tail = plain.length >= 4 ? plain.slice(-4) : plain;
  return { hasSecret: true, masked: `••••${tail}` };
}

export function generateTotpSecret() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of base32.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function computeTotpCode(secret, stepOffset = 0) {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret, code) {
  const clean = String(code || '').trim();
  if (!/^\d{6}$/.test(clean)) return false;
  for (const offset of [-1, 0, 1]) {
    if (computeTotpCode(secret, offset) === clean) return true;
  }
  return false;
}

export function mapUserRoleToCloudRole(roleName = '') {
  if (roleName.includes('Owner') || roleName.includes('Direktur')) return 'Owner / Direktur';
  if (roleName.includes('HR')) return 'Manajer HR & SDM';
  if (roleName.includes('Keuangan') || roleName.includes('Akunting') || roleName === 'Kasir') {
    return 'Manajer Keuangan & Akunting';
  }
  if (roleName.includes('Purchasing') || roleName.includes('Logistik') || roleName === 'Apoteker') {
    return 'Manajer Purchasing & Logistik';
  }
  return roleName || 'Owner / Direktur';
}

export function checkPermission(state, user, moduleCode, action = 'view') {
  if (!user) return false;
  const roleName = mapUserRoleToCloudRole(user.role);
  if (roleName === 'Owner / Direktur') return true;
  const roleDef = (state.rolePermissions || []).find(
    (r) => r.role.toLowerCase() === roleName.toLowerCase() || r.role.toLowerCase() === String(user.role).toLowerCase()
  );
  if (!roleDef || !roleDef.matrix) return true;
  const modPerm = roleDef.matrix[moduleCode];
  if (!modPerm) return false;
  return Boolean(modPerm[action]);
}

export function sanitizeOutletForClient(outlet) {
  const ssMask = maskSecretSummary(outlet.satuSehatClientSecret);
  const bpjsSecMask = maskSecretSummary(outlet.bpjsSecretKey);
  const bpjsUsrMask = maskSecretSummary(outlet.bpjsUserKey);
  const copy = { ...outlet };
  delete copy.satuSehatClientSecret;
  delete copy.bpjsSecretKey;
  delete copy.bpjsUserKey;
  return {
    ...copy,
    hasSatuSehatSecret: ssMask.hasSecret,
    satuSehatClientSecretMasked: ssMask.masked,
    hasBpjsSecret: bpjsSecMask.hasSecret,
    bpjsSecretKeyMasked: bpjsSecMask.masked,
    hasBpjsUserKey: bpjsUsrMask.hasSecret,
    bpjsUserKeyMasked: bpjsUsrMask.masked
  };
}

export function sanitizeUserForClient(user) {
  const copy = { ...user };
  delete copy.passwordHash;
  delete copy.password;
  delete copy.twoFaSecret;
  return copy;
}
