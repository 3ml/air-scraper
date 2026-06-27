#!/usr/bin/env bash
# One-command deploy: ships the current main branch to the production server.
#
#   npm run deploy                 # backend only
#   npm run deploy -- --migrate    # also run DB migrations
#   npm run deploy -- --dashboard  # also rebuild the dashboard
#   DEPLOY_HOST=user@host npm run deploy   # override the SSH target
#
# The server is reset hard to origin/main, so the working tree MUST be clean and
# pushed first (enforced below). .env and other gitignored files are preserved
# (git reset --hard does not touch untracked files; git clean is never run).
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@77.42.80.187}"
APP_DIR="${APP_DIR:-/opt/air-scraper}"
BRANCH="${DEPLOY_BRANCH:-main}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Preflight: local tree must be clean and pushed so the server's reset matches ---
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working tree not clean. Commit or stash your changes before deploying." >&2
  exit 1
fi

git fetch origin "$BRANCH" --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "❌ HEAD ($LOCAL) != origin/$BRANCH ($REMOTE). Push your commits first." >&2
  exit 1
fi

echo "==> Deploying ${LOCAL:0:7} to $DEPLOY_HOST:$APP_DIR (branch $BRANCH)"
ssh "$DEPLOY_HOST" \
  "cd '$APP_DIR' && git fetch origin && git reset --hard 'origin/$BRANCH' && bash scripts/remote-deploy.sh $*"

echo "==> Verifying public deployment"
bash "$SCRIPT_DIR/verify-deploy.sh"
