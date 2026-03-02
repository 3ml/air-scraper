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

# 8. Restart PM2 app
log "Restarting application..."
pm2 reload air-scraper --update-env

# 9. Wait and check health
log "Waiting for app to start..."
sleep 5

# Health check
if curl -s http://localhost:3322/health | grep -q "ok"; then
    log "Health check passed!"
else
    log "WARNING: Health check failed!"
    pm2 logs air-scraper --lines 20
fi

log "========================================="
log "Deployment completed!"
log "========================================="
