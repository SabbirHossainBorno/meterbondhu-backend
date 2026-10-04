// src/scheduler/dailyConsumptionScheduler.js
// ═══════════════════════════════════════════════════════════════════════════
// Daily Consumption Scheduler
// ═══════════════════════════════════════════════════════════════════════════
//
// DESCO updates:
//   • Normal meters → 8:00 AM Dhaka time
//   • Tenant meters (tkdes) → 8:00 PM Dhaka time
//
// Our jobs:
//   • 8:05 AM → Morning sync (fetches yesterday + today for all meters)
//   • 8:05 PM → Evening sync (catches tenant meters updated at 8 PM)
//
// Both jobs run for ALL meters (normal + tenant).
// Duplicate-safe because syncYesterdayAndToday uses UPSERT.
// ═══════════════════════════════════════════════════════════════════════════

const cron = require('node-cron');
const { pool } = require('../config/database');
const dailyConsumptionService = require('../services/dailyConsumptionService');

const TIMEZONE = 'Asia/Dhaka';

// ✅ Store both jobs in an array
let scheduledTasks = [];

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Job ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
async function runDailySync() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DailyScheduler] 🔔 Cron triggered`);

  try {
    // ✅ Get all unique meters (normal users + tenant meters)
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
    console.log(`[DailyScheduler] 👥 Processing ${meters.length} meters (incl. tenants)`);

    let successCount = 0;
    let failCount = 0;

    for (const meter of meters) {
      try {
        const result = await dailyConsumptionService.syncYesterdayAndToday(
          meter.meter_no,
          meter.account_no
        );

        if (result.success) {
          successCount++;
          console.log(
            `[DailyScheduler] ✅ ${meter.meter_no} (${meter.full_name}): ${result.saved} records`
          );
        } else {
          failCount++;
          console.log(
            `[DailyScheduler] ❌ ${meter.meter_no}: ${result.message}`
          );
        }

        // Rate limit protection — 800ms between DESCO calls
        await new Promise((r) => setTimeout(r, 800));
      } catch (error) {
        failCount++;
        console.error(
          `[DailyScheduler] ❌ ${meter.meter_no}:`,
          error.message
        );
      }
    }

    console.log(`[${timestamp}] [DailyScheduler] ⏰ Job complete: ${successCount} success, ${failCount} failed`);

    return {
      success: true,
      total: meters.length,
      successCount,
      failCount,
    };
  } catch (error) {
    console.error(`[${timestamp}] [DailyScheduler] ❌ Job error:`, error.message);
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Start Scheduler ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function start() {
  if (scheduledTasks.length > 0) {
    console.log('[DailyScheduler] ⚠️ Already running');
    return scheduledTasks;
  }

  console.log(`[DailyScheduler] ⏰ Registering crons (${TIMEZONE})`);

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ Job 1: 8:05 AM — Morning sync
  // ═══════════════════════════════════════════════════════════════════════
  // Normal meters updated at 8:00 AM by DESCO
  // ═══════════════════════════════════════════════════════════════════════
  const morningTask = cron.schedule(
    '5 8 * * *',      // 8:05 AM every day
    async () => {
      console.log(`[DailyScheduler] 🌅 Morning sync starting (8:05 AM)...`);
      await runDailySync();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );
  scheduledTasks.push(morningTask);
  console.log('[DailyScheduler] ✅ Morning job scheduled (8:05 AM Dhaka)');

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ Job 2: 8:05 PM — Evening sync (for tenant meters)
  // ═══════════════════════════════════════════════════════════════════════
  // Tenant meters (tkdes system-B) updated at 8:00 PM by DESCO
  // ═══════════════════════════════════════════════════════════════════════
  const eveningTask = cron.schedule(
    '5 20 * * *',     // 8:05 PM every day (20:05)
    async () => {
      console.log(`[DailyScheduler] 🌆 Evening sync starting (8:05 PM, after DESCO 8 PM update)...`);
      await runDailySync();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );
  scheduledTasks.push(eveningTask);
  console.log('[DailyScheduler] ✅ Evening job scheduled (8:05 PM Dhaka)');

  console.log('[DailyScheduler] ✅ Scheduler started with 2 jobs');

  return scheduledTasks;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Stop Scheduler ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function stop() {
  if (scheduledTasks.length === 0) {
    console.log('[DailyScheduler] ⚠️ Not running');
    return;
  }

  scheduledTasks.forEach((task, i) => {
    task.stop();
    console.log(`[DailyScheduler] ✅ Job ${i + 1} stopped`);
  });

  scheduledTasks = [];
  console.log('[DailyScheduler] 🛑 Stopped');
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Exports ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
  start,
  stop,
  runDailySync,  // expose for manual trigger
};