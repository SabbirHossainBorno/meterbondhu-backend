// src/services/meterManagementService.js
const { pool } = require('../config/database');
const DescoService = require('./descoService');
const Meter = require('../models/Meter');

class MeterManagementService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── UNBIND METER (Remove) ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async unbindMeter(userSerial, meterId, reason = 'user_removed') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterMgmt] 🔓 Unbinding meter ${meterId} for user ${userSerial}`);

    try {
      // ─── 1. Get meter info ────────────────────────────────────────
      const meterQuery = `
        SELECT m.*, u.user_type, u.full_name as user_name
        FROM meter_info m
        INNER JOIN user_info u ON u.serial = m.user_serial
        WHERE m.meter_id = $1 AND m.user_serial = $2
      `;
      const meterResult = await pool.query(meterQuery, [meterId, userSerial]);

      if (meterResult.rows.length === 0) {
        return { success: false, message: 'Meter not found' };
      }

      const meter = meterResult.rows[0];

      // ─── 2. Generate unbind_id ────────────────────────────────────
      const seqResult = await pool.query(
        "SELECT nextval('unbind_meter_info_serial_seq') AS serial"
      );
      const seq = seqResult.rows[0].serial;
      const unbindId = `UNB${String(seq).padStart(8, '0')}`;

      // ─── 3. Insert into unbind_meter_info ─────────────────────────
      const insertQuery = `
        INSERT INTO unbind_meter_info (
          unbind_id, meter_id, user_serial, account_no, meter_no,
          customer_name, contact_no, installation_address,
          feeder_name, installation_date, phase_type, sanction_load,
          tariff_solution, meter_model, transformer, sd_name, meter_type,
          balance_at_unbind, month_consumption_at_unbind,
          user_type, unbind_reason, can_readd
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) RETURNING *
      `;

      const insertValues = [
        unbindId,
        meter.meter_id,
        meter.user_serial,
        meter.account_no,
        meter.meter_no,
        meter.customer_name,
        meter.contact_no,
        meter.installation_address,
        meter.feeder_name,
        meter.installation_date,
        meter.phase_type,
        meter.sanction_load,
        meter.tariff_solution,
        meter.meter_model,
        meter.transformer,
        meter.sd_name,
        meter.meter_type || 'desco',
        meter.current_balance || 0,
        meter.current_month_consumption || 0,
        meter.user_type,
        reason,
        true, // can_readd
      ];

      const insertResult = await pool.query(insertQuery, insertValues);
      const unbindRecord = insertResult.rows[0];

      // ─── 4. Delete from meter_info ────────────────────────────────
      await pool.query(
        'DELETE FROM meter_info WHERE meter_id = $1 AND user_serial = $2',
        [meterId, userSerial]
      );

      console.log(`[${timestamp}] [MeterMgmt] ✅ Meter unbound: ${unbindId}`);

      return {
        success: true,
        message: 'Meter removed successfully',
        unbindRecord,
      };
    } catch (error) {
      console.error(`[${timestamp}] [MeterMgmt] ❌ Unbind failed:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── RE-ADD UNBIND METER ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async readdMeter(userSerial, unbindId) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterMgmt] 🔒 Re-adding meter ${unbindId} for user ${userSerial}`);

    try {
      // ─── 1. Get unbind record ─────────────────────────────────────
      const unbindQuery = `
        SELECT * FROM unbind_meter_info
        WHERE unbind_id = $1 AND user_serial = $2 AND can_readd = true
      `;
      const unbindResult = await pool.query(unbindQuery, [unbindId, userSerial]);

      if (unbindResult.rows.length === 0) {
        return { success: false, message: 'Unbind meter not found' };
      }

      const unbindMeter = unbindResult.rows[0];

      // ─── 2. Check if user already has an active meter (tenant) ────
      const activeMeters = await pool.query(
        'SELECT * FROM meter_info WHERE user_serial = $1',
        [userSerial]
      );

      // ─── 3. If tenant has active meter, unbind it first ───────────
      if (activeMeters.rows.length > 0) {
        for (const activeMeter of activeMeters.rows) {
          await this.unbindMeter(
            userSerial,
            activeMeter.meter_id,
            'replaced_by_readd'
          );
        }
      }

      // ─── 4. Create new meter_info entry ───────────────────────────
      const newMeterId = `MET${String(Date.now()).slice(-6)}MBONDHU`;

      const insertQuery = `
        INSERT INTO meter_info (
          meter_id, user_serial, account_no, meter_no,
          customer_name, contact_no, installation_address,
          feeder_name, installation_date, phase_type, sanction_load,
          tariff_solution, meter_model, transformer, sd_name,
          current_balance, current_month_consumption,
          sync_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING *
      `;

      const insertValues = [
        newMeterId,
        userSerial,
        unbindMeter.account_no,
        unbindMeter.meter_no,
        unbindMeter.customer_name,
        unbindMeter.contact_no,
        unbindMeter.installation_address,
        unbindMeter.feeder_name,
        unbindMeter.installation_date,
        unbindMeter.phase_type,
        unbindMeter.sanction_load,
        unbindMeter.tariff_solution,
        unbindMeter.meter_model,
        unbindMeter.transformer,
        unbindMeter.sd_name,
        unbindMeter.balance_at_unbind || 0,
        unbindMeter.month_consumption_at_unbind || 0,
        'pending',
      ];

      const insertResult = await pool.query(insertQuery, insertValues);
      const newMeter = insertResult.rows[0];

      // ─── 5. Mark unbind record as not re-addable ──────────────────
      await pool.query(
        'UPDATE unbind_meter_info SET can_readd = false, updated_at = CURRENT_TIMESTAMP WHERE unbind_id = $1',
        [unbindId]
      );

      console.log(`[${timestamp}] [MeterMgmt] ✅ Meter re-added: ${newMeterId}`);

      return {
        success: true,
        message: 'Meter re-added successfully',
        meter: newMeter,
      };
    } catch (error) {
      console.error(`[${timestamp}] [MeterMgmt] ❌ Re-add failed:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── GET UNBIND METERS ─────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getUnbindMeters(userSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterMgmt] 📋 Getting unbind meters for ${userSerial}`);

    try {
      const query = `
        SELECT * FROM unbind_meter_info
        WHERE user_serial = $1
        ORDER BY unbind_date DESC
      `;
      const result = await pool.query(query, [userSerial]);

      return {
        success: true,
        unbindMeters: result.rows,
      };
    } catch (error) {
      console.error(`[${timestamp}] [MeterMgmt] ❌ Error:`, error.message);
      return { success: false, message: error.message, unbindMeters: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
// ─── GET OWNER METERS (with tenant details) ────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
async getOwnerMeters(ownerSerial) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt] 👑 Getting owner meters for ${ownerSerial}`);

  try {
    // ─── 1. Get owner's primary meter ─────────────────────────────
    const ownerQuery = `
      SELECT m.*, u.full_name as user_name, u.user_type, u.low_balance_alert_threshold
      FROM meter_info m
      INNER JOIN user_info u ON u.serial = m.user_serial
      WHERE m.user_serial = $1
    `;
    const ownerResult = await pool.query(ownerQuery, [ownerSerial]);

    // ─── 2. Get tenant meters from tenant_info table ──────────────
    // ✅ FIX: query tenant_info (owner_serial) instead of meter_info
    const tenantQuery = `
      SELECT 
        t.serial,
        t.tenant_name,
        t.flat_floor,
        t.account_no,
        t.meter_no,
        t.created_at AS tenant_added_at,
        -- Optional: join meter_info if tenant's meter is registered
        m.meter_id,
        m.customer_name,
        m.current_balance,
        m.current_month_consumption,
        m.last_fetched_at,
        m.sync_status,
        m.phase_type,
        m.sanction_load,
        m.tariff_solution
      FROM tenant_info t
      LEFT JOIN meter_info m 
        ON m.account_no = t.account_no 
        AND m.meter_no = t.meter_no
      WHERE t.owner_serial = $1
      ORDER BY t.created_at DESC
    `;
    const tenantResult = await pool.query(tenantQuery, [ownerSerial]);
    const tenantMeters = tenantResult.rows;

    console.log(`[${timestamp}] [MeterMgmt] 📊 Owner: ${ownerResult.rows.length} primary, ${tenantMeters.length} tenants`);

    return {
      success: true,
      primaryMeter: ownerResult.rows[0] || null,
      tenantMeters,
    };
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt] ❌ Error:`, error.message);
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── ADD TENANT (Owner only) ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
async addTenant(ownerSerial, { tenant_name, flat_floor, account_no, meter_no }) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt] ➕ Adding tenant for owner ${ownerSerial}`);

  try {
    // ─── Validation ────────────────────────────────────────────────
    if (!flat_floor || !account_no || !meter_no) {
      return { success: false, message: 'flat_floor, account_no, meter_no required' };
    }

    // ─── Verify owner ──────────────────────────────────────────────
    const ownerCheck = await pool.query(
  `SELECT serial, user_type, m_bondhu_id FROM user_info 
   WHERE serial = $1 AND user_type = 'owner' 
   AND is_active = true AND is_deleted = false`,
  [ownerSerial]
);

    if (ownerCheck.rows.length === 0) {
      return { success: false, message: 'Only owners can add tenants' };
    }

    // ─── Check duplicate (same owner + account_no + meter_no) ──────
    const dupCheck = await pool.query(
      `SELECT serial FROM tenant_info 
       WHERE owner_serial = $1 AND account_no = $2 AND meter_no = $3`,
      [ownerSerial, account_no, meter_no]
    );

    if (dupCheck.rows.length > 0) {
      return { success: false, message: 'This tenant meter already exists' };
    }

    // ─── Insert tenant ─────────────────────────────────────────────
    const insertResult = await pool.query(
      `INSERT INTO tenant_info (owner_serial, tenant_name, flat_floor, account_no, meter_no)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ownerSerial, tenant_name.trim(), flat_floor || null, account_no.trim(), meter_no.trim()]
    );

        const newTenant = insertResult.rows[0];
    console.log(`[${timestamp}] [MeterMgmt] ✅ Tenant added: ${newTenant.serial}`);

    // ✅ NEW: Insert notification
    try {
      const Notification = require('../models/Notification');
      const notification = await Notification.create({
        m_bondhu_id: ownerCheck.rows[0].m_bondhu_id,
        notification_type: 'tenant',
        title: '👥 New Tenant Added',
        message: `${newTenant.tenant_name || 'Tenant'}${newTenant.flat_floor ? ' (' + newTenant.flat_floor + ')' : ''} has been added to your tenant list.`,
        data: {
          tenant_serial: newTenant.serial,
          tenant_name: newTenant.tenant_name,
          flat_floor: newTenant.flat_floor,
          account_no: newTenant.account_no,
          meter_no: newTenant.meter_no,
          action: 'add',
          timestamp: new Date().toISOString(),
        },
      });
      if (notification) {
        await Notification.markAsSent(notification.notification_id);
        console.log(`[${timestamp}] [MeterMgmt] ✅ Notification created for tenant add`);
      }
    } catch (notifError) {
      console.error(`[${timestamp}] [MeterMgmt] ⚠️ Notification failed:`, notifError.message);
    }

    return {
      success: true,
      message: 'Tenant added successfully',
      tenant: newTenant,
    };
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt] ❌ Add tenant failed:`, error.message);
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── UPDATE TENANT (Owner only) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
async updateTenant(ownerSerial, tenantSerial, { tenant_name, flat_floor, account_no, meter_no }) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt] ✏️ Updating tenant ${tenantSerial} by owner ${ownerSerial}`);

  try {
    // ─── Verify tenant belongs to owner ────────────────────────────
    const verifyQuery = `
      SELECT * FROM tenant_info 
      WHERE serial = $1 AND owner_serial = $2
    `;
    const verifyResult = await pool.query(verifyQuery, [tenantSerial, ownerSerial]);

    if (verifyResult.rows.length === 0) {
      return { success: false, message: 'Tenant not found or not yours' };
    }

    // ✅ NEW: Required field check
if (!flat_floor || !account_no || !meter_no) {
  return { success: false, message: 'flat_floor, account_no, meter_no required' };
}

    // ─── Update ────────────────────────────────────────────────────
    const updateQuery = `
      UPDATE tenant_info
      SET tenant_name = COALESCE($1, tenant_name),
          flat_floor = COALESCE($2, flat_floor),
          account_no = COALESCE($3, account_no),
          meter_no = COALESCE($4, meter_no),
          updated_at = CURRENT_TIMESTAMP
      WHERE serial = $5 AND owner_serial = $6
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      tenant_name?.trim() || null,
      flat_floor?.trim() || null,
      account_no?.trim() || null,
      meter_no?.trim() || null,
      tenantSerial,
      ownerSerial,
    ]);

        const updatedTenant = result.rows[0];
    console.log(`[${timestamp}] [MeterMgmt] ✅ Tenant updated: ${tenantSerial}`);

    // ✅ NEW: Insert notification
    try {
      const Notification = require('../models/Notification');
      // Get owner's m_bondhu_id
      const ownerInfo = await pool.query(
        'SELECT m_bondhu_id FROM user_info WHERE serial = $1',
        [ownerSerial]
      );
      if (ownerInfo.rows[0]) {
        const notification = await Notification.create({
          m_bondhu_id: ownerInfo.rows[0].m_bondhu_id,
          notification_type: 'tenant',
          title: '✏️ Tenant Updated',
          message: `${updatedTenant.tenant_name || 'Tenant'}${updatedTenant.flat_floor ? ' (' + updatedTenant.flat_floor + ')' : ''} information has been updated.`,
          data: {
            tenant_serial: updatedTenant.serial,
            tenant_name: updatedTenant.tenant_name,
            flat_floor: updatedTenant.flat_floor,
            account_no: updatedTenant.account_no,
            meter_no: updatedTenant.meter_no,
            action: 'update',
            timestamp: new Date().toISOString(),
          },
        });
        if (notification) {
          await Notification.markAsSent(notification.notification_id);
          console.log(`[${timestamp}] [MeterMgmt] ✅ Notification created for tenant update`);
        }
      }
    } catch (notifError) {
      console.error(`[${timestamp}] [MeterMgmt] ⚠️ Notification failed:`, notifError.message);
    }

    return {
      success: true,
      message: 'Tenant updated successfully',
      tenant: updatedTenant,
    };
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt] ❌ Update tenant failed:`, error.message);
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── DELETE TENANT (Owner only) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
async deleteTenant(ownerSerial, tenantSerial) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt] 🗑️ Deleting tenant ${tenantSerial} by owner ${ownerSerial}`);

  try {
    // ─── Verify + Delete in one query ──────────────────────────────
    const deleteQuery = `
      DELETE FROM tenant_info
      WHERE serial = $1 AND owner_serial = $2
      RETURNING *
    `;
    const result = await pool.query(deleteQuery, [tenantSerial, ownerSerial]);

    if (result.rows.length === 0) {
      return { success: false, message: 'Tenant not found or not yours' };
    }

        const deletedTenant = result.rows[0];
    console.log(`[${timestamp}] [MeterMgmt] ✅ Tenant deleted: ${tenantSerial}`);

    // ✅ NEW: Insert notification
    try {
      const Notification = require('../models/Notification');
      // Get owner's m_bondhu_id
      const ownerInfo = await pool.query(
        'SELECT m_bondhu_id FROM user_info WHERE serial = $1',
        [ownerSerial]
      );
      if (ownerInfo.rows[0]) {
        const notification = await Notification.create({
          m_bondhu_id: ownerInfo.rows[0].m_bondhu_id,
          notification_type: 'tenant',
          title: '🗑️ Tenant Removed',
          message: `${deletedTenant.tenant_name || 'Tenant'}${deletedTenant.flat_floor ? ' (' + deletedTenant.flat_floor + ')' : ''} has been removed from your tenant list.`,
          data: {
            tenant_serial: deletedTenant.serial,
            tenant_name: deletedTenant.tenant_name,
            flat_floor: deletedTenant.flat_floor,
            account_no: deletedTenant.account_no,
            meter_no: deletedTenant.meter_no,
            action: 'delete',
            timestamp: new Date().toISOString(),
          },
        });
        if (notification) {
          await Notification.markAsSent(notification.notification_id);
          console.log(`[${timestamp}] [MeterMgmt] ✅ Notification created for tenant delete`);
        }
      }
    } catch (notifError) {
      console.error(`[${timestamp}] [MeterMgmt] ⚠️ Notification failed:`, notifError.message);
    }

    return {
      success: true,
      message: 'Tenant deleted successfully',
      tenant: deletedTenant,
    };
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt] ❌ Delete tenant failed:`, error.message);
    return { success: false, message: error.message };
  }
}

  // ═══════════════════════════════════════════════════════════════════════
  // ─── GET TENANT METERS (with unbind) ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getTenantMeters(tenantSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterMgmt] 🧑 Getting tenant meters for ${tenantSerial}`);

    try {
      const query = `
        SELECT m.*, u.full_name as user_name, u.user_type
        FROM meter_info m
        INNER JOIN user_info u ON u.serial = m.user_serial
        WHERE m.user_serial = $1
      `;
      const result = await pool.query(query, [tenantSerial]);

      const unbindResult = await this.getUnbindMeters(tenantSerial);

      return {
        success: true,
        activeMeters: result.rows,
        unbindMeters: unbindResult.unbindMeters,
      };
    } catch (error) {
      console.error(`[${timestamp}] [MeterMgmt] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── UPDATE TENANT METER CONFIG (per meter) ────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async updateTenantMeterConfig(ownerSerial, tenantSerial, config) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MeterMgmt] ⚙️ Updating tenant ${tenantSerial} config by owner ${ownerSerial}`);

    try {
      const { low_balance_threshold, alert_enabled } = config;

      // Verify this tenant is under owner
      const verifyQuery = `
        SELECT 1 FROM meter_info m1
        INNER JOIN meter_info m2 ON m1.account_no = m2.account_no
        WHERE m1.user_serial = $1 AND m2.user_serial = $2
      `;
      const verifyResult = await pool.query(verifyQuery, [ownerSerial, tenantSerial]);

      if (verifyResult.rows.length === 0) {
        return { success: false, message: 'Not authorized for this tenant' };
      }

      // Update tenant's user_info
      const updateQuery = `
        UPDATE user_info
        SET low_balance_alert_threshold = COALESCE($1, low_balance_alert_threshold),
            email_notification_enabled = COALESCE($2, email_notification_enabled),
            updated_at = CURRENT_TIMESTAMP
        WHERE serial = $3
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [
        low_balance_threshold,
        alert_enabled,
        tenantSerial,
      ]);

      return {
        success: true,
        message: 'Tenant config updated',
        tenant: result.rows[0],
      };
    } catch (error) {
      console.error(`[${timestamp}] [MeterMgmt] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new MeterManagementService();