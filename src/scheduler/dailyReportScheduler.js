// src/scheduler/dailyReportScheduler.js
// ═══════════════════════════════════════════════════════════════════════════
// Daily Report Scheduler — 8:10 AM Dhaka Time
// ═══════════════════════════════════════════════════════════════════════════
// Sends daily usage reports to all users with daily_report_enabled=true.
// Cron: '10 8 * * *'  →  8:10 AM Asia/Dhaka, every day(5 min after daily consumption finishes)
// ═══════════════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const dailyReportService = require('../services/dailyReportService');

const TIMEZONE = 'Asia/Dhaka';
let scheduledTask = null;

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Job ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
async function runDailyReportJob() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DailyReportScheduler] 🔔 Triggered`);

  try {
    const result = await dailyReportService.sendAllDailyReports();
    console.log(`[${timestamp}] [DailyReportScheduler] ✅ Done:`, result);
    return result;
  } catch (error) {
    console.error(`[${timestamp}] [DailyReportScheduler] ❌ Error:`, error.message);
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Start ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function start() {
  if (scheduledTask) {
    console.log('[DailyReportScheduler] ⚠️ Already running');
    return scheduledTask;
  }

  console.log('[DailyReportScheduler] ⏰ Registering cron: 8:00 AM (Asia/Dhaka)');

  scheduledTask = cron.schedule(
    '10 8 * * *',     // ✅ 8:10 AM (5 min after daily consumption finishes)
    async () => {
      await runDailyReportJob();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  console.log('[DailyReportScheduler] ✅ Started (daily at 8:00 AM Dhaka)');
  return scheduledTask;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Stop ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[DailyReportScheduler] 🛑 Stopped');
  }
}

module.exports = {
  start,
  stop,
  runDailyReportJob,
};