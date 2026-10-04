// src/modal/RechargeHistory.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class RechargeHistory {
  static async create(data) {
    const { 
      user_serial, meter_serial, order_id, token, sequence,
      total_amount, energy_amount, charge_amount, recharge_date,
      recharge_operator, rebate, vat, order_status
    } = data;

    const serialResult = await pool.query(
      "SELECT nextval('recharge_history_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const recharge_id = IDGenerator.generateRechargeId(serial);

    const query = `
      INSERT INTO recharge_history (
        recharge_id, user_serial, meter_serial, order_id, token, sequence,
        total_amount, energy_amount, charge_amount, recharge_date,
        recharge_operator, rebate, vat, order_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      recharge_id, user_serial, meter_serial, order_id, token, sequence,
      total_amount, energy_amount, charge_amount, recharge_date,
      recharge_operator, rebate, vat, order_status
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByUserSerial(user_serial, dateFrom, dateTo) {
    const query = `
      SELECT * FROM recharge_history 
      WHERE user_serial = $1 
        AND recharge_date BETWEEN $2 AND $3
      ORDER BY recharge_date DESC
    `;
    const result = await pool.query(query, [user_serial, dateFrom, dateTo]);
    return result.rows;
  }

  static async findByMeterSerial(meter_serial, dateFrom, dateTo) {
    const query = `
      SELECT * FROM recharge_history 
      WHERE meter_serial = $1 
        AND recharge_date BETWEEN $2 AND $3
      ORDER BY recharge_date DESC
    `;
    const result = await pool.query(query, [meter_serial, dateFrom, dateTo]);
    return result.rows;
  }
}

module.exports = RechargeHistory;
