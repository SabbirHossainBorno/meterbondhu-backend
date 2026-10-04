// src/scheduler/alertScheduler.js
const cron = require('node-cron');
const alertService = require('../services/alertService');

class AlertScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('[AlertScheduler] ⚠️ Scheduler is already running');
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AlertScheduler] 🚀 Starting alert scheduler...`);
    
    // ═══════════════════════════════════════════════════════════════
    // 🧪 TEST MODE - Every 1 minute check
    // ⚠️ Set TEST_MODE = false in production!
    // ═══════════════════════════════════════════════════════════════
    const TEST_MODE = false; // Change to true for testing
    
    if (TEST_MODE) {
      const jobTest = cron.schedule('* * * * *', async () => {
        const timestamp2 = new Date().toISOString();
        console.log(`[${timestamp2}] [AlertScheduler] 🧪 TEST: Running 1-min alert check...`);
        try {
          await alertService.checkLowBalanceAlerts();
        } catch (error) {
          console.error(`[${timestamp2}] [AlertScheduler] ❌ Test check failed:`, error.message);
        }
      }, {
        timezone: 'Asia/Dhaka'
      });
      this.jobs.push(jobTest);
      console.log(`[${timestamp}] [AlertScheduler] ✅ 🧪 TEST MODE: Job scheduled (every 1 minute)`);
      
      this.isRunning = true;
      console.log(`[${timestamp}] [AlertScheduler] 🎯 Schedule: Every 1 minute (TEST MODE)`);
      return;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PRODUCTION MODE - 8:00 AM to 11:59 PM (00:00)
    // ═══════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════
    // 1. HOURLY CHECK: 8:00 AM to 11:00 PM (every hour)
    //    Cron: 0 8-23 * * *
    //    Runs at: 8:00, 9:00, 10:00, ..., 22:00, 23:00
    //    Total: 16 times per day
    // ═══════════════════════════════════════════════════════════════
    const jobHourly = cron.schedule('0 8-23 * * *', async () => {
      const timestamp2 = new Date().toISOString();
      console.log(`\n${'▓'.repeat(75)}`);
      console.log(`[${timestamp2}] [AlertScheduler] ⏰ Hourly alert check (8AM-11PM)`);
      console.log(`${'▓'.repeat(75)}`);
      try {
        await alertService.checkLowBalanceAlerts();
      } catch (error) {
        console.error(`[${timestamp2}] [AlertScheduler] ❌ Hourly check failed:`, error.message);
      }
    }, {
      timezone: 'Asia/Dhaka'
    });
    this.jobs.push(jobHourly);
    console.log(`[${timestamp}] [AlertScheduler] ✅ Hourly job scheduled (8:00 AM - 11:00 PM)`);

    // ═══════════════════════════════════════════════════════════════
    // 2. CRITICAL CHECK: Every 10 min (8:00 AM - 11:50 PM)
    //    Cron: */10 8-23 * * *
    //    Runs at: 8:00, 8:10, 8:20, ..., 23:40, 23:50
    //    Total: 96 times per day
    // ═══════════════════════════════════════════════════════════════
    const job10Min = cron.schedule('*/10 8-23 * * *', async () => {
      const timestamp2 = new Date().toISOString();
      try {
        await alertService.checkCriticalAlerts();
      } catch (error) {
        console.error(`[${timestamp2}] [AlertScheduler] ❌ Critical check failed:`, error.message);
      }
    }, {
      timezone: 'Asia/Dhaka'
    });
    this.jobs.push(job10Min);
    console.log(`[${timestamp}] [AlertScheduler] ✅ 10-min critical job scheduled (8:00 AM - 11:50 PM)`);

    // ═══════════════════════════════════════════════════════════════
    // 3. MIDNIGHT RESET: 12:00 AM
    //    Cron: 0 0 * * *
    //    Resets daily counters
    // ═══════════════════════════════════════════════════════════════
    const jobMidnight = cron.schedule('0 0 * * *', async () => {
      const timestamp2 = new Date().toISOString();
      console.log(`\n${'▓'.repeat(75)}`);
      console.log(`[${timestamp2}] [AlertScheduler] 🌙 MIDNIGHT RESET`);
      console.log(`${'▓'.repeat(75)}`);
      alertService.resetDailyCounters();
      console.log(`[${timestamp2}] [AlertScheduler] ✅ Counters reset. Next alert check: 8:00 AM`);
      console.log(`${'▓'.repeat(75)}\n`);
    }, {
      timezone: 'Asia/Dhaka'
    });
    this.jobs.push(jobMidnight);
    console.log(`[${timestamp}] [AlertScheduler] ✅ Midnight reset job scheduled (12:00 AM)`);

    // ═══════════════════════════════════════════════════════════════
    // 4. STARTUP CHECK: Server start হওয়ার 30 সেকেন্ড পর 1 বার
    //    (যদি 8 AM - 11 PM এর মধ্যে থাকে)
    // ═══════════════════════════════════════════════════════════════
    const currentHour = new Date().getHours();
    if (currentHour >= 8 && currentHour <= 23) {
      setTimeout(async () => {
        const timestamp2 = new Date().toISOString();
        console.log(`[${timestamp2}] [AlertScheduler] 🚀 Startup alert check (server just started)`);
        try {
          await alertService.checkLowBalanceAlerts();
        } catch (error) {
          console.error(`[${timestamp2}] [AlertScheduler] ❌ Startup check failed:`, error.message);
        }
      }, 30000);
      console.log(`[${timestamp}] [AlertScheduler] ✅ Startup check scheduled (30s delay)`);
    } else {
      console.log(`[${timestamp}] [AlertScheduler] ℹ️ Startup check skipped (outside 8AM-11PM)`);
    }

    this.isRunning = true;
    console.log(`\n[${timestamp}] [AlertScheduler] ═══════════════════════════════════════`);
    console.log(`[${timestamp}] [AlertScheduler] ✅ Scheduler started with ${this.jobs.length} jobs`);
    console.log(`[${timestamp}] [AlertScheduler] 📋 Schedule:`);
    console.log(`[${timestamp}] [AlertScheduler]    • Hourly (8AM-11PM): 16 checks/day`);
    console.log(`[${timestamp}] [AlertScheduler]    • Critical (8AM-11:50PM): 96 checks/day`);
    console.log(`[${timestamp}] [AlertScheduler]    • Midnight Reset: 12:00 AM`);
    console.log(`[${timestamp}] [AlertScheduler]    • Sleep Time: 12:00 AM - 7:59 AM`);
    console.log(`[${timestamp}] [AlertScheduler] ═══════════════════════════════════════\n`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('[AlertScheduler] ⚠️ Scheduler is not running');
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AlertScheduler] 🛑 Stopping scheduler...`);
    
    this.jobs.forEach((job, index) => {
      job.stop();
      console.log(`[${timestamp}] [AlertScheduler] ✅ Job ${index + 1} stopped`);
    });
    
    this.jobs = [];
    this.isRunning = false;
    console.log(`[${timestamp}] [AlertScheduler] ✅ Scheduler stopped`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
      jobs: this.jobs.map((job, index) => ({
        id: index + 1,
        isRunning: job.isRunning ? '✅ Running' : '⏸️ Stopped'
      }))
    };
  }
}

module.exports = new AlertScheduler();