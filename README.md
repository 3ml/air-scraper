# Air Scraper

Stealth web scraping microservice with Playwright, API triggers, and admin dashboard.

## Features

- **API-triggered scraping** - Trigger scenarios via HTTP POST
- **Stealth mode** - Anti-detection with playwright-extra stealth plugin
- **Human-like behavior** - Bezier mouse movements, Gaussian typing delays
- **Task queue** - Priority-based with automatic retry and exponential backoff
- **Admin dashboard** - Real-time task monitoring and log viewer
- **Callbacks** - POST results to external endpoint on completion
- **Alerts** - Webhook notifications on errors
- **Prometheus metrics** - `/metrics` endpoint for monitoring

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
cd air-scraper

# Install backend dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Install dashboard dependencies
cd dashboard
npm install
cd ..

# Create environment file
cp .env.example .env
```

### Configuration

Edit `.env` file:

```bash
# Minimum required for local development
AUTH_TOKEN=dev-token-change-in-production
SCRAPER_SECRET=dev-secret
ENCRYPTION_SECRET=dev-encryption-key-change-in-production
CALLBACK_URL=http://localhost:3100/callback
ALERT_WEBHOOK_URL=http://localhost:3100/alert
```

### Running

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start dashboard
cd dashboard
npm run dev
```

- **API Server**: http://localhost:3000
- **Dashboard**: http://localhost:3001

### Testing the API

```bash
# Trigger test scenario
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -H "x-auth-token: dev-token-change-in-production" \
  -d '{"action": "test", "data": {"url": "https://example.com"}}'

# Check health
curl http://localhost:3000/health

# Get metrics
curl http://localhost:3000/metrics
```

---

## Production Setup (VPS)

### Server Requirements

- **OS**: Ubuntu 22.04 LTS or newer
- **RAM**: 4GB minimum (8GB recommended)
- **CPU**: 2 vCPU minimum
- **Storage**: 40GB SSD
- **Network**: Public IP with ports 80, 443

### Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Caddy (reverse proxy with auto HTTPS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Step 2: Deploy Application

```bash
# Create app directory
sudo mkdir -p /opt/air-scraper
sudo chown $USER:$USER /opt/air-scraper
cd /opt/air-scraper

# Clone or copy project files
# (use git clone, scp, or rsync)

# Install dependencies
npm ci --production

# Install Playwright with system dependencies
npx playwright install chromium --with-deps

# Build TypeScript
npm run build

# Build dashboard
cd dashboard
npm ci
npm run build
cd ..
```

### Step 3: Configure Environment

```bash
# Create production environment file
cat > .env << 'EOF'
# Server
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# Authentication (CHANGE THESE!)
AUTH_TOKEN=generate-64-char-secure-token-here
SCRAPER_SECRET=generate-another-secure-secret-here
ENCRYPTION_SECRET=generate-secure-encryption-key-share-with-client

# Database
DATABASE_PATH=/var/lib/air-scraper/data.db

# Callback endpoints
CALLBACK_URL=https://your-app.com/api/scraper/callback
ALERT_WEBHOOK_URL=https://your-app.com/api/scraper/alert

# Browser
BROWSER_HEADLESS=true
BROWSER_POOL_SIZE=3
CONTEXT_STORAGE_PATH=/var/lib/air-scraper/contexts

# Performance
MAX_CONCURRENT_TASKS=5
TASK_TIMEOUT_MS=300000

# Logging
LOG_LEVEL=info
EOF

# Create data directories
sudo mkdir -p /var/lib/air-scraper
sudo chown $USER:$USER /var/lib/air-scraper

# Create log directory
mkdir -p /opt/air-scraper/logs
```

### Step 4: Initialize Database

```bash
cd /opt/air-scraper
npm run migrate
```

### Step 5: Configure PM2

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Run the command it outputs (sudo env PATH=...)
```

### Step 6: Configure Caddy (Reverse Proxy)

```bash
# Edit Caddy configuration
sudo nano /etc/caddy/Caddyfile
```

Add:

```caddyfile
# API Server
scraper.yourdomain.com {
    reverse_proxy localhost:3000

    header {
        -Server
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
    }
}

# Admin Dashboard
admin.yourdomain.com {
    root * /opt/air-scraper/dashboard/dist
    file_server
    try_files {path} /index.html

    # Proxy API calls
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle /admin/* {
        reverse_proxy localhost:3000
    }
    handle /health {
        reverse_proxy localhost:3000
    }
    handle /metrics {
        reverse_proxy localhost:3000
    }
}
```

```bash
# Restart Caddy
sudo systemctl restart caddy

# Check status
sudo systemctl status caddy
```

### Step 7: Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 8: Verify Installation

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs air-scraper

# Test health endpoint
curl https://scraper.yourdomain.com/health
```

---

## Docker Deployment (Alternative)

```bash
cd /opt/air-scraper

# Create environment file
cp .env.example .env
# Edit .env with production values

# Build and start
cd docker
docker-compose up -d

# Check logs
docker-compose logs -f
```

---

## Useful Commands

### PM2 Management

```bash
pm2 status                    # Check status
pm2 logs air-scraper          # View logs
pm2 restart air-scraper       # Restart
pm2 stop air-scraper          # Stop
pm2 monit                     # Real-time monitor
```

### Log Analysis

```bash
# View recent logs
tail -f /opt/air-scraper/logs/out.log

# Search for errors
grep -i error /opt/air-scraper/logs/error.log
```

### Database

```bash
# SQLite CLI
sqlite3 /var/lib/air-scraper/data.db

# Useful queries
.tables                       # List tables
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;
SELECT status, COUNT(*) FROM tasks GROUP BY status;
```

### Backup

```bash
# Backup database
cp /var/lib/air-scraper/data.db /backup/scraper-$(date +%Y%m%d).db

# Backup with rsync
rsync -avz /var/lib/air-scraper/ user@backup-server:/backups/air-scraper/
```

---

## API Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trigger` | POST | Trigger a scraping scenario |
| `/api/scenarios` | GET | List all scenarios with JSON Schema documentation |
| `/api/tasks/:id` | GET | Get task status |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/admin/tasks` | GET | List all tasks |
| `/admin/logs` | GET | View logs |
| `/admin/stats` | GET | Statistics |

### Discover Available Scenarios

```bash
curl -X GET https://scraper.yourdomain.com/api/scenarios \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

Returns all scenarios with their input/output JSON Schema, example inputs, and rate limits.

### Trigger Request (Encrypted)

The `action` and `data` fields must be encrypted using AES-256-GCM before sending.

```bash
curl -X POST https://scraper.yourdomain.com/api/trigger \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_AUTH_TOKEN" \
  -d '{
    "action": "BASE64_ENCRYPTED_ACTION",
    "data": "BASE64_ENCRYPTED_DATA_JSON",
    "priority": 5,
    "callbackUrl": "https://your-app.com/callback"
  }'
```

---

## Encryption Guide for API Clients

The API requires `action` and `data` fields to be encrypted using **AES-256-GCM**. Both parties must share the same `ENCRYPTION_SECRET`.

### Encryption Standard

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Derivation | SHA-256 hash of secret |
| IV Length | 12 bytes (96 bits) |
| Auth Tag Length | 16 bytes (128 bits) |
| Output Format | `base64(IV + AuthTag + Ciphertext)` |

### How It Works

1. **Key Derivation**: The shared secret is hashed with SHA-256 to produce a 32-byte key
2. **Encryption**: Generate random 12-byte IV, encrypt with AES-256-GCM
3. **Packaging**: Concatenate `IV (12 bytes) + AuthTag (16 bytes) + Ciphertext`
4. **Encoding**: Base64 encode the result

### Node.js Example

```javascript
import { createCipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTION_SECRET = 'your-shared-secret'; // Same as server

function encrypt(plaintext) {
  // Derive 32-byte key from secret
  const key = createHash('sha256').update(ENCRYPTION_SECRET).digest();

  // Generate random 12-byte IV
  const iv = randomBytes(12);

  // Create cipher
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: IV (12) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}

// Usage
const encryptedAction = encrypt('scenario_name');
const encryptedData = encrypt(JSON.stringify({ url: 'https://example.com' }));

// Send request
fetch('https://scraper.yourdomain.com/api/trigger', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-token': 'YOUR_AUTH_TOKEN'
  },
  body: JSON.stringify({
    action: encryptedAction,
    data: encryptedData,
    priority: 5
  })
});
```

### PHP Example

```php
<?php
$ENCRYPTION_SECRET = 'your-shared-secret';

function encrypt($plaintext) {
    global $ENCRYPTION_SECRET;

    // Derive key with SHA-256
    $key = hash('sha256', $ENCRYPTION_SECRET, true);

    // Generate random 12-byte IV
    $iv = random_bytes(12);

    // Encrypt with AES-256-GCM
    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $authTag,
        '',
        16  // Auth tag length
    );

    // Combine: IV + AuthTag + Ciphertext
    $combined = $iv . $authTag . $ciphertext;

    return base64_encode($combined);
}

// Usage
$encryptedAction = encrypt('scenario_name');
$encryptedData = encrypt(json_encode(['url' => 'https://example.com']));

$payload = json_encode([
    'action' => $encryptedAction,
    'data' => $encryptedData,
    'priority' => 5
]);

$ch = curl_init('https://scraper.yourdomain.com/api/trigger');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-auth-token: YOUR_AUTH_TOKEN'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
```

### Python Example

```python
import base64
import hashlib
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENCRYPTION_SECRET = 'your-shared-secret'

def encrypt(plaintext: str) -> str:
    # Derive 32-byte key
    key = hashlib.sha256(ENCRYPTION_SECRET.encode()).digest()

    # Generate random 12-byte IV
    iv = os.urandom(12)

    # Encrypt
    aesgcm = AESGCM(key)
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode(), None)

    # cryptography library appends tag to ciphertext
    # We need: IV + AuthTag + Ciphertext
    auth_tag = ciphertext_with_tag[-16:]
    ciphertext = ciphertext_with_tag[:-16]

    combined = iv + auth_tag + ciphertext
    return base64.b64encode(combined).decode()

# Usage
encrypted_action = encrypt('scenario_name')
encrypted_data = encrypt(json.dumps({'url': 'https://example.com'}))

import requests
response = requests.post(
    'https://scraper.yourdomain.com/api/trigger',
    headers={
        'Content-Type': 'application/json',
        'x-auth-token': 'YOUR_AUTH_TOKEN'
    },
    json={
        'action': encrypted_action,
        'data': encrypted_data,
        'priority': 5
    }
)
```

### Important Notes

1. **Same Secret**: Both client and server must use the exact same `ENCRYPTION_SECRET`
2. **Random IV**: Always generate a new random IV for each encryption (never reuse)
3. **JSON for Data**: The `data` field must be encrypted as a JSON string
4. **Auth Tag**: GCM mode provides authentication - tampered data will fail decryption
5. **Error Handling**: If decryption fails, the API returns `400 Decryption Error`

---

## Decrypting Callback Payload

The callback payload sent to your endpoint is **encrypted** using the same AES-256-GCM standard. Your server must decrypt it to access the task results.

**Received format:**
```json
{
  "data": "BASE64_ENCRYPTED_PAYLOAD"
}
```

**Headers received:**
- `x-scraper-secret`: Verify this matches your `SCRAPER_SECRET`
- `x-task-id`: Unique task identifier (UUID returned by trigger)
- `x-request-id`: Original request correlation ID for logging

### Node.js Decryption

```javascript
import { createDecipheriv, createHash } from 'crypto';

const ENCRYPTION_SECRET = 'your-shared-secret';

function decrypt(encryptedBase64) {
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

// Express/Fastify handler example
app.post('/scraper/callback', (req, res) => {
  const secret = req.headers['x-scraper-secret'];
  if (secret !== process.env.SCRAPER_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const payload = decrypt(req.body.data);
  // payload = { taskId, requestId, action, status, inputData, resultData, ... }

  console.log('Task completed:', payload.taskId, payload.status);
  res.status(200).send('OK');
});
```

### PHP Decryption

```php
<?php
$ENCRYPTION_SECRET = 'your-shared-secret';

function decrypt($encryptedBase64) {
    global $ENCRYPTION_SECRET;

    $key = hash('sha256', $ENCRYPTION_SECRET, true);
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

// Laravel example
public function handleCallback(Request $request) {
    $secret = $request->header('x-scraper-secret');
    if ($secret !== config('scraper.secret')) {
        return response('Unauthorized', 401);
    }

    $payload = decrypt($request->input('data'));
    // $payload = ['taskId' => ..., 'resultData' => [...], ...]

    Log::info('Scraper callback', ['taskId' => $payload['taskId']]);
    return response('OK', 200);
}
```

### Python Decryption

```python
import base64
import hashlib
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENCRYPTION_SECRET = 'your-shared-secret'

def decrypt(encrypted_base64: str) -> dict:
    key = hashlib.sha256(ENCRYPTION_SECRET.encode()).digest()
    combined = base64.b64decode(encrypted_base64)

    iv = combined[:12]
    auth_tag = combined[12:28]
    ciphertext = combined[28:]

    # cryptography expects tag appended to ciphertext
    ciphertext_with_tag = ciphertext + auth_tag

    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, ciphertext_with_tag, None)

    return json.loads(decrypted.decode())

# Flask example
@app.route('/scraper/callback', methods=['POST'])
def handle_callback():
    secret = request.headers.get('x-scraper-secret')
    if secret != os.environ['SCRAPER_SECRET']:
        return 'Unauthorized', 401

    payload = decrypt(request.json['data'])
    # payload = {'taskId': ..., 'resultData': {...}, ...}

    print(f"Task {payload['taskId']} completed with status {payload['status']}")
    return 'OK', 200
```

---

## Troubleshooting

### Browser won't launch

```bash
# Install missing dependencies
npx playwright install-deps chromium
```

### Permission denied errors

```bash
sudo chown -R $USER:$USER /opt/air-scraper
sudo chown -R $USER:$USER /var/lib/air-scraper
```

### Port already in use

```bash
# Find process using port
sudo lsof -i :3000
# Kill it
kill -9 <PID>
```

### Memory issues

```bash
# Reduce browser pool
# Edit .env
BROWSER_POOL_SIZE=2
MAX_CONCURRENT_TASKS=3

# Restart
pm2 restart air-scraper
```

---

## Production Deployment Info

| Resource | Value |
|----------|-------|
| **Server IP** | `77.42.80.187` |
| **API URL** | `https://scraper.airelite.it/api/trigger` |
| **Port** | `3000` |
| **App Directory** | `/opt/air-scraper` |

### DNS Configuration

Point the following DNS A record:
```
scraper.airelite.it  →  77.42.80.187
```

### Caddy Configuration

```caddyfile
scraper.airelite.it {
    reverse_proxy localhost:3000

    header {
        -Server
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
    }
}
```

---

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide and API reference
- [PIANO.md](./PIANO.md) - Full implementation plan

---

## License

Private - AirElite Project
