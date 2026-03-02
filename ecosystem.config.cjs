module.exports = {
  apps: [
    {
      name: 'air-scraper',
      script: 'dist/index.js',
      instances: 2,              // 2 instances for zero-downtime reload
      exec_mode: 'cluster',      // Cluster mode enables load balancing
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',  // Per instance (2G total)

      // Graceful reload settings
      wait_ready: true,          // Wait for process.send('ready')
      listen_timeout: 10000,     // Max time to wait for ready signal
      kill_timeout: 5000,        // Time to wait before force kill

      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
