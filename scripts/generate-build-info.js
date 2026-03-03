#!/usr/bin/env node
/**
 * Generate build info file with git commit hash
 * This script runs during build to capture the current commit
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const buildInfo = {
  gitCommit: getGitCommit(),
  gitBranch: getGitBranch(),
  buildTime: new Date().toISOString(),
};

const outputPath = join(__dirname, '..', 'src', 'build-info.json');
writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2) + '\n');

console.log(`Build info generated: ${JSON.stringify(buildInfo)}`);
