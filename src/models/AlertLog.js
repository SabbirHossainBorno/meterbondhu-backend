// src/models/AlertLog.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class AlertLog {
  static async create(data) {
    const { 
      m_bondhu_id,
      meter_serial, 
      alert_type, 
      threshold_value, 
      current_value, 
      message 
    } = data;

    const serialResult = await pool.query(
      "SELECT nextval('alert_logs_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const alert_id = IDGenerator.generateAlertId(serial);

    const query = `
      INSERT INTO alert_logs (
        alert_id, m_bondhu_id, meter_serial, alert_type,
        threshold_value, current_value, message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      alert_id, m_bondhu_id, meter_serial, alert_type,
      threshold_value, current_value, message
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ─── Find by m_bondhu_id ──────────────────────────────────────────────
  static async findByMBondhuId(m_bondhu_id, limit = 50) {
    const query = `
      SELECT * FROM alert_logs 
      WHERE m_bondhu_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [m_bondhu_id, limit]);
    return result.rows;
  }

  // ─── Get Active Alerts by m_bondhu_id ──────────────────────────────────
  static async getActiveAlerts(m_bondhu_id) {
    const query = `
      SELECT * FROM alert_logs 
      WHERE m_bondhu_id = $1 
      AND is_resolved = false 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [m_bondhu_id]);
    return result.rows;
  }

  // ─── Resolve Alert ──────────────────────────────────────────────────────
  static async resolve(alert_id) {
    const query = `
      UPDATE alert_logs 
      SET is_resolved = true, resolved_at = CURRENT_TIMESTAMP 
      WHERE alert_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [alert_id]);
    return result.rows[0];
  }

  // ─── Mark Notification Sent ──────────────────────────────────────────────
  static async markNotificationSent(alert_id) {
    const query = `
      UPDATE alert_logs 
      SET notification_sent = true, notification_sent_at = CURRENT_TIMESTAMP 
      WHERE alert_id = $1
    `;
    await pool.query(query, [alert_id]);
  }
}

module.exports = AlertLog;