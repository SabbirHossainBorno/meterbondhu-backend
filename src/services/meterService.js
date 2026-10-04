// src/services/meterService.js
// ═══════════════════════════════════════════════════════════════════════
// Meter Service - Balance & Consumption Sync (UPDATED)
// ═══════════════════════════════════════════════════════════════════════

const { pool } = require('../config/database');
const DescoService = require('./descoService');

class MeterService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Sync Single Meter Balance ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async syncMeterBalance(meterSerial) {
    const timestamp = new Date().toISOString();
    
    try {
      const meterResult = await pool.query(
        'SELECT * FROM meter_info WHERE serial = $1',
        [meterSerial]
      );

      if (meterResult.rows.length === 0) {
        console.log(`[${timestamp}] [MeterService] ❌ Meter ${meterSerial} not found`);
        return { success: false, message: 'Meter not found' };
      }

      const meter = meterResult.rows[0];
      console.log(`[${timestamp}] [MeterService] 🔄 Syncing meter ${meter.meter_id} (${meter.account_no}/${meter.meter_no})`);

      // ═══════════════════════════════════════════════════════════════════
      // ─── DESCO API: Balance (একই call এ month consumption পাব) ─────────
      // ═══════════════════════════════════════════════════════════════════
      let balance = null;
      let monthlyConsumption = null;

      try {
        const balanceResponse = await DescoService.getBalance(
          meter.account_no,
          meter.meter_no
        );

        // ✅ Balance
        if (balanceResponse && balanceResponse.success && balanceResponse.data) {
          balance = parseFloat(balanceResponse.data.balance) || 0;
          // ✅ Current month consumption (same response!)
          monthlyConsumption = parseFloat(balanceResponse.data.currentMonthConsumption) || 0;
        } else if (balanceResponse && balanceResponse.balance !== undefined) {
          balance = parseFloat(balanceResponse.balance) || 0;
          monthlyConsumption = parseFloat(balanceResponse.currentMonthConsumption) || 0;
        }

        console.log(`[${timestamp}] [MeterService] 💰 Balance: ৳${balance}`);
        console.log(`[${timestamp}] [MeterService] 📊 Month Consumption: ৳${monthlyConsumption} (from getBalance)`);
      } catch (error) {
        console.error(`[${timestamp}] [MeterService] ❌ Balance API failed:`, error.message);
      }

      // ═══════════════════════════════════════════════════════════════════
      // ─── Fallback: getMonthlyConsumption (যদি getBalance এ না পায়) ────
      // ═══════════════════════════════════════════════════════════════════
      if (monthlyConsumption === null || monthlyConsumption === 0) {
        try {
          const now = new Date();
          const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const monthTo = monthFrom;

          const monthlyResponse = await DescoService.getMonthlyConsumption(
            meter.account_no,
            meter.meter_no,
            monthFrom,
            monthTo
          );

          let monthlyData = [];
          if (monthlyResponse && monthlyResponse.success && monthlyResponse.data) {
            monthlyData = monthlyResponse.data;
          } else if (Array.isArray(monthlyResponse)) {
            monthlyData = monthlyResponse;
          }

          if (monthlyData.length > 0) {
            monthlyConsumption = parseFloat(monthlyData[0].consumedTaka) || 0;
          } else {
            monthlyConsumption = 0;
          }

          console.log(`[${timestamp}] [MeterService] 📊 Month Consumption: ৳${monthlyConsumption} (from getMonthlyConsumption)`);
        } catch (error) {
          console.error(`[${timestamp}] [MeterService] ❌ Monthly API failed:`, error.message);
          monthlyConsumption = 0;
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // ─── DB Update ────────────────────────────────────────────────────
      // ═══════════════════════════════════════════════════════════════════
      const updateResult = await pool.query(`
        UPDATE meter_info 
        SET 
          current_balance = COALESCE($1, current_balance),
          current_month_consumption = COALESCE($2, current_month_consumption),
          last_fetched_at = CURRENT_TIMESTAMP,
          sync_status = 'success',
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE serial = $3
        RETURNING *
      `, [balance, monthlyConsumption, meterSerial]);

      console.log(`[${timestamp}] [MeterService] ✅ Synced: balance=৳${balance}, month=৳${monthlyConsumption}`);

      return {
        success: true,
        meter: updateResult.rows[0],
        balance,
        monthlyConsumption,
      };

    } catch (error) {
      console.error(`[${timestamp}] [MeterService] ❌ Sync failed:`, error.message);

      try {
        await pool.query(`
          UPDATE meter_info 
          SET 
            sync_status = 'failed',
            error_message = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE serial = $2
        `, [error.message, meterSerial]);
      } catch (dbError) {
        console.error(`[${timestamp}] [MeterService] ❌ Failed to mark error:`, dbError.message);
      }

      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Sync All Active Meters ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async syncAllMeters() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterService] 🔄 Syncing all meters...`);

  try {
    // ✅ LEFT JOIN — tenant meter o include hobe
    const result = await pool.query(`
      SELECT DISTINCT
        m.serial, 
        m.meter_id, 
        m.account_no, 
        m.meter_no,
        COALESCE(u.full_name, t.tenant_name, 'Tenant') AS full_name
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

    const meters = result.rows;
    console.log(`[${timestamp}] [MeterService] 📊 Found ${meters.length} active meters (incl. tenants)`);

    let successCount = 0;
    let failCount = 0;

    for (const meter of meters) {
      try {
        const syncResult = await this.syncMeterBalance(meter.serial);
        if (syncResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
        console.error(`[${timestamp}] [MeterService] ❌ Error for ${meter.meter_id}:`, error.message);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[${timestamp}] [MeterService] ✅ Complete: ${successCount} success, ${failCount} failed`);

    return {
      success: true,
      total: meters.length,
      successCount,
      failCount,
    };

  } catch (error) {
    console.error(`[${timestamp}] [MeterService] ❌ Bulk sync failed:`, error.message);
    return { success: false, message: error.message };
  }
}

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get Meter by User Serial ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getMeterByUserSerial(userSerial) {
    const result = await pool.query(
      'SELECT * FROM meter_info WHERE user_serial = $1 LIMIT 1',
      [userSerial]
    );
    return result.rows[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get Meter by Account & Meter No ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getMeterByAccountAndMeterNo(accountNo, meterNo) {
    const result = await pool.query(
      'SELECT * FROM meter_info WHERE account_no = $1 AND meter_no = $2 LIMIT 1',
      [accountNo, meterNo]
    );
    return result.rows[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get Stale Meters (not synced in last 24h) ────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getStaleMeters() {
    const result = await pool.query(`
      SELECT m.serial, m.meter_id, m.account_no, m.meter_no, m.last_fetched_at
      FROM meter_info m
      INNER JOIN user_info u ON u.serial = m.user_serial
      WHERE u.is_active = true 
      AND u.is_deleted = false
      AND (
        m.last_fetched_at IS NULL 
        OR m.last_fetched_at < NOW() - INTERVAL '24 hours'
      )
    `);
    return result.rows;
  }
}

module.exports = new MeterService();