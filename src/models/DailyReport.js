const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class DailyReport {
  static async create(data) {
    const { 
      user_serial, report_date, opening_balance, closing_balance,
      total_consumption, total_recharge, consumption_details, recharge_details
    } = data;

    const serialResult = await pool.query(
      "SELECT nextval('daily_reports_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const report_id = IDGenerator.generateReportId(serial);

    const query = `
      INSERT INTO daily_reports (
        report_id, user_serial, report_date, opening_balance,
        closing_balance, total_consumption, total_recharge,
        consumption_details, recharge_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      report_id, user_serial, report_date, opening_balance,
      closing_balance, total_consumption, total_recharge,
      consumption_details || {}, recharge_details || {}
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByUserSerial(user_serial, dateFrom, dateTo) {
    const query = `
      SELECT * FROM daily_reports 
      WHERE user_serial = $1 
        AND report_date BETWEEN $2 AND $3
      ORDER BY report_date DESC
    `;
    const result = await pool.query(query, [user_serial, dateFrom, dateTo]);
    return result.rows;
  }

  static async findByDate(report_date) {
    const query = 'SELECT * FROM daily_reports WHERE report_date = $1';
    const result = await pool.query(query, [report_date]);
    return result.rows;
  }

  static async markAsSent(report_id, sent_via) {
    const query = `
      UPDATE daily_reports 
      SET is_sent = true, sent_at = CURRENT_TIMESTAMP, sent_via = $1
      WHERE report_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [sent_via, report_id]);
    return result.rows[0];
  }
}

module.exports = DailyReport;
