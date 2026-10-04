// src/models/Meter.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class Meter {
  // ─── Create Meter ─────────────────────────────────────────────────────────
  static async create(meterData) {
    const timestamp = new Date().toISOString();
    const {
      user_serial, account_no, meter_no, customer_name,
      contact_no, installation_address, feeder_name,
      installation_date, phase_type, sanction_load,
      tariff_solution, meter_model, transformer, sd_name,
      sync_status
    } = meterData;

    console.log(`\n[${timestamp}] [Meter.create] ═══════════════════════════════════════`);
    console.log(`[Meter.create] 📝 Creating meter`);
    console.log(`[Meter.create]    user_serial: ${user_serial || '(null — tenant meter)'}`);
    console.log(`[Meter.create]    account_no: ${account_no}`);
    console.log(`[Meter.create]    meter_no: ${meter_no}`);
    console.log(`[Meter.create]    customer_name: ${customer_name || '(null)'}`);
    console.log(`[Meter.create]    contact_no: ${contact_no || '(null)'}`);
    console.log(`[Meter.create]    installation_date (raw): ${installation_date}`);
    console.log(`[Meter.create]    phase_type: ${phase_type || '(null)'}`);

    const serialResult = await pool.query(
      "SELECT nextval('meter_info_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const meter_id = IDGenerator.generateMeterId(serial);

    console.log(`[Meter.create] 🔢 Generated serial: ${serial}, meter_id: ${meter_id}`);

    // ✅ Normalize installation_date — take only "YYYY-MM-DD" part
    // DESCO `tkdes` returns "2019-11-25 00:00:00" but DB column is DATE
    let normalizedInstallDate = null;
    if (installation_date) {
      const raw = String(installation_date).trim();
      normalizedInstallDate = raw.split(' ')[0];
      console.log(`[Meter.create] 📅 Installation date normalized: "${raw}" → "${normalizedInstallDate}"`);
    } else {
      console.log(`[Meter.create] 📅 Installation date: (null)`);
    }

    const query = `
      INSERT INTO meter_info (
        meter_id, user_serial, account_no, meter_no, 
        customer_name, contact_no, installation_address, 
        feeder_name, installation_date, phase_type, 
        sanction_load, tariff_solution, meter_model, 
        transformer, sd_name, sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      meter_id,
      user_serial || null,
      account_no,
      meter_no,
      customer_name || null,
      contact_no || null,
      installation_address || null,
      feeder_name || null,
      normalizedInstallDate,
      phase_type || null,
      sanction_load || null,
      tariff_solution || null,
      meter_model || null,
      transformer || null,
      sd_name || null,
      sync_status || 'pending'
    ];

    console.log(`[Meter.create] 💾 Inserting into meter_info...`);

    try {
      const result = await pool.query(query, values);
      console.log(`[Meter.create] ✅ Meter created — serial: ${result.rows[0].serial}, meter_id: ${result.rows[0].meter_id}`);
      console.log(`[Meter.create] ══════════════════════════════════════════════════════\n`);
      return result.rows[0];
    } catch (error) {
      console.error(`[Meter.create] ❌ Insert failed:`, error.message);
      console.error(`[Meter.create] ❌ Error code:`, error.code);
      console.error(`[Meter.create] ❌ Error detail:`, error.detail);
      console.error(`[Meter.create] ❌ Error constraint:`, error.constraint);
      console.error(`[Meter.create] ══════════════════════════════════════════════════════\n`);
      throw error;
    }
  }

  static async findByUserSerial(user_serial) {
    const query = 'SELECT * FROM meter_info WHERE user_serial = $1';
    const result = await pool.query(query, [user_serial]);
    return result.rows;
  }

  static async findByAccountNo(account_no) {
    const query = 'SELECT * FROM meter_info WHERE account_no = $1';
    const result = await pool.query(query, [account_no]);
    return result.rows;
  }

  static async updateBalance(meter_serial, balance, consumption, reading_time) {
    const query = `
      UPDATE meter_info 
      SET current_balance = $1, 
          current_month_consumption = $2, 
          reading_time = $3,
          last_fetched_at = CURRENT_TIMESTAMP,
          sync_status = 'success'
      WHERE serial = $4
      RETURNING *
    `;
    const result = await pool.query(query, [balance, consumption, reading_time, meter_serial]);
    return result.rows[0];
  }

  static async updateSyncStatus(meter_serial, status, error_message = null) {
    const query = `
      UPDATE meter_info 
      SET sync_status = $1, 
          error_message = $2,
          last_fetched_at = CURRENT_TIMESTAMP
      WHERE serial = $3
    `;
    await pool.query(query, [status, error_message, meter_serial]);
  }

  // ─── Find by meter_no ────────────────────────────────────────────────────
  static async findByMeterNo(meter_no) {
    const query = 'SELECT * FROM meter_info WHERE meter_no = $1';
    const result = await pool.query(query, [meter_no]);
    return result.rows[0];
  }

  // ─── Link tenant — update user_serial ────────────────────────────────────
  static async linkTenant(meter_no, user_serial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Meter.linkTenant] 🔗 Linking meter ${meter_no} → user_serial ${user_serial}`);

    const query = `
      UPDATE meter_info 
      SET user_serial = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE meter_no = $2 AND user_serial IS NULL
      RETURNING *
    `;
    const result = await pool.query(query, [user_serial, meter_no]);

    if (result.rows.length === 0) {
      console.log(`[${timestamp}] [Meter.linkTenant] ⚠️ Meter ${meter_no} not found or already linked`);
      return null;
    }

    console.log(`[${timestamp}] [Meter.linkTenant] ✅ Linked — new user_serial: ${result.rows[0].user_serial}`);
    return result.rows[0];
  }
}

module.exports = Meter;