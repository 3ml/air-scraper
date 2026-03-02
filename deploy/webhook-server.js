#!/usr/bin/env node

/**
 * Simple webhook server for GitHub auto-deploy
 * Listens for push events and triggers deploy script
 */

import http from 'node:http';
import { execSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Configuration
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'change-me-in-production';
const DEPLOY_SCRIPT = process.env.DEPLOY_SCRIPT || '/opt/air-scraper/deploy/deploy.sh';
const LOG_FILE = process.env.DEPLOY_LOG || '/opt/air-scraper/logs/deploy.log';
const BRANCH = process.env.DEPLOY_BRANCH || 'main';

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  fs.appendFileSync(LOG_FILE, logLine);
}

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function runDeploy() {
  log('Starting deploy...');

  const deploy = spawn('bash', [DEPLOY_SCRIPT], {
    cwd: path.dirname(DEPLOY_SCRIPT),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  deploy.stdout.on('data', (data) => {
    log(`[deploy] ${data.toString().trim()}`);
  });

  deploy.stderr.on('data', (data) => {
    log(`[deploy:error] ${data.toString().trim()}`);
  });

  deploy.on('close', (code) => {
    if (code === 0) {
      log('Deploy completed successfully!');
    } else {
      log(`Deploy failed with exit code ${code}`);
    }
  });
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'webhook-server' }));
    return;
  }

  // Only accept POST to /webhook
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });

  req.on('end', () => {
    // Verify GitHub signature
    const signature = req.headers['x-hub-signature-256'];
    if (!verifySignature(body, signature)) {
      log('Invalid signature - rejecting webhook');
      res.writeHead(401);
      res.end('Invalid signature');
      return;
    }

    try {
      const payload = JSON.parse(body);
      const event = req.headers['x-github-event'];

      log(`Received ${event} event`);

      // Only deploy on push to main branch
      if (event === 'push') {
        const branch = payload.ref?.replace('refs/heads/', '');

        if (branch === BRANCH) {
          log(`Push to ${BRANCH} detected - triggering deploy`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'deploying' }));

          // Run deploy async
          setImmediate(runDeploy);
        } else {
          log(`Push to ${branch} - ignoring (not ${BRANCH})`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ignored', reason: `branch ${branch}` }));
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ignored', reason: `event ${event}` }));
      }
    } catch (err) {
      log(`Error processing webhook: ${err.message}`);
      res.writeHead(400);
      res.end('Invalid payload');
    }
  });
});

server.listen(PORT, () => {
  log(`Webhook server listening on port ${PORT}`);
  log(`Watching branch: ${BRANCH}`);
  log(`Deploy script: ${DEPLOY_SCRIPT}`);
});
