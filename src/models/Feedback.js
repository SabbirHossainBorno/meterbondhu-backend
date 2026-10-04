// src/models/Feedback.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class Feedback {
  static async create(data) {
    const {
      user_serial, m_bondhu_id, full_name, email, meter_no, account_no,
      title, description, page_name, priority, attachments = [],
    } = data;

    // ✅ Step 1: Get next serial value WITHOUT inserting
    const seqRes = await pool.query(
      `SELECT nextval(pg_get_serial_sequence('feedback', 'serial')) AS next_serial`
    );
    const nextSerial = parseInt(seqRes.rows[0].next_serial, 10);

    // ✅ Step 2: Generate code BEFORE insert
    const feedbackCode = IDGenerator.generateFeedbackId(nextSerial);

    // ✅ Step 3: Insert with code + explicit serial
    const insertRes = await pool.query(
      `INSERT INTO feedback (
        serial, feedback_code,
        user_serial, m_bondhu_id, full_name, email,
        meter_no, account_no, title, description,
        page_name, priority, attachments
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        nextSerial, feedbackCode,
        user_serial, m_bondhu_id, full_name, email,
        meter_no, account_no, title, description,
        page_name, priority, JSON.stringify(attachments),
      ]
    );

    return insertRes.rows[0];
  }

  static async markEmailSent(serial) {
    await pool.query(
      `UPDATE feedback SET email_sent = true WHERE serial = $1`,
      [serial]
    );
  }

  static async updateAttachments(serial, filenames) {
    await pool.query(
      `UPDATE feedback SET attachments = $1 WHERE serial = $2`,
      [JSON.stringify(filenames), serial]
    );
  }

  static async findAll({ status, page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';

    if (status) {
      params.push(status);
      where = `WHERE status = $${params.length}`;
    }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM feedback ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  static async findById(serial) {
    const result = await pool.query(
      `SELECT * FROM feedback WHERE serial = $1`,
      [serial]
    );
    return result.rows[0];
  }
}

module.exports = Feedback;