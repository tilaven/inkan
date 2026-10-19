/**
 * Sealed tokens for cookies: AES-256-GCM under a key derived from the secret with HKDF-SHA256,
 * with the expiry inside the encrypted payload. Tokens are opaque, URL-safe strings.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export const MIN_SECRET_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const keys = new Map();

/**
 * One key per purpose, so a token sealed for one cookie never opens as another.
 * @returns {Buffer}
 */
function keyFor(secret, purpose) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`The session secret must be a string of at least ${MIN_SECRET_LENGTH} characters`);
  }
  const id = `${purpose}\0${secret}`;
  let key = keys.get(id);
  if (!key) {
    key = Buffer.from(hkdfSync('sha256', secret, '', `inkan ${purpose} v1`, 32));
    keys.set(id, key);
  }
  return key;
}

/**
 * @param {unknown} data Anything JSON can carry
 * @param {string} secret
 * @param {number} maxAge Seconds until the token expires
 * @param {string} [purpose] What the token is for; `unseal` must be given the same
 */
export function seal(data, secret, maxAge, purpose = 'session') {
  if (!Number.isFinite(maxAge) || maxAge <= 0) throw new Error('maxAge must be a positive number of seconds');
  const key = keyFor(secret, purpose);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + Math.ceil(maxAge), data }));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
}

/**
 * The sealed data, or `null` when the token is malformed, tampered with or expired.
 * @param {unknown} token
 * @param {string} secret
 * @param {string} [purpose]
 */
export function unseal(token, secret, purpose = 'session') {
  const key = keyFor(secret, purpose);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  if (raw.length < IV_LENGTH + TAG_LENGTH + 1) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_LENGTH));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_LENGTH));
    const plain = Buffer.concat([decipher.update(raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH)), decipher.final()]);
    const { exp, data } = JSON.parse(plain.toString());
    if (typeof exp !== 'number' || exp <= Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}
