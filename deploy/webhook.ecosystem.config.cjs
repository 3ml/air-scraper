/**
 * PM2 configuration for webhook server
 */
module.exports = {
  apps: [
    {
      name: 'air-scraper-webhook',
      script: './webhook-server.js',
      cwd: '/opt/air-scraper/deploy',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 9000,
        WEBHOOK_SECRET: 'CHANGE_THIS_SECRET',
        DEPLOY_SCRIPT: '/opt/air-scraper/deploy/deploy.sh',
        DEPLOY_LOG: '/opt/air-scraper/logs/deploy.log',
        DEPLOY_BRANCH: 'main'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/air-scraper/logs/webhook-error.log',
      out_file: '/opt/air-scraper/logs/webhook-out.log',
      merge_logs: true
    }
  ]
};
