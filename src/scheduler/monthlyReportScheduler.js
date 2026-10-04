// src/scheduler/monthlyReportScheduler.js
// ═══════════════════════════════════════════════════════════════════════════
// Monthly Report Scheduler — 1st of month, 8:10 AM Dhaka Time
// ═══════════════════════════════════════════════════════════════════════════
//
// Sends monthly usage reports to all users with monthly_report_enabled=true.
//
// Cron: '10 8 1 * *'
//        │ │ │ │ │
//        │ │ │ │ └── day of week (any)
//        │ │ │ └──── month (any)
//        │ │ └────── day of month (1st)
//        │ └──────── hour (8 AM)
//        └────────── minute (5)
//
// Why 1st of month?
//   - DESCO publishes previous month's total at month end
//   - 1st of new month at 8:10 AM we can fetch the complete total
//   - Report runs on the JUST-ENDED month (e.g., Oct 1 → reports Sept)
// ═══════════════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const monthlyReportService = require('../services/monthlyReportService');

const SCHEDULE = '10 8 1 * *';   // 1st of month at 8:10 AM
const TIMEZONE = 'Asia/Dhaka';

let scheduledTask = null;

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Job ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
async function runMonthlyReportJob() {
  const timestamp = new Date().toISOString();
  console.log(`\n${'▓'.repeat(75)}`);
  console.log(`[${timestamp}] [MonthlyReportScheduler] 🔔 Triggered (1st of month)`);
  console.log(`${'▓'.repeat(75)}`);

  try {
    const result = await monthlyReportService.sendAllMonthlyReports();
    console.log(`\n[${timestamp}] [MonthlyReportScheduler] ✅ Done:`, result);
    return result;
  } catch (error) {
    console.error(`[${timestamp}] [MonthlyReportScheduler] ❌ Error:`, error.message);
    return { success: false, message: error.message };
  } finally {
    console.log(`${'▓'.repeat(75)}\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Start ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function start() {
  if (scheduledTask) {
    console.log('[MonthlyReportScheduler] ⚠️ Already running');
    return scheduledTask;
  }

  console.log(`[MonthlyReportScheduler] ⏰ Registering cron: ${SCHEDULE} (${TIMEZONE})`);

  scheduledTask = cron.schedule(
    SCHEDULE,
    async () => {
      await runMonthlyReportJob();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  console.log('[MonthlyReportScheduler] ✅ Started (1st of month at 8:05 AM Dhaka)');
  return scheduledTask;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Stop ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[MonthlyReportScheduler] 🛑 Stopped');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Exports ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
  start,
  stop,
  runMonthlyReportJob,   // expose for manual trigger
};