// src/scheduler/rechargeScheduler.js
const cron = require('node-cron');
const rechargeService = require('../services/rechargeService');

class RechargeScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('[RechargeScheduler] ⚠️ Scheduler is already running');
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeScheduler] 🚀 Starting recharge scheduler...`);
    
    // ─── Every 5 minutes check for new recharges ──────────────────────────
    // */5 * * * * = প্রতি 5 মিনিটে
    const job5Min = cron.schedule('*/5 * * * *', async () => {
      const timestamp2 = new Date().toISOString();
      console.log(`[${timestamp2}] [RechargeScheduler] ⏰ Running 5-minute recharge check...`);
      try {
        await rechargeService.checkAllUsersForNewRecharges();
      } catch (error) {
        console.error(`[${timestamp2}] [RechargeScheduler] ❌ Recharge check failed:`, error.message);
      }
    });
    this.jobs.push(job5Min);
    console.log(`[${timestamp}] [RechargeScheduler] ✅ 5-minute job scheduled`);

    // ─── Every hour process unprocessed recharges ──────────────────────────
    // 0 * * * * = প্রতি ঘন্টায়
    const jobHourly = cron.schedule('0 * * * *', async () => {
      const timestamp2 = new Date().toISOString();
      console.log(`[${timestamp2}] [RechargeScheduler] ⏰ Running hourly unprocessed recharge check...`);
      try {
        await rechargeService.processUnprocessedRecharges();
      } catch (error) {
        console.error(`[${timestamp2}] [RechargeScheduler] ❌ Unprocessed recharge check failed:`, error.message);
      }
    });
    this.jobs.push(jobHourly);
    console.log(`[${timestamp}] [RechargeScheduler] ✅ Hourly job scheduled`);

    this.isRunning = true;
    console.log(`[${timestamp}] [RechargeScheduler] ✅ Scheduler started with ${this.jobs.length} jobs`);
    console.log(`[${timestamp}] [RechargeScheduler] 📋 Schedule: Every 5 minutes, Hourly`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('[RechargeScheduler] ⚠️ Scheduler is not running');
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeScheduler] 🛑 Stopping scheduler...`);
    
    this.jobs.forEach((job, index) => {
      job.stop();
      console.log(`[${timestamp}] [RechargeScheduler] ✅ Job ${index + 1} stopped`);
    });
    
    this.jobs = [];
    this.isRunning = false;
    console.log(`[${timestamp}] [RechargeScheduler] ✅ Scheduler stopped`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
    };
  }
}

module.exports = new RechargeScheduler();