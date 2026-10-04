// src/services/tenantService.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class TenantService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Add Tenant (during owner signup) ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async addTenant(ownerSerial, tenantData) {
    const timestamp = new Date().toISOString();
    const { flat, name, account_no, meter_no, desco_data } = tenantData;

    console.log(`\n[${timestamp}] [TenantService.addTenant] ═══════════════════════════`);
    console.log(`[TenantService.addTenant] ➕ Adding tenant`);
    console.log(`[TenantService.addTenant]    owner_serial: ${ownerSerial}`);
    console.log(`[TenantService.addTenant]    flat: ${flat}`);
    console.log(`[TenantService.addTenant]    name: ${name || '(null)'}`);
    console.log(`[TenantService.addTenant]    account_no: ${account_no}`);
    console.log(`[TenantService.addTenant]    meter_no: ${meter_no}`);

    try {
      // ─── 1. Insert into tenant_info ─────────────────────────────────
      console.log(`[TenantService.addTenant] 💾 Step 1: Inserting into tenant_info...`);

      const tenantInfoQuery = `
        INSERT INTO tenant_info (
          owner_serial, tenant_name, flat_floor, account_no, meter_no
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const tenantResult = await pool.query(tenantInfoQuery, [
        ownerSerial,
        name || null,
        flat,
        account_no,
        meter_no,
      ]);

      console.log(`[TenantService.addTenant] ✅ tenant_info row created — serial: ${tenantResult.rows[0].serial}`);

      // ─── 2. Check if meter already exists ───────────────────────────
      console.log(`[TenantService.addTenant] 🔍 Step 2: Checking if meter ${meter_no} already exists...`);

      const existingMeter = await pool.query(
        'SELECT serial, user_serial FROM meter_info WHERE meter_no = $1',
        [meter_no]
      );

      let meterRow = null;

      if (existingMeter.rows.length === 0) {
        // ─── Insert new meter with user_serial = NULL ────────────────
        console.log(`[TenantService.addTenant] 📝 Meter doesn't exist — inserting new meter`);

        const serialResult = await pool.query(
          "SELECT nextval('meter_info_serial_seq') AS serial"
        );
        const serial = serialResult.rows[0].serial;
        const meter_id = IDGenerator.generateMeterId(serial);

        console.log(`[TenantService.addTenant] 🔢 Generated meter_id: ${meter_id}`);

        // ✅ Normalize installation date
        let normalizedInstallDate = null;
        if (desco_data?.installationDate) {
          const raw = String(desco_data.installationDate).trim();
          normalizedInstallDate = raw.split(' ')[0];
          console.log(`[TenantService.addTenant] 📅 Installation date: "${raw}" → "${normalizedInstallDate}"`);
        }

        const insertMeterQuery = `
          INSERT INTO meter_info (
            meter_id, user_serial, account_no, meter_no,
            customer_name, contact_no, installation_address,
            feeder_name, installation_date, phase_type,
            sanction_load, tariff_solution, meter_model,
            transformer, sd_name, sync_status
          ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
          RETURNING *
        `;
        const meterResult = await pool.query(insertMeterQuery, [
          meter_id,
          account_no,
          meter_no,
          desco_data?.customerName || null,
          desco_data?.contactNo || null,
          desco_data?.installationAddress || null,
          desco_data?.feederName || null,
          normalizedInstallDate,
          desco_data?.phaseType || null,
          desco_data?.sanctionLoad || null,
          desco_data?.tariffSolution || null,
          desco_data?.meterModel || null,
          desco_data?.transformer || null,
          desco_data?.SDName || null,
        ]);
        meterRow = meterResult.rows[0];

        console.log(`[TenantService.addTenant] ✅ Meter inserted — serial: ${meterRow.serial}, user_serial: NULL`);
      } else {
        // Meter already exists
        meterRow = existingMeter.rows[0];
        console.log(`[TenantService.addTenant] ℹ️ Meter already exists — serial: ${meterRow.serial}, user_serial: ${meterRow.user_serial}`);
      }

      console.log(`[TenantService.addTenant] ✅ Tenant added successfully`);
      console.log(`[TenantService.addTenant] ══════════════════════════════════════════════\n`);

      return {
        success: true,
        tenantInfo: tenantResult.rows[0],
        meter: meterRow,
      };
    } catch (error) {
      console.error(`[TenantService.addTenant] ❌ Failed:`, error.message);
      console.error(`[TenantService.addTenant] ❌ Error code:`, error.code);
      console.error(`[TenantService.addTenant] ❌ Error detail:`, error.detail);
      console.error(`[TenantService.addTenant] ══════════════════════════════════════════════\n`);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get Tenant List (for owner) ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getTenantList(ownerSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TenantService.getTenantList] 📋 Fetching tenants for owner ${ownerSerial}`);

    try {
      const query = `
        SELECT 
          t.serial AS tenant_info_serial,
          t.owner_serial,
          t.tenant_name,
          t.flat_floor,
          t.account_no,
          t.meter_no,
          t.created_at,
          m.serial AS meter_serial,
          m.meter_id,
          m.customer_name,
          m.current_balance,
          m.current_month_consumption,
          m.sync_status,
          m.user_serial AS tenant_serial
        FROM tenant_info t
        LEFT JOIN meter_info m ON m.meter_no = t.meter_no
        WHERE t.owner_serial = $1
        ORDER BY t.created_at ASC
      `;
      const result = await pool.query(query, [ownerSerial]);

      console.log(`[${timestamp}] [TenantService.getTenantList] ✅ Found ${result.rows.length} tenants`);

      return { success: true, tenants: result.rows };
    } catch (error) {
      console.error(`[${timestamp}] [TenantService.getTenantList] ❌ Error:`, error.message);
      return { success: false, message: error.message, tenants: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Link Tenant when they signup themselves ───────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async linkTenantToMeter(tenantSerial, meter_no) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TenantService.linkTenantToMeter] 🔗 Linking tenant ${tenantSerial} → meter ${meter_no}`);

    try {
      const result = await pool.query(
        `UPDATE meter_info 
         SET user_serial = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE meter_no = $2 AND user_serial IS NULL
         RETURNING *`,
        [tenantSerial, meter_no]
      );

      if (result.rows.length > 0) {
        console.log(`[${timestamp}] [TenantService.linkTenantToMeter] ✅ Linked successfully`);
        return { success: true, meter: result.rows[0], linked: true };
      } else {
        console.log(`[${timestamp}] [TenantService.linkTenantToMeter] ℹ️ Meter ${meter_no} already linked or not found`);
        return { success: true, linked: false };
      }
    } catch (error) {
      console.error(`[${timestamp}] [TenantService.linkTenantToMeter] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Remove Tenant ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async removeTenant(ownerSerial, tenantInfoSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TenantService.removeTenant] 🗑️ Removing tenant ${tenantInfoSerial} for owner ${ownerSerial}`);

    try {
      const check = await pool.query(
        'SELECT meter_no FROM tenant_info WHERE serial = $1 AND owner_serial = $2',
        [tenantInfoSerial, ownerSerial]
      );

      if (check.rows.length === 0) {
        console.log(`[${timestamp}] [TenantService.removeTenant] ⚠️ Tenant not found`);
        return { success: false, message: 'Tenant not found' };
      }

      const meterNo = check.rows[0].meter_no;

      await pool.query(
        'DELETE FROM tenant_info WHERE serial = $1 AND owner_serial = $2',
        [tenantInfoSerial, ownerSerial]
      );
      console.log(`[${timestamp}] [TenantService.removeTenant] ✅ tenant_info row deleted`);

      // Only delete meter_info if user_serial is NULL (tenant didn't register yet)
      const meterCheck = await pool.query(
        'SELECT user_serial FROM meter_info WHERE meter_no = $1',
        [meterNo]
      );

      if (meterCheck.rows[0]?.user_serial === null) {
        await pool.query('DELETE FROM meter_info WHERE meter_no = $1', [meterNo]);
        console.log(`[${timestamp}] [TenantService.removeTenant] 🗑️ Deleted unlinked meter ${meterNo}`);
      } else {
        console.log(`[${timestamp}] [TenantService.removeTenant] ℹ️ Meter ${meterNo} is linked to a tenant — not deleted`);
      }

      return { success: true, message: 'Tenant removed' };
    } catch (error) {
      console.error(`[${timestamp}] [TenantService.removeTenant] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new TenantService();