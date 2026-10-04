// src/tests/force-sync.js
// ═══════════════════════════════════════════════════════════════════════
// FORCE SYNC ALL METERS - Manual Trigger
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../config/database');
const meterService = require('../services/meterService');

async function forceSync() {
  console.log('\n' + '█'.repeat(75));
  console.log('  🚀 FORCE SYNC ALL METERS');
  console.log('█'.repeat(75));

  try {
    // ─── Before State ──────────────────────────────────────────────
    console.log('\n📊 BEFORE SYNC:');
    console.log('─'.repeat(75));
    
    const beforeResult = await pool.query(`
      SELECT 
        serial, meter_id, user_serial, account_no, meter_no,
        current_balance, current_month_consumption,
        last_fetched_at, sync_status
      FROM meter_info 
      ORDER BY serial
    `);

    beforeResult.rows.forEach(m => {
      console.log(`\n  Meter: ${m.meter_id} (user_serial: ${m.user_serial})`);
      console.log(`    Account: ${m.account_no} / Meter: ${m.meter_no}`);
      console.log(`    💰 Balance: ৳${m.current_balance}`);
      console.log(`    📊 Month Consumption: ৳${m.current_month_consumption}`);
      console.log(`    🕐 Last Fetched: ${m.last_fetched_at || 'NEVER'}`);
      console.log(`    ⚙️  Sync Status: ${m.sync_status}`);
    });

    // ─── Run Sync ──────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(75));
    console.log('  🔄 SYNCING...');
    console.log('═'.repeat(75));

    const result = await meterService.syncAllMeters();

    // ─── After State ───────────────────────────────────────────────
    console.log('\n📊 AFTER SYNC:');
    console.log('─'.repeat(75));
    
    const afterResult = await pool.query(`
      SELECT 
        serial, meter_id, user_serial, account_no, meter_no,
        current_balance, current_month_consumption,
        last_fetched_at, sync_status, error_message
      FROM meter_info 
      ORDER BY serial
    `);

    afterResult.rows.forEach(m => {
      console.log(`\n  Meter: ${m.meter_id} (user_serial: ${m.user_serial})`);
      console.log(`    Account: ${m.account_no} / Meter: ${m.meter_no}`);
      console.log(`    💰 Balance: ৳${m.current_balance}`);
      console.log(`    📊 Month Consumption: ৳${m.current_month_consumption}`);
      console.log(`    🕐 Last Fetched: ${m.last_fetched_at || 'NEVER'}`);
      console.log(`    ⚙️  Sync Status: ${m.sync_status}`);
      if (m.error_message) {
        console.log(`    ❌ Error: ${m.error_message}`);
      }
    });

    // ─── Summary ───────────────────────────────────────────────────
    console.log('\n' + '█'.repeat(75));
    console.log('  📊 SYNC SUMMARY');
    console.log('█'.repeat(75));
    console.log(`\n  ✅ Success: ${result.successCount}/${result.total}`);
    console.log(`  ❌ Failed:  ${result.failCount}/${result.total}`);
    console.log('\n' + '█'.repeat(75) + '\n');

    process.exit(result.failCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Force sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

forceSync();