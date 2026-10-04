// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'meterbondhu-stg',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      
      // ─── Environment Variables ──────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 7788,
        APP_NAME: 'MeterBondhu STG',
        APP_ENV: 'staging',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 7788,
        APP_NAME: 'MeterBondhu STG',
        APP_ENV: 'staging',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 7788,
        APP_NAME: 'MeterBondhu STG (Dev)',
        APP_ENV: 'development',
      },
      
      // ─── Logging ────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/stg-error.log',
      out_file: './logs/stg-out.log',
      log_file: './logs/stg-combined.log',
      merge_logs: true,
      
      // ─── Auto Restart ──────────────────────────────────────────────────
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // ─── Graceful Shutdown ─────────────────────────────────────────────
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // ─── Instance Settings ─────────────────────────────────────────────
      node_args: '--max-old-space-size=512',
      
      // ─── Error Handling ────────────────────────────────────────────────
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // ─── Instance ID ──────────────────────────────────────────────────
      instance_var: 'INSTANCE_ID',
    },
  ],
};