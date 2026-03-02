# Auto-Deploy Setup Guide

## Overview

```
[Local] git push → [GitHub] webhook → [Server:9000] → deploy.sh → PM2 restart
```

## Initial Server Setup (One-time)

### 1. SSH into server

```bash
ssh -p 3322 root@77.42.80.187
```

### 2. Create deploy directory and copy files

```bash
mkdir -p /opt/air-scraper/deploy
mkdir -p /opt/air-scraper/logs
```

### 3. Generate webhook secret

```bash
openssl rand -hex 32
# Save this output - you need it for GitHub and config
```

### 4. Edit webhook config on server

After copying files, edit `/opt/air-scraper/deploy/webhook.ecosystem.config.cjs`:

```bash
nano /opt/air-scraper/deploy/webhook.ecosystem.config.cjs
# Change WEBHOOK_SECRET to your generated secret
```

### 5. Make deploy script executable

```bash
chmod +x /opt/air-scraper/deploy/deploy.sh
```

### 6. Start webhook server

```bash
cd /opt/air-scraper/deploy
pm2 start webhook.ecosystem.config.cjs
pm2 save
```

### 7. Add webhook route to Caddy

Edit `/etc/caddy/Caddyfile`:

```caddyfile
scraper.airelite.it {
    handle /webhook {
        reverse_proxy localhost:9000
    }

    reverse_proxy localhost:3000

    header {
        -Server
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
    }
}
```

Restart Caddy:

```bash
sudo systemctl restart caddy
```

## GitHub Webhook Setup

1. Go to: `https://github.com/YOUR_USER/air-scraper/settings/hooks`
2. Click **Add webhook**
3. Configure:
   - **Payload URL**: `https://scraper.airelite.it/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your generated secret
   - **Events**: Just the push event
4. Save

## Verify

```bash
# Check webhook server
pm2 status
curl http://localhost:9000/health

# Test from outside
curl -I https://scraper.airelite.it/webhook
```

## Usage

After setup, just push normally:

```bash
git add .
git commit -m "My changes"
git push
```

The server will automatically pull, build, and restart.

## Logs

```bash
# Deploy logs
tail -f /opt/air-scraper/logs/deploy.log

# Webhook server logs
pm2 logs air-scraper-webhook
```
