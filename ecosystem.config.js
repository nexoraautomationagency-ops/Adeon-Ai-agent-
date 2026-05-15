/**
 * PM2 Ecosystem Config — Production Process Manager
 * 
 * DEPLOY COMMANDS:
 *   npm run build:client          (build frontend once)
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save                      (auto-restart on reboot)
 *   pm2 startup                   (run command it outputs)
 *
 * MONITOR:
 *   pm2 status
 *   pm2 logs adeon-ai
 *   pm2 restart adeon-ai
 */

module.exports = {
  apps: [
    {
      name: 'adeon-ai',
      script: 'server/index.js',
      
      // Node.js specific optimizations
      node_args: '--max-old-space-size=1024', // Give Node 1GB to prevent OOM on busy turns

      // Restart policy — prevents crash loops from wiping WhatsApp session
      max_restarts: 15,
      restart_delay: 5000,           // Wait 5s between restarts
      exp_backoff_restart_delay: 100, // Slowly increase wait time if crashing
      min_uptime: '15s',             // If app crashes before 15s, count as failed restart

      // Memory limit — restart if memory exceeds 1GB (Puppeteer can leak)
      max_memory_restart: '1G',

      // Logs
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // Environment: Development
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },

      // Environment: Production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
