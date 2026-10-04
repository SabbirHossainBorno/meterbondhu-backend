// src/models/MonthlyConsumption.js
// ═══════════════════════════════════════════════════════════════════════════
// Monthly Consumption Model
// ═══════════════════════════════════════════════════════════════════════════
//
// Table Structure (post-migration):
//   - serial, consumption_id, meter_no
//   - consumption_month ("YYYY-MM")
//   - consumed_unit (total kWh for month)
//   - consumed_taka (total ৳ for month)
//   - created_at, updated_at
//
// Unique: (meter_no, consumption_month)
// ═══════════════════════════════════════════════════════════════════════════

const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');

class MonthlyConsumption {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Create (simple insert) ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async create(data) {
    const {
      meter_no,
      consumption_month,
      consumed_unit,
      consumed_taka,
    } = data;

    // Get next serial
    const serialResult = await pool.query(
      "SELECT nextval('monthly_consumption_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;

    // ✅ Correct method name — MTH{serial}MBONDHU
    const consumption_id = IDGenerator.generateMonthlyConsumptionId(serial);

    const query = `
      INSERT INTO monthly_consumption (
        consumption_id,
        meter_no,
        consumption_month,
        consumed_unit,
        consumed_taka
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      consumption_id,
      meter_no,
      consumption_month,
      consumed_unit,
      consumed_taka,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Upsert — insert or update if same month+meter ────────────────────
  // ═══════════════════════════════════════════════════════════════════════
    static async upsert(data) {
    const {
      meter_no,
      consumption_month,
      consumed_unit,
      consumed_taka,
    } = data;

    // ✅ Normalize null values
    const finalUnit = consumed_unit !== undefined ? consumed_unit : null;
    const finalTaka = consumed_taka !== undefined ? consumed_taka : null;

    // Check if row exists
    const existing = await pool.query(
      `SELECT serial FROM monthly_consumption 
       WHERE meter_no = $1 AND consumption_month = $2`,
      [meter_no, consumption_month]
    );

    if (existing.rows.length > 0) {
      // ✅ Update existing — use COALESCE to keep old value if new is null
      const updateResult = await pool.query(
        `UPDATE monthly_consumption 
         SET consumed_unit = COALESCE($1, consumed_unit),
             consumed_taka = COALESCE($2, consumed_taka)
         WHERE meter_no = $3 AND consumption_month = $4
         RETURNING *`,
        [finalUnit, finalTaka, meter_no, consumption_month]
      );
      return { ...updateResult.rows[0], _action: 'updated' };
    }

    // Insert new (with nulls allowed)
    const serialResult = await pool.query(
      "SELECT nextval('monthly_consumption_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const consumption_id = IDGenerator.generateMonthlyConsumptionId(serial);

    const insertResult = await pool.query(
      `INSERT INTO monthly_consumption (
        consumption_id,
        meter_no,
        consumption_month,
        consumed_unit,
        consumed_taka
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        consumption_id,
        meter_no,
        consumption_month,
        finalUnit,
        finalTaka,
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
  // ─── Find by meter_no + month range ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async findByMeterNo(meter_no, monthFrom, monthTo) {
    const query = `
      SELECT * FROM monthly_consumption 
      WHERE meter_no = $1 
        AND consumption_month BETWEEN $2 AND $3
      ORDER BY consumption_month ASC
    `;
    const result = await pool.query(query, [meter_no, monthFrom, monthTo]);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get latest month for a meter ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async getLatestMonth(meter_no) {
    const query = `
      SELECT MAX(consumption_month) AS latest_month 
      FROM monthly_consumption 
      WHERE meter_no = $1
    `;
    const result = await pool.query(query, [meter_no]);
    return result.rows[0]?.latest_month || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get count for a meter ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  static async getCountByMeterNo(meter_no) {
    const query = `
      SELECT COUNT(*)::int AS count 
      FROM monthly_consumption 
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
      DELETE FROM monthly_consumption 
      WHERE meter_no = $1
      RETURNING *
    `;
    const result = await pool.query(query, [meter_no]);
    return result.rowCount;
  }
}

module.exports = MonthlyConsumption;