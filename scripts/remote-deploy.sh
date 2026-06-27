#!/usr/bin/env bash
# Runs ON the production server. Invoked by scripts/deploy.sh after the repo has
# already been fetched and reset to origin/main, so this file is always the latest
# committed version when it executes.
#
# Steps: install deps, build, (optionally migrate / rebuild dashboard), reload the
# PM2 process, then verify the local /health endpoint responds 200.
set -euo pipefail

MIGRATE=false
DASHBOARD=false
for arg in "$@"; do
  case "$arg" in
    --migrate) MIGRATE=true ;;
    --dashboard) DASHBOARD=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

echo "==> Installing dependencies (npm ci)"
# npm ci occasionally flakes with ENOTEMPTY while wiping node_modules; force-clean and retry once.
npm ci || { echo "npm ci failed — removing node_modules and retrying"; rm -rf node_modules; npm ci; }

echo "==> Building backend"
npm run build

if [ "$DASHBOARD" = true ]; then
  echo "==> Building dashboard"
  (cd dashboard && npm ci && npm run build)
fi

if [ "$MIGRATE" = true ]; then
  echo "==> Running DB migrations"
  npm run migrate
fi

echo "==> Reloading PM2 process (graceful, zero-downtime in cluster mode)"
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

echo "==> Health check"
sleep 2
curl -fsS http://localhost:3000/health
echo
echo "==> Remote deploy complete"
