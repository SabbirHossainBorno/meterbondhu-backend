// src/models/DailyConsumption.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class DailyConsumption {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Create (simple insert) ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async create(data) {
    const {
      meter_no,
      consumption_date,
      consumption_unit,
      consumption_taka,
      cumulative_unit,
      cumulative_taka,
    } = data;

    const serialResult = await pool.query(
      "SELECT nextval('daily_consumption_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;

    // ✅ Correct method name
    const consumption_id = IDGenerator.generateConsumptionId(serial);

    const query = `
      INSERT INTO daily_consumption (
        consumption_id,
        meter_no,
        consumption_date,
        consumption_unit,
        consumption_taka,
        cumulative_unit,
        cumulative_taka
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      consumption_id,
      meter_no,
      consumption_date,
      consumption_unit,
      consumption_taka,
      cumulative_unit,
      cumulative_taka,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Upsert (insert or update) ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async upsert(data) {
    const {
      meter_no,
      consumption_date,
      consumption_unit,
      consumption_taka,
      cumulative_unit,
      cumulative_taka,
    } = data;

    const existing = await pool.query(
      `SELECT serial FROM daily_consumption 
       WHERE meter_no = $1 AND consumption_date = $2`,
      [meter_no, consumption_date]
    );

    if (existing.rows.length > 0) {
      const updateResult = await pool.query(
        `UPDATE daily_consumption 
         SET consumption_unit = $1,
             consumption_taka = $2,
             cumulative_unit = $3,
             cumulative_taka = $4
         WHERE meter_no = $5 AND consumption_date = $6
         RETURNING *`,
        [
          consumption_unit,
          consumption_taka,
          cumulative_unit,
          cumulative_taka,
          meter_no,
          consumption_date,
        ]
      );
      return { ...updateResult.rows[0], _action: 'updated' };
    }

    const serialResult = await pool.query(
      "SELECT nextval('daily_consumption_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;

    // ✅ Correct method name
    const consumption_id = IDGenerator.generateConsumptionId(serial);

    const insertResult = await pool.query(
      `INSERT INTO daily_consumption (
        consumption_id,
        meter_no,
        consumption_date,
        consumption_unit,
        consumption_taka,
        cumulative_unit,
        cumulative_taka
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        consumption_id,
        meter_no,
        consumption_date,
        consumption_unit,
        consumption_taka,
        cumulative_unit,
        cumulative_taka,
      ]
    );
    return { ...insertResult.rows[0], _action: 'inserted' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Bulk Upsert ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async bulkUpsert(rows) {
    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const result = await this.upsert(row);
        if (result._action === 'inserted') inserted++;
        else updated++;
      } catch (err) {
        errors.push({ row, error: err.message });
      }
    }

    return { inserted, updated, total: rows.length, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Find by meter_no + date range ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async findByMeterNo(meter_no, dateFrom, dateTo) {
    const query = `
      SELECT * FROM daily_consumption 
      WHERE meter_no = $1 
        AND consumption_date BETWEEN $2 AND $3
      ORDER BY consumption_date ASC
    `;
    const result = await pool.query(query, [meter_no, dateFrom, dateTo]);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get latest record for a meter ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async getLatestByMeterNo(meter_no) {
    const query = `
      SELECT * FROM daily_consumption 
      WHERE meter_no = $1 
      ORDER BY consumption_date DESC 
      LIMIT 1
    `;
    const result = await pool.query(query, [meter_no]);
    return result.rows[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get latest date for a meter ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async getLatestDate(meter_no) {
    const query = `
      SELECT MAX(consumption_date) AS latest_date 
      FROM daily_consumption 
      WHERE meter_no = $1
    `;
    const result = await pool.query(query, [meter_no]);
    return result.rows[0]?.latest_date || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get count for a meter ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async getCountByMeterNo(meter_no) {
    const query = `
      SELECT COUNT(*)::int AS count 
      FROM daily_consumption 
      WHERE meter_no = $1
    `;
    const result = await pool.query(query, [meter_no]);
    return result.rows[0]?.count || 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Delete by meter_no ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async deleteByMeterNo(meter_no) {
    const query = `
      DELETE FROM daily_consumption 
      WHERE meter_no = $1
      RETURNING *
    `;
    const result = await pool.query(query, [meter_no]);
    return result.rowCount;
  }
}

module.exports = DailyConsumption;