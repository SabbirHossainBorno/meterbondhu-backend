// src/controllers/meterManagementController.js
const meterManagementService = require('../services/meterManagementService');

// ─── Unbind Meter ──────────────────────────────────────────────────────
exports.unbindMeter = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt Controller] 🔓 POST /unbind`);

  try {
    const { meterId } = req.body;
    const userSerial = req.user.serial;

    if (!meterId) {
      return res.status(400).json({
        success: false,
        message: 'meterId is required',
      });
    }

    const result = await meterManagementService.unbindMeter(userSerial, meterId);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Re-add Unbind Meter ───────────────────────────────────────────────
exports.readdMeter = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt Controller] 🔒 POST /readd`);

  try {
    const { unbindId } = req.body;
    const userSerial = req.user.serial;

    if (!unbindId) {
      return res.status(400).json({
        success: false,
        message: 'unbindId is required',
      });
    }

    const result = await meterManagementService.readdMeter(userSerial, unbindId);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Unbind Meters ─────────────────────────────────────────────────
exports.getUnbindMeters = async (req, res) => {
  try {
    const userSerial = req.user.serial;
    const result = await meterManagementService.getUnbindMeters(userSerial);
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Owner Meters ──────────────────────────────────────────────────
exports.getOwnerMeters = async (req, res) => {
  try {
    const ownerSerial = req.user.serial;
    const result = await meterManagementService.getOwnerMeters(ownerSerial);
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ─── ADD TENANT (Owner only) ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
exports.addTenant = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt Controller] ➕ POST /tenant/add`);

  try {
    const ownerSerial = req.user.serial;
    const { tenant_name, flat_floor, account_no, meter_no } = req.body;

    const result = await meterManagementService.addTenant(ownerSerial, {
      tenant_name,
      flat_floor,
      account_no,
      meter_no,
    });

    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ─── UPDATE TENANT (Owner only) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
exports.updateTenant = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt Controller] ✏️ PUT /tenant/${req.params.tenantSerial}`);

  try {
    const ownerSerial = req.user.serial;
    const { tenantSerial } = req.params;
    const { tenant_name, flat_floor, account_no, meter_no } = req.body;

    const result = await meterManagementService.updateTenant(
      ownerSerial,
      tenantSerial,
      { tenant_name, flat_floor, account_no, meter_no }
    );

    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ─── DELETE TENANT (Owner only) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
exports.deleteTenant = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterMgmt Controller] 🗑️ DELETE /tenant/${req.params.tenantSerial}`);

  try {
    const ownerSerial = req.user.serial;
    const { tenantSerial } = req.params;

    const result = await meterManagementService.deleteTenant(ownerSerial, tenantSerial);

    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Tenant Meters ─────────────────────────────────────────────────
exports.getTenantMeters = async (req, res) => {
  try {
    const tenantSerial = req.user.serial;
    const result = await meterManagementService.getTenantMeters(tenantSerial);
    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Update Tenant Meter Config ────────────────────────────────────────
exports.updateTenantConfig = async (req, res) => {
  try {
    const ownerSerial = req.user.serial;
    const { tenantSerial, low_balance_threshold, alert_enabled } = req.body;

    const result = await meterManagementService.updateTenantMeterConfig(
      ownerSerial,
      tenantSerial,
      { low_balance_threshold, alert_enabled }
    );

    res.json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [MeterMgmt Controller] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};