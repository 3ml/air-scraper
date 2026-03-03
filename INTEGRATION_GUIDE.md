# Air Scraper - Integration Guide

This guide explains how to integrate with the Air Scraper microservice from an external application.

---

## Table of Contents

1. [Overview](#overview)
2. [URLs and Endpoints](#urls-and-endpoints)
3. [Authentication](#authentication)
4. [Encryption Setup](#encryption-setup)
5. [Making API Requests](#making-api-requests)
6. [Available Scenarios](#available-scenarios)
7. [Callback Handling](#callback-handling)
8. [Error Handling](#error-handling)
9. [Code Examples](#code-examples)

---

## Overview

Air Scraper is a standalone web scraping microservice that:
- Receives encrypted scraping tasks via HTTP API
- Executes them with anti-detection measures (stealth mode, human-like behavior)
- Returns results via callback URL

**Flow:**
```
Your App                     Air Scraper                    Target Website
   │                              │                              │
   │ 1. POST /api/trigger         │                              │
   │ ─────────────────────────────>                              │
   │                              │ 2. Execute scenario          │
   │                              │ ─────────────────────────────>
   │                              │                              │
   │                              │ <─────────────────────────────
   │                              │ 3. Return scraped data       │
   │ <─────────────────────────────                              │
   │ 4. POST to callbackUrl       │                              │
   │    (with scraped data)       │                              │
```

---

## URLs and Endpoints

### Production Environment

| Resource | URL |
|----------|-----|
| **API Base URL** | `https://scraper.airelite.it` |
| **Trigger Endpoint** | `https://scraper.airelite.it/api/trigger` |
| **Health Check** | `https://scraper.airelite.it/health` |
| **Task Status** | `https://scraper.airelite.it/api/tasks/{taskId}` |

### Callback URL (Your Application)

Your application must expose an endpoint to receive scraping results:

| Purpose | Suggested URL |
|---------|---------------|
| **Result Callback** | `https://app.airelite.it/api/scraper/callback` |
| **Error Alerts** | `https://app.airelite.it/api/scraper/alert` |

---

## Authentication

### Required Headers

Every request to the scraper must include:

```http
Content-Type: application/json
x-auth-token: YOUR_AUTH_TOKEN
```

### Callback Verification

When the scraper sends results to your callback URL, verify the request using:

```http
x-scraper-secret: YOUR_SCRAPER_SECRET
```

### Environment Variables to Share

| Variable | Purpose | Who Uses It |
|----------|---------|-------------|
| `AUTH_TOKEN` | Authenticate requests TO scraper | Your app → Scraper |
| `SCRAPER_SECRET` | Verify callbacks FROM scraper | Scraper → Your app |
| `ENCRYPTION_SECRET` | Encrypt/decrypt payloads | Both sides |

---

## Encryption Setup

**All `action` and `data` fields must be encrypted using AES-256-GCM.**

### Encryption Parameters

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Derivation | SHA-256 hash of `ENCRYPTION_SECRET` |
| IV Length | 12 bytes (96 bits) |
| Auth Tag Length | 16 bytes (128 bits) |
| Output Format | `base64(IV + AuthTag + Ciphertext)` |

### How Encryption Works

1. **Key**: Hash your shared secret with SHA-256 to get a 32-byte key
2. **IV**: Generate a random 12-byte initialization vector (different for each encryption)
3. **Encrypt**: Use AES-256-GCM to encrypt the plaintext
4. **Package**: Concatenate `IV (12 bytes) + AuthTag (16 bytes) + Ciphertext`
5. **Encode**: Base64 encode the result

---

## Making API Requests

### POST /api/trigger

Trigger a scraping scenario.

**Request:**
```http
POST https://scraper.airelite.it/api/trigger
Content-Type: application/json
x-auth-token: YOUR_AUTH_TOKEN

{
  "action": "BASE64_ENCRYPTED_ACTION_NAME",
  "data": "BASE64_ENCRYPTED_JSON_OBJECT",
  "priority": 5,
  "callbackUrl": "https://app.airelite.it/api/scraper/callback"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | Encrypted scenario name (e.g., `test`, `airelite-test`) |
| `data` | string | Yes | Encrypted JSON object with scenario-specific input |
| `priority` | number | No | 1-10, higher = more priority (default: 5) |
| `callbackUrl` | string | No | Override default callback URL |

**Response (202 Accepted):**
```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Task queued for action: test"
}
```

### GET /api/tasks/{taskId}

Check task status (optional, callback is recommended).

**Response:**
```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req-abc123",
  "action": "test",
  "status": "completed",
  "inputData": { "url": "https://example.com" },
  "resultData": { "title": "Example Domain", "url": "https://example.com" },
  "error": null,
  "attemptCount": 1,
  "createdAt": "2025-02-28T10:00:00Z",
  "startedAt": "2025-02-28T10:00:01Z",
  "completedAt": "2025-02-28T10:00:15Z"
}
```

**Possible Status Values:**
- `pending` - Task is queued
- `running` - Task is being executed
- `completed` - Task finished successfully
- `failed` - Task failed after all retries
- `cancelled` - Task was cancelled

### GET /health

Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-02-28T10:30:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "checks": {
    "database": true,
    "browserPool": 3,
    "pendingTasks": 2,
    "runningTasks": 1
  }
}
```

---

## Available Scenarios

### 1. `test` - Test Scenario

Simple test to validate the system works.

**Input:**
```json
{
  "url": "https://example.com",
  "message": "Optional message"
}
```

**Output:**
```json
{
  "title": "Example Domain",
  "url": "https://example.com",
  "timestamp": "2025-02-28T10:30:00Z",
  "message": "Optional message"
}
```

### 2. `airelite-test` - AirElite Properties Extraction

Login to AirElite dashboard and extract properties list.

**Input:**
```json
{
  "username": "user@email.com",
  "password": "password123",
  "baseUrl": "https://app.airelite.it"
}
```

**Output:**
```json
{
  "success": true,
  "properties": [
    {
      "id": 123,
      "name": "Appartamento Centro",
      "address": "Via Roma 1, 20100 Milano, MI",
      "owner": { "name": "Mario Rossi", "id": 45 },
      "smoobuId": "12345",
      "vikeyId": "abc123",
      "city": "Milano",
      "province": "MI",
      "beds": 2,
      "baths": 1,
      "sqm": 65,
      "status": "Attivo"
    }
  ],
  "totalCount": 1,
  "timestamp": "2025-02-28T10:30:00Z"
}
```

---

## Callback Handling

When a task completes (success or failure), the scraper sends results to your callback URL.

**⚠️ IMPORTANT: The callback payload is encrypted with AES-256-GCM using `ENCRYPTION_SECRET`.**

### Callback Request

```http
POST https://app.airelite.it/api/scraper/callback
Content-Type: application/json
x-scraper-secret: YOUR_SCRAPER_SECRET
x-request-id: req-abc123

{
  "data": "BASE64_ENCRYPTED_PAYLOAD"
}
```

### Decrypting the Callback

You must decrypt the `data` field using the same `ENCRYPTION_SECRET` to access the payload:

```typescript
// Node.js example
import { createDecipheriv, createHash } from 'crypto';

function decrypt(encryptedBase64: string): object {
  const key = createHash('sha256').update(ENCRYPTION_SECRET).digest();
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}
```

### Decrypted Payload Structure

```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req-abc123",
  "action": "test",
  "status": "completed",
  "inputData": { "url": "https://example.com" },
  "resultData": { "title": "Example Domain", "url": "https://example.com" },
  "error": null,
  "executionMs": 12345,
  "timestamp": "2025-02-28T10:30:00Z"
}
```

### Callback Fields

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | Unique task identifier |
| `requestId` | string | Correlation ID for logging |
| `action` | string | Scenario that was executed |
| `status` | string | `completed` or `failed` |
| `inputData` | object | Original input data |
| `resultData` | object | Scraped data (null if failed) |
| `error` | object | Error details (null if success) |
| `executionMs` | number | Execution time in milliseconds |
| `timestamp` | string | ISO 8601 timestamp |

### Error Object (when failed)

```json
{
  "error": {
    "message": "Navigation timeout exceeded",
    "code": "TIMEOUT"
  }
}
```

### Alert Webhook

For critical errors, alerts are sent to the alert webhook:

```http
POST https://app.airelite.it/api/scraper/alert
Content-Type: application/json

{
  "type": "error",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "airelite-test",
  "title": "Task Failed",
  "message": "Navigation timeout exceeded after 3 retries",
  "context": { "attemptCount": 3 },
  "timestamp": "2025-02-28T10:30:00Z"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 202 | Task accepted and queued |
| 400 | Invalid request (validation error, decryption failed) |
| 401 | Missing or invalid `x-auth-token` |
| 404 | Task not found |
| 429 | Rate limited |
| 500 | Internal server error |

### Error Response Format

```json
{
  "error": "Decryption failed",
  "code": "DECRYPTION_ERROR",
  "details": "Invalid ciphertext or authentication tag"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `DECRYPTION_ERROR` | Wrong encryption secret or format | Verify `ENCRYPTION_SECRET` matches |
| `INVALID_ACTION` | Scenario not found | Check available scenarios |
| `VALIDATION_ERROR` | Missing required fields | Check scenario input requirements |
| `TIMEOUT` | Scraping took too long | Target site may be slow/blocking |

---

## Code Examples

### Node.js / TypeScript

```typescript
import { createCipheriv, createHash, randomBytes } from 'crypto';

const SCRAPER_URL = 'https://scraper.airelite.it';
const AUTH_TOKEN = 'your-auth-token';
const ENCRYPTION_SECRET = 'your-shared-encryption-secret';

function encrypt(plaintext: string): string {
  const key = createHash('sha256').update(ENCRYPTION_SECRET).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV (12) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

async function triggerScraping(
  action: string,
  data: object,
  callbackUrl?: string
): Promise<{ taskId: string }> {
  const response = await fetch(`${SCRAPER_URL}/api/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': AUTH_TOKEN,
    },
    body: JSON.stringify({
      action: encrypt(action),
      data: encrypt(JSON.stringify(data)),
      priority: 5,
      callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Scraper error: ${error.error}`);
  }

  return response.json();
}

// Example: Trigger test scenario
const result = await triggerScraping('test', {
  url: 'https://example.com'
});
console.log('Task ID:', result.taskId);

// Example: Trigger AirElite extraction
const aireliteResult = await triggerScraping('airelite-test', {
  username: 'user@email.com',
  password: 'password123',
  baseUrl: 'https://app.airelite.it',
});
console.log('Task ID:', aireliteResult.taskId);
```

### PHP

```php
<?php
define('SCRAPER_URL', 'https://scraper.airelite.it');
define('AUTH_TOKEN', 'your-auth-token');
define('ENCRYPTION_SECRET', 'your-shared-encryption-secret');

function encrypt(string $plaintext): string {
    $key = hash('sha256', ENCRYPTION_SECRET, true);
    $iv = random_bytes(12);

    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $authTag,
        '',
        16
    );

    // Format: IV + AuthTag + Ciphertext
    $combined = $iv . $authTag . $ciphertext;
    return base64_encode($combined);
}

function triggerScraping(string $action, array $data, ?string $callbackUrl = null): array {
    $payload = [
        'action' => encrypt($action),
        'data' => encrypt(json_encode($data)),
        'priority' => 5,
    ];

    if ($callbackUrl) {
        $payload['callbackUrl'] = $callbackUrl;
    }

    $ch = curl_init(SCRAPER_URL . '/api/trigger');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-auth-token: ' . AUTH_TOKEN,
        ],
        CURLOPT_RETURNTRANSFER => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 202) {
        throw new Exception('Scraper error: ' . $response);
    }

    return json_decode($response, true);
}

// Decrypt callback payload
function decrypt(string $encryptedBase64): array {
    $key = hash('sha256', ENCRYPTION_SECRET, true);
    $combined = base64_decode($encryptedBase64);

    $iv = substr($combined, 0, 12);
    $authTag = substr($combined, 12, 16);
    $ciphertext = substr($combined, 28);

    $decrypted = openssl_decrypt(
        $ciphertext,
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $authTag
    );

    return json_decode($decrypted, true);
}

// Verify callback
function verifyCallback(): bool {
    $secret = $_SERVER['HTTP_X_SCRAPER_SECRET'] ?? '';
    return hash_equals(SCRAPER_SECRET, $secret);
}

// Handle callback (payload is now encrypted)
function handleCallback(): void {
    if (!verifyCallback()) {
        http_response_code(401);
        exit('Unauthorized');
    }

    $body = json_decode(file_get_contents('php://input'), true);
    $payload = decrypt($body['data']);  // Decrypt the payload

    // Process the result
    $taskId = $payload['taskId'];
    $status = $payload['status'];
    $resultData = $payload['resultData'];

    // Your business logic here...

    http_response_code(200);
    echo json_encode(['received' => true]);
}

// Example usage
$result = triggerScraping('test', ['url' => 'https://example.com']);
echo "Task ID: " . $result['taskId'];
```

### Python

```python
import base64
import hashlib
import json
import os
from typing import Any, Optional
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SCRAPER_URL = 'https://scraper.airelite.it'
AUTH_TOKEN = 'your-auth-token'
ENCRYPTION_SECRET = 'your-shared-encryption-secret'

def encrypt(plaintext: str) -> str:
    # Derive key with SHA-256
    key = hashlib.sha256(ENCRYPTION_SECRET.encode()).digest()

    # Generate random 12-byte IV
    iv = os.urandom(12)

    # Encrypt with AES-256-GCM
    aesgcm = AESGCM(key)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode(), None)

    # cryptography appends tag to ciphertext, we need IV + Tag + Ciphertext
    auth_tag = ciphertext_with_tag[-16:]
    ciphertext = ciphertext_with_tag[:-16]

    combined = iv + auth_tag + ciphertext
    return base64.b64encode(combined).decode()

def trigger_scraping(
    action: str,
    data: dict[str, Any],
    callback_url: Optional[str] = None
) -> dict:
    payload = {
        'action': encrypt(action),
        'data': encrypt(json.dumps(data)),
        'priority': 5,
    }

    if callback_url:
        payload['callbackUrl'] = callback_url

    response = requests.post(
        f'{SCRAPER_URL}/api/trigger',
        headers={
            'Content-Type': 'application/json',
            'x-auth-token': AUTH_TOKEN,
        },
        json=payload,
    )

    if response.status_code != 202:
        raise Exception(f'Scraper error: {response.text}')

    return response.json()

# Example: Trigger test scenario
result = trigger_scraping('test', {'url': 'https://example.com'})
print(f"Task ID: {result['taskId']}")

# Example: Trigger AirElite extraction
airelite_result = trigger_scraping('airelite-test', {
    'username': 'user@email.com',
    'password': 'password123',
    'baseUrl': 'https://app.airelite.it',
})
print(f"Task ID: {airelite_result['taskId']}")
```

---

## Quick Reference Card

### Trigger Request

```bash
curl -X POST https://scraper.airelite.it/api/trigger \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_AUTH_TOKEN" \
  -d '{
    "action": "ENCRYPTED_ACTION",
    "data": "ENCRYPTED_DATA_JSON",
    "priority": 5,
    "callbackUrl": "https://your-app.com/callback"
  }'
```

### Check Health

```bash
curl https://scraper.airelite.it/health
```

### Check Task Status

```bash
curl https://scraper.airelite.it/api/tasks/TASK_ID \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

---

## Configuration Checklist

Before integrating, ensure you have:

- [ ] `AUTH_TOKEN` - For authenticating requests to the scraper
- [ ] `ENCRYPTION_SECRET` - Shared secret for payload encryption
- [ ] `SCRAPER_SECRET` - For verifying callbacks from the scraper
- [ ] Callback endpoint implemented at your application
- [ ] Alert webhook endpoint (optional but recommended)
- [ ] Network access to `https://scraper.airelite.it`

---

## Support

For issues or questions:
- Check logs via admin dashboard
- Review task status via API
- Contact the development team

---

*Last updated: 2025-02-28*
