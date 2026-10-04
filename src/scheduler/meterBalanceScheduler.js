// src/scheduler/meterBalanceScheduler.js
// ═══════════════════════════════════════════════════════════════════════
// Meter Balance Scheduler - Daily 8:00 AM Sync
// ═══════════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const meterService = require('../services/meterService');

class MeterBalanceScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('[MeterBalanceScheduler] ⚠️ Already running');
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterBalanceScheduler] 🚀 Starting...`);

    // ═══════════════════════════════════════════════════════════════════
    // 8:00 AM Daily - Full Balance Sync
    // ═══════════════════════════════════════════════════════════════════
    const job8AM = cron.schedule('0 8 * * *', async () => {
      const ts = new Date().toISOString();
      console.log(`\n${'▓'.repeat(75)}`);
      console.log(`[${ts}] [MeterBalanceScheduler] ⏰ 8:00 AM - Daily Balance Sync`);
      console.log(`${'▓'.repeat(75)}`);
      
      try {
        const result = await meterService.syncAllMeters();
        console.log(`[${ts}] [MeterBalanceScheduler] 📊 Result:`, result);
      } catch (error) {
        console.error(`[${ts}] [MeterBalanceScheduler] ❌ Failed:`, error.message);
      }
      
      console.log(`${'▓'.repeat(75)}\n`);
    }, { timezone: 'Asia/Dhaka' });

    this.jobs.push(job8AM);
    console.log(`[${timestamp}] [MeterBalanceScheduler] ✅ 8:00 AM job scheduled`);

    // ═══════════════════════════════════════════════════════════════════
    // 8:00 PM Daily - Evening Balance Sync (Optional)
    // ═══════════════════════════════════════════════════════════════════
    const job8PM = cron.schedule('0 20 * * *', async () => {
      const ts = new Date().toISOString();
      console.log(`\n[${ts}] [MeterBalanceScheduler] ⏰ 8:00 PM - Evening Balance Sync`);
      
      try {
        const result = await meterService.syncAllMeters();
        console.log(`[${ts}] [MeterBalanceScheduler] 📊 Result:`, result);
      } catch (error) {
        console.error(`[${ts}] [MeterBalanceScheduler] ❌ Failed:`, error.message);
      }
    }, { timezone: 'Asia/Dhaka' });

    this.jobs.push(job8PM);
    console.log(`[${timestamp}] [MeterBalanceScheduler] ✅ 8:00 PM job scheduled`);

    this.isRunning = true;
    console.log(`[${timestamp}] [MeterBalanceScheduler] ✅ Started with ${this.jobs.length} jobs`);
  }

  stop() {
    if (!this.isRunning) return;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterBalanceScheduler] 🛑 Stopping...`);
    
    this.jobs.forEach((job, i) => {
      job.stop();
      console.log(`[${timestamp}] [MeterBalanceScheduler] ✅ Job ${i + 1} stopped`);
    });
    
    this.jobs = [];
    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
    };
  }
}

module.exports = new MeterBalanceScheduler();