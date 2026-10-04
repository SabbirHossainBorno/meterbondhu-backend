// src/controllers/meterController.js
const Meter = require('../models/Meter');
const DescoService = require('../services/descoService');
const meterService = require('../services/meterService');

// ═══════════════════════════════════════════════════════════════════════
// EXISTING METHODS (আপনার আগের code)
// ═══════════════════════════════════════════════════════════════════════

exports.getUserMeters = async (req, res) => {
  try {
    const meters = await Meter.findByUserSerial(req.user.serial);
    res.json({ success: true, meters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addMeter = async (req, res) => {
  try {
    const { account_no, meter_no } = req.body;

    const existing = await Meter.findByUserSerial(req.user.serial);
    if (existing.length >= 2) {
      return res.status(403).json({ 
        success: false, 
        message: 'Free plan limit reached (max 2 meters). Upgrade to Pro for unlimited meters.',
        limitReached: true 
      });
    }

    const descoData = await DescoService.getCustomerInfo(account_no, meter_no);

    const meter = await Meter.create({
      user_serial: req.user.serial,
      account_no,
      meter_no: descoData.meterNo || meter_no,
      customer_name: descoData.customerName,
      contact_no: descoData.contactNo,
      installation_address: descoData.installationAddress,
      feeder_name: descoData.feederName,
      installation_date: descoData.installationDate,
      phase_type: descoData.phaseType,
      sanction_load: descoData.sanctionLoad,
      tariff_solution: descoData.tariffSolution,
      meter_model: descoData.meterModel,
      transformer: descoData.transformer,
      sd_name: descoData.SDName
    });

    res.json({ success: true, meter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMeter = async (req, res) => {
  try {
    const { meter_id } = req.params;
    res.json({ success: true, message: 'Meter deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setPrimaryMeter = async (req, res) => {
  try {
    const { meter_id } = req.params;
    res.json({ success: true, message: 'Primary meter updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// NEW METHODS (Balance Sync)
// ═══════════════════════════════════════════════════════════════════════

// ─── Sync All Meters ───────────────────────────────────────────────────
exports.syncAllMeters = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterController] 🔄 POST /sync-all called`);
  
  try {
    const result = await meterService.syncAllMeters();
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Sync Single Meter ─────────────────────────────────────────────────
exports.syncMeter = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MeterController] 🔄 POST /sync called`);
  
  try {
    const { meterSerial } = req.body;
    
    if (!meterSerial) {
      return res.status(400).json({ success: false, message: 'meterSerial required' });
    }

    const result = await meterService.syncMeterBalance(meterSerial);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [MeterController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Meter Info ────────────────────────────────────────────────────
exports.getMeterInfo = async (req, res) => {
  try {
    const { userSerial } = req.query;
    
    if (!userSerial) {
      return res.status(400).json({ success: false, message: 'userSerial required' });
    }

    const meter = await meterService.getMeterByUserSerial(userSerial);
    
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    res.json({ success: true, data: meter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Stale Meters ──────────────────────────────────────────────────
exports.getStaleMeters = async (req, res) => {
  try {
    const meters = await meterService.getStaleMeters();
    res.json({ success: true, data: meters, count: meters.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};