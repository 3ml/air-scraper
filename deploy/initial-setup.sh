#!/bin/bash

# Initial setup script - Run this ONCE from your local machine
# Usage: ./deploy/initial-setup.sh

set -e

SERVER="77.42.80.187"
PORT="3322"
USER="root"
REMOTE_DIR="/opt/air-scraper"

echo "=================================="
echo "Air Scraper - Initial Deploy Setup"
echo "=================================="

# Generate webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo ""
echo "Generated webhook secret:"
echo "$WEBHOOK_SECRET"
echo ""
echo "⚠️  SAVE THIS! You'll need it for GitHub webhook config."
echo ""

read -p "Press Enter to continue with server setup..."

# Create directories on server
echo "Creating directories on server..."
ssh -p $PORT $USER@$SERVER "mkdir -p $REMOTE_DIR/deploy $REMOTE_DIR/logs"

# Copy deploy files
echo "Copying deploy files to server..."
scp -P $PORT deploy/webhook-server.js $USER@$SERVER:$REMOTE_DIR/deploy/
scp -P $PORT deploy/deploy.sh $USER@$SERVER:$REMOTE_DIR/deploy/
scp -P $PORT deploy/webhook.ecosystem.config.cjs $USER@$SERVER:$REMOTE_DIR/deploy/

# Make executable and update config
echo "Configuring on server..."
ssh -p $PORT $USER@$SERVER << EOF
  cd $REMOTE_DIR/deploy
  chmod +x deploy.sh

  # Update webhook secret in config
  sed -i "s/CHANGE_THIS_SECRET/$WEBHOOK_SECRET/" webhook.ecosystem.config.cjs

  # Start webhook server with PM2
  pm2 start webhook.ecosystem.config.cjs
  pm2 save

  echo ""
  echo "Webhook server started!"
  pm2 status
EOF

echo ""
echo "=================================="
echo "✅ Server setup complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Add webhook to GitHub:"
echo "   URL: https://scraper.airelite.it/webhook"
echo "   Secret: $WEBHOOK_SECRET"
echo "   Events: Just the push event"
echo ""
echo "2. Update Caddy config on server to add /webhook route"
echo "   (see deploy/SETUP.md for details)"
echo ""
echo "3. Test with: git push"
echo ""
