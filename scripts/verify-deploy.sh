#!/bin/bash
# Verify that the deployed version matches the local git commit

HEALTH_URL="https://scraper.airelite.it/health"
LOCAL_COMMIT=$(git rev-parse --short=7 HEAD)
REMOTE_JSON=$(curl -s "$HEALTH_URL")
REMOTE_COMMIT=$(echo "$REMOTE_JSON" | grep -o '"gitCommit":"[^"]*"' | cut -d'"' -f4)
REMOTE_UPTIME=$(echo "$REMOTE_JSON" | grep -o '"uptime":[0-9]*' | cut -d: -f2)
REMOTE_BUILD=$(echo "$REMOTE_JSON" | grep -o '"buildTime":"[^"]*"' | cut -d'"' -f4)

echo "Local commit:  $LOCAL_COMMIT"
echo "Remote commit: $REMOTE_COMMIT"
echo "Build time:    $REMOTE_BUILD"
echo "Uptime:        ${REMOTE_UPTIME}s"
echo ""

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
  echo "✅ Deploy is up to date"
else
  echo "❌ Mismatch! Deploy needed"
  exit 1
fi
