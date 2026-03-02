#!/bin/bash

# Air Scraper - Auto Deploy Script
# Triggered by webhook on git push

set -e

APP_DIR="/opt/air-scraper"
LOG_FILE="$APP_DIR/logs/deploy.log"
LOCK_FILE="/tmp/air-scraper-deploy.lock"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Prevent concurrent deploys
if [ -f "$LOCK_FILE" ]; then
    log "Deploy already in progress (lock file exists). Exiting."
    exit 1
fi

trap "rm -f $LOCK_FILE" EXIT
touch "$LOCK_FILE"

cd "$APP_DIR"

log "========================================="
log "Starting deployment..."
log "========================================="

# 1. Pull latest changes
log "Pulling latest changes from git..."
git fetch origin
git reset --hard origin/main

# 2. Install ALL dependencies (including devDependencies for build)
log "Installing dependencies..."
npm ci --include=dev

# 3. Build TypeScript
log "Building TypeScript..."
npm run build

# 4. Prune devDependencies after build
log "Pruning devDependencies..."
npm prune --production

# 5. Run database migrations (if any)
log "Running migrations..."
npm run migrate || true

# 7. Build dashboard (optional - uncomment if needed)
# log "Building dashboard..."
# cd dashboard
# npm ci
# npm run build
# cd ..

# 8. Reload PM2 app (zero-downtime with cluster mode)
log "Reloading application (zero-downtime)..."

# Check if app exists in PM2, if not start it
if pm2 list | grep -q "air-scraper"; then
    # Graceful reload - one instance at a time
    pm2 reload ecosystem.config.cjs --env production
else
    # First deploy - start the app
    log "First deploy - starting app..."
    pm2 start ecosystem.config.cjs --env production
    pm2 save
fi

# 9. Wait for ready signal and check health
log "Waiting for instances to be ready..."
sleep 3

# Health check with retries
MAX_RETRIES=5
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health | grep -q "ok"; then
        log "Health check passed!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log "WARNING: Health check failed after $MAX_RETRIES attempts!"
    pm2 logs air-scraper --lines 20
fi

# Show cluster status
pm2 list

log "========================================="
log "Deployment completed!"
log "========================================="
