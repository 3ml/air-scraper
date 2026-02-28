import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from '../config/env.js';

/**
 * AES-256-GCM Encryption Utility
 *
 * Standard: AES-256-GCM (Galois/Counter Mode)
 * - 256-bit key (32 bytes)
 * - 96-bit IV (12 bytes) - recommended for GCM
 * - 128-bit auth tag (16 bytes)
 *
 * Output format: base64(iv + authTag + ciphertext)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits - recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derive a 32-byte key from the secret
 * Uses SHA-256 to ensure consistent key length
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @param secret - Optional custom secret (defaults to ENCRYPTION_SECRET)
 * @returns Base64 encoded string containing IV + AuthTag + Ciphertext
 */
export function encrypt(plaintext: string, secret?: string): string {
  const key = deriveKey(secret || env.ENCRYPTION_SECRET);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 * @param encryptedBase64 - Base64 encoded string (IV + AuthTag + Ciphertext)
 * @param secret - Optional custom secret (defaults to ENCRYPTION_SECRET)
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decrypt(encryptedBase64: string, secret?: string): string {
  const key = deriveKey(secret || env.ENCRYPTION_SECRET);
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt an object (converts to JSON first)
 * @param obj - Object to encrypt
 * @param secret - Optional custom secret
 * @returns Base64 encoded encrypted string
 */
export function encryptObject(obj: unknown, secret?: string): string {
  const json = JSON.stringify(obj);
  return encrypt(json, secret);
}

/**
 * Decrypt to an object (parses JSON after decryption)
 * @param encryptedBase64 - Base64 encoded encrypted string
 * @param secret - Optional custom secret
 * @returns Parsed object
 */
export function decryptObject<T = unknown>(encryptedBase64: string, secret?: string): T {
  const json = decrypt(encryptedBase64, secret);
  return JSON.parse(json) as T;
}

/**
 * Check if a string appears to be encrypted (base64 with minimum length)
 * Note: This is a heuristic, not a guarantee
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  // Minimum length: IV (12) + AuthTag (16) + at least 1 byte ciphertext = 29 bytes
  // In base64: ceil(29 * 4/3) = 39 characters minimum
  if (value.length < 39) return false;

  // Check if valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(value);
}

/**
 * Try to decrypt, return original if decryption fails
 * Useful for backwards compatibility during migration
 */
export function tryDecrypt(value: string, secret?: string): string {
  if (!isEncrypted(value)) return value;

  try {
    return decrypt(value, secret);
  } catch {
    return value;
  }
}

export default {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  isEncrypted,
  tryDecrypt,
};
