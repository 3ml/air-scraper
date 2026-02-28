/**
 * Test script for encrypted API trigger
 *
 * Usage:
 *   npx tsx scripts/test-encrypted-trigger.ts
 *
 * Or with custom values:
 *   ENCRYPTION_SECRET=my-secret AUTH_TOKEN=my-token npx tsx scripts/test-encrypted-trigger.ts
 */

import { createCipheriv, createHash, randomBytes } from 'crypto';

// Configuration - override with environment variables
const API_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'dev-token-change-in-production';
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'dev-encryption-key-change-in-production';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Derive a 32-byte key from the secret using SHA-256
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 * Output format: base64(IV + AuthTag + Ciphertext)
 */
function encrypt(plaintext: string): string {
  const key = deriveKey(ENCRYPTION_SECRET);
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
 * Encrypt an object (converts to JSON first)
 */
function encryptObject(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

async function main() {
  console.log('=== Encrypted Trigger Test ===\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Using ENCRYPTION_SECRET: ${ENCRYPTION_SECRET.substring(0, 10)}...`);
  console.log('');

  // Test payload
  const action = 'test';
  const data = {
    url: 'https://example.com',
    testParam: 'hello world',
  };

  console.log('Original payload:');
  console.log(`  action: "${action}"`);
  console.log(`  data: ${JSON.stringify(data)}`);
  console.log('');

  // Encrypt
  const encryptedAction = encrypt(action);
  const encryptedData = encryptObject(data);

  console.log('Encrypted payload:');
  console.log(`  action: "${encryptedAction}"`);
  console.log(`  data: "${encryptedData}"`);
  console.log('');

  // Build request body
  const requestBody = {
    action: encryptedAction,
    data: encryptedData,
    priority: 5,
  };

  console.log('Sending request to /api/trigger...\n');

  try {
    const response = await fetch(`${API_URL}/api/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': AUTH_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log('Response body:');
    console.log(JSON.stringify(responseData, null, 2));

    if (response.status === 202) {
      console.log('\n✓ Success! Task created.');

      // Fetch task status
      const taskId = responseData.taskId;
      console.log(`\nFetching task status for ${taskId}...`);

      const statusResponse = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        headers: {
          'x-auth-token': AUTH_TOKEN,
        },
      });

      const statusData = await statusResponse.json();
      console.log('Task status:');
      console.log(JSON.stringify(statusData, null, 2));
    } else {
      console.log('\n✗ Request failed.');
    }
  } catch (error) {
    console.error('Request error:', error);
  }
}

main();
