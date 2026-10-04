// src/scheduler/monthlyConsumptionScheduler.js
// ═══════════════════════════════════════════════════════════════════════════
// Monthly Consumption Scheduler
// ═══════════════════════════════════════════════════════════════════════════
//
// Runs on the 1st of every month at 8:05 AM (Asia/Dhaka)
// Reason: DESCO publishes previous month's total at month end,
//         so 1st of new month at 8:05 AM we can fetch the complete total.
//
// Cron: '5 8 1 * *'
//          │ │ │ │ │
//          │ │ │ │ └── day of week (any)
//          │ │ │ └──── month (any)
//          │ │ └────── day of month (1st)
//          │ └──────── hour (8 AM)
//          └────────── minute (5)
// ═══════════════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { pool } = require('../config/database');
const monthlyConsumptionService = require('../services/monthlyConsumptionService');

const SCHEDULE = '5 8 1 * *'; // 1st of every month at 8:05 AM
const TIMEZONE = 'Asia/Dhaka';

let scheduledTask = null;

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Job ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
async function runMonthlySync() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MonthlyScheduler] 🔔 Triggered (1st of month)`);

  try {
    // Get all active meters
    const metersResult = await pool.query(`
  SELECT DISTINCT
    m.meter_no,
    m.account_no,
    COALESCE(u.full_name, t.tenant_name, 'Tenant') AS full_name,
    COALESCE(u.m_bondhu_id, o.m_bondhu_id) AS m_bondhu_id
  FROM meter_info m
  LEFT JOIN user_info u ON u.serial = m.user_serial
  LEFT JOIN tenant_info t ON t.meter_no = m.meter_no
  LEFT JOIN user_info o ON o.serial = t.owner_serial
  WHERE m.meter_no IS NOT NULL
    AND m.account_no IS NOT NULL
    AND (
      (u.is_active = true AND u.is_deleted = false)
      OR t.serial IS NOT NULL
    )
`);

    const meters = metersResult.rows;
    console.log(`[MonthlyScheduler] 👥 Processing ${meters.length} meters`);

    let successCount = 0;
    let failCount = 0;

    for (const meter of meters) {
      try {
        // Sync last 3 months to be safe (covers edge cases)
        const result = await monthlyConsumptionService.syncRecentMonths(
          meter.meter_no,
          meter.account_no,
          3 // last 3 months
        );

        if (result.success) {
          successCount++;
          console.log(
            `[MonthlyScheduler] ✅ ${meter.meter_no} (${meter.full_name}): ${result.saved} records`
          );
        } else {
          failCount++;
          console.log(
            `[MonthlyScheduler] ❌ ${meter.meter_no}: ${result.message}`
          );
        }
      } catch (error) {
        failCount++;
        console.error(
          `[MonthlyScheduler] ❌ ${meter.meter_no}:`,
          error.message
        );
      }

      // Rate limit protection between DESCO calls
      await new Promise((r) => setTimeout(r, 800));
    }

    console.log(
      `[${timestamp}] [MonthlyScheduler] ⏰ Complete: ${successCount} success, ${failCount} failed`
    );

    return {
      success: true,
      total: meters.length,
      successCount,
      failCount,
    };
  } catch (error) {
    console.error(
      `[${timestamp}] [MonthlyScheduler] ❌ Error:`,
      error.message
    );
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Start Scheduler ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function start() {
  if (scheduledTask) {
    console.log('[MonthlyScheduler] ⚠️ Already running');
    return scheduledTask;
  }

  console.log(`[MonthlyScheduler] ⏰ Registering cron: ${SCHEDULE} (${TIMEZONE})`);

  scheduledTask = cron.schedule(
    SCHEDULE,
    async () => {
      await runMonthlySync();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  console.log(
    '[MonthlyScheduler] ✅ Started (1st of month at 8:05 AM Dhaka time)'
  );
  return scheduledTask;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Stop Scheduler ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[MonthlyScheduler] 🛑 Stopped');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Exports ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
  start,
  stop,
  runMonthlySync, // expose for manual trigger
};