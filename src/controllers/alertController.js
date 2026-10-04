// src/controllers/alertController.js
const { pool } = require('../config/database');
const AlertLog = require('../models/AlertLog');
const alertService = require('../services/alertService');

// ─── Get User Alerts ──────────────────────────────────────────────────────
exports.getUserAlerts = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AlertController] 📊 Getting alerts for user: ${req.user.m_bondhu_id}`);
  
  try {
    const alerts = await AlertLog.findByMBondhuId(req.user.m_bondhu_id, 50);
    res.json({ success: true, alerts });
  } catch (error) {
    console.error(`[${timestamp}] [AlertController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Active Alerts ────────────────────────────────────────────────────
exports.getActiveAlerts = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AlertController] 🔴 Getting active alerts for: ${req.user.m_bondhu_id}`);
  
  try {
    const alerts = await AlertLog.getActiveAlerts(req.user.m_bondhu_id);
    res.json({ success: true, alerts });
  } catch (error) {
    console.error(`[${timestamp}] [AlertController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Resolve Alert ────────────────────────────────────────────────────────
exports.resolveAlert = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AlertController] ✅ Resolving alert: ${req.params.alert_id}`);
  
  try {
    const alert = await AlertLog.resolve(req.params.alert_id);
    res.json({ success: true, alert });
  } catch (error) {
    console.error(`[${timestamp}] [AlertController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Force Alert Check ────────────────────────────────────────────────────
exports.forceAlertCheck = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AlertController] 🔍 Force check for: ${req.user.m_bondhu_id}`);
  
  try {
    const result = await alertService.forceCheckForUser(req.user.serial);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [AlertController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Alert Settings ───────────────────────────────────────────────────
exports.getAlertSettings = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AlertController] ⚙️ Getting alert settings for: ${req.user.m_bondhu_id}`);
  
  try {
    const query = `
      SELECT low_balance_alert_threshold, email_notification_enabled, 
             push_notification_enabled, daily_report_enabled 
      FROM user_info 
      WHERE m_bondhu_id = $1
    `;
    const result = await pool.query(query, [req.user.m_bondhu_id]);
    res.json({ success: true, settings: result.rows[0] || {} });
  } catch (error) {
    console.error(`[${timestamp}] [AlertController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Alert Statistics ─────────────────────────────────────────────────
exports.getAlertStats = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AlertController] 📊 Getting alert stats`);
  
  try {
    const stats = await alertService.getAlertStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error(`[${timestamp}] [AlertController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};