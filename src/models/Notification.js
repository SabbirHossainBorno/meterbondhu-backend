// src/models/Notification.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class Notification {
  static async create(data) {
    const { 
      m_bondhu_id,
      notification_type, 
      title, 
      message, 
      data: extraData,
    } = data;

    const serialResult = await pool.query(
      "SELECT nextval('user_notifications_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const notification_id = IDGenerator.generateNotificationId(serial);

    const query = `
      INSERT INTO user_notifications (
        notification_id, m_bondhu_id, notification_type, 
        title, message, data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      notification_id, m_bondhu_id, notification_type, 
      title, message, extraData || {}
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ─── Mark as Sent ──────────────────────────────────────────────────────
  static async markAsSent(notification_id) {
    const query = `
      UPDATE user_notifications 
      SET is_sent = true, 
          sent_at = CURRENT_TIMESTAMP
      WHERE notification_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [notification_id]);
    return result.rows[0];
  }

  // ─── Mark as Sent with channel ──────────────────────────────────────
  static async markAsSentWithChannel(notification_id, channel) {
    const query = `
      UPDATE user_notifications 
      SET is_sent = true, 
          sent_at = CURRENT_TIMESTAMP,
          data = jsonb_set(data, '{sent_via}', to_jsonb($2::text), true)
      WHERE notification_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [notification_id, channel]);
    return result.rows[0];
  }

  // ─── Find by m_bondhu_id ──────────────────────────────────────────────
  static async findByMBondhuId(m_bondhu_id, limit = 50) {
    const query = `
      SELECT * FROM user_notifications 
      WHERE m_bondhu_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [m_bondhu_id, limit]);
    return result.rows;
  }

  // ─── Mark as Read ──────────────────────────────────────────────────────
  static async markAsRead(notification_id) {
    const query = `
      UPDATE user_notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP 
      WHERE notification_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [notification_id]);
    return result.rows[0];
  }

  // ─── Mark All as Read by m_bondhu_id ──────────────────────────────────
  static async markAllAsRead(m_bondhu_id) {
    const query = `
      UPDATE user_notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP 
      WHERE m_bondhu_id = $1 AND is_read = false
    `;
    await pool.query(query, [m_bondhu_id]);
  }

  // ─── Get Unread Count by m_bondhu_id ──────────────────────────────────
  static async getUnreadCount(m_bondhu_id) {
    const query = `
      SELECT COUNT(*) FROM user_notifications 
      WHERE m_bondhu_id = $1 AND is_read = false
    `;
    const result = await pool.query(query, [m_bondhu_id]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Notification;