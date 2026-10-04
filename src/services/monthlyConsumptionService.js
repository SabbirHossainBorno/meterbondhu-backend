// src/services/monthlyConsumptionService.js
// ═══════════════════════════════════════════════════════════════════════════
// Monthly Consumption Service
// ═══════════════════════════════════════════════════════════════════════════
//
// DESCO API has TWO systems:
//   - System A (unified) — no strict range limit (legacy accounts)
//   - System B (tkdes)   — MAX 12 months per request (newer accounts)
//
// Strategy:
//   - Login sync   → 24 months (chunked via backfill, safe for both systems)
//   - Cron sync    → 2 months (incremental, fast)
//   - Backfill     → chunks of 12 months (works for any range)
//   - Chart reads  → from DB (already synced, no API call)
//
// Unique constraint: (meter_no, consumption_month)
// ═══════════════════════════════════════════════════════════════════════════

const DescoService = require('./descoService');
const MonthlyConsumption = require('../models/MonthlyConsumption');
const { pool } = require('../config/database');

// ─── Helper: Format date to "YYYY-MM" ───────────────────────────────────
const formatMonth = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// ─── Helper: Add/subtract months from date ──────────────────────────────
const shiftMonth = (date, months) => {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return d;
};

class MonthlyConsumptionService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Fetch from DESCO & Save to DB (single range) ─────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async fetchAndSave(meterNo, accountNo, monthFrom, monthTo) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [MonthlyService] 🔄 Fetching ${meterNo} from ${monthFrom} to ${monthTo}`
    );

    try {
      // ─── 1. Fetch raw data from DESCO ─────────────────────────────
      const rawData = await DescoService.getMonthlyConsumption(
        accountNo,
        meterNo,
        monthFrom,
        monthTo
      );

      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        console.log(`[MonthlyService] ⚠️ No data from DESCO (${monthFrom} → ${monthTo})`);
        return {
          success: true,
          saved: 0,
          inserted: 0,
          updated: 0,
          total: 0,
          errors: 0,
          message: 'No data available',
        };
      }

      console.log(`[MonthlyService] 📊 Raw records: ${rawData.length}`);

      // ─── 2. Prepare rows for DB (handle nulls gracefully) ─────────
      const rows = rawData
        .map((item) => {
          if (!item.month || typeof item.month !== 'string') {
            return null;
          }

          const consumedUnit =
            item.consumedUnit !== null && item.consumedUnit !== undefined
              ? parseFloat(item.consumedUnit)
              : null;

          const consumedTaka =
            item.consumedTaka !== null && item.consumedTaka !== undefined
              ? parseFloat(item.consumedTaka)
              : null;

          const validUnit = consumedUnit !== null && !isNaN(consumedUnit) ? consumedUnit : null;
          const validTaka = consumedTaka !== null && !isNaN(consumedTaka) ? consumedTaka : null;

          return {
            meter_no: meterNo,
            consumption_month: item.month, // "YYYY-MM"
            consumed_unit: validUnit,
            consumed_taka: validTaka,
          };
        })
        .filter((row) => row !== null);

      console.log(`[MonthlyService] 📊 Valid rows: ${rows.length}`);

      const nullCount = rows.filter((r) => r.consumed_unit === null).length;
      if (nullCount > 0) {
        console.log(`[MonthlyService] ⚠️ ${nullCount} rows have null consumed_unit`);
      }

      // ─── 3. Bulk upsert to DB ─────────────────────────────────────
      const result = await MonthlyConsumption.bulkUpsert(rows);

      console.log(
        `[${timestamp}] [MonthlyService] ✅ Saved: ${result.inserted} inserted, ${result.updated} updated`
      );

      if (result.errors && result.errors.length > 0) {
        console.error(
          `[MonthlyService] ⚠️ ${result.errors.length} errors during upsert`
        );
      }

      return {
        success: true,
        saved: (result.inserted || 0) + (result.updated || 0),
        inserted: result.inserted || 0,
        updated: result.updated || 0,
        total: result.total || rows.length,
        errors: result.errors?.length || 0,
      };
    } catch (error) {
      console.error(
        `[${timestamp}] [MonthlyService] ❌ Error:`,
        error.message
      );
      return { success: false, message: error.message, saved: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Sync on Login (24 months — chunked via backfill) ─────────────────
  // ═══════════════════════════════════════════════════════════════════════
  // Why 24 months?
  //   - User wants 24 months of data for comparison charts
  //   - System A can fetch 24 in one call
  //   - System B (tkdes) rejects > 12 months — backfill() splits into 12+12
  //
  // Strategy:
  //   - Instead of a single fetch, we call backfill(24) which:
  //       1. Splits 24 → [12, 12]
  //       2. Fetches chunk 1 (newest 12 months) — works for system B
  //       3. Waits 500ms (rate limit)
  //       4. Fetches chunk 2 (older 12 months) — works for system B
  //       5. For system A, both chunks succeed in one call each
  //
  // Result: 24 months of data in DB (for both systems).
  // ═══════════════════════════════════════════════════════════════════════
  async syncOnLogin(meterNo, accountNo) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [MonthlyService] 🚀 Login sync (24 months) for meter ${meterNo}`
    );

    // ✅ 24 months via backfill (chunked) — works for system-A and system-B
    return this.backfill(meterNo, accountNo, 24);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Sync Recent Months (Cron — incremental, 2 months) ────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async syncRecentMonths(meterNo, accountNo, monthsBack = 2) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [MonthlyService] ⏰ Cron sync ${monthsBack} months for meter ${meterNo}`
    );

    const today = new Date();
    const monthFrom = shiftMonth(today, -monthsBack);

    const monthFromStr = formatMonth(monthFrom);
    const monthToStr = formatMonth(today);

    return this.fetchAndSave(meterNo, accountNo, monthFromStr, monthToStr);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Backfill (CHUNKED — works for any range, System B safe) ──────────
  // ═══════════════════════════════════════════════════════════════════════
  // System B rejects ranges > 12 months (code 16005).
  // Solution: split into 12-month chunks and fetch each individually.
  //
  // Example: monthsBack=24 → chunks = [12, 12]
  //          monthsBack=30 → chunks = [12, 12, 6]
  //          monthsBack=13 → chunks = [12, 1]
  //
  // Chunks are fetched newest-first (most useful data arrives fastest).
  // 500ms delay between chunks (rate-limit protection).
  // ═══════════════════════════════════════════════════════════════════════
  async backfill(meterNo, accountNo, monthsBack = 24) {
    const timestamp = new Date().toISOString();
    console.log(
      `\n${'═'.repeat(75)}`
    );
    console.log(
      `[${timestamp}] [MonthlyService] 🔄 Backfill ${monthsBack} months for meter ${meterNo}`
    );
    console.log(`${'═'.repeat(75)}`);

    // ─── Build 12-month chunks ─────────────────────────────────────
    const CHUNK_SIZE = 12;
    const chunks = [];

    let remaining = monthsBack;
    while (remaining > 0) {
      const size = Math.min(remaining, CHUNK_SIZE);
      chunks.push(size);
      remaining -= size;
    }

    console.log(
      `[MonthlyService] 📦 ${chunks.length} chunk(s): ${chunks.join(', ')} months each`
    );

    const today = new Date();
    let totalSaved = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let lastError = null;

    // ─── Fetch each chunk (newest first) ───────────────────────────
    let offset = 0;

    for (let i = 0; i < chunks.length; i++) {
      const size = chunks[i];

      // end = today - offset months
      const endDate = shiftMonth(today, -offset);

      // start = end - (size - 1) months
      const startDate = shiftMonth(endDate, -(size - 1));

      const monthFrom = formatMonth(startDate);
      const monthTo = formatMonth(endDate);

      console.log(
        `\n[MonthlyService] 📦 Chunk ${i + 1}/${chunks.length}: ${monthFrom} → ${monthTo} (${size} months)`
      );

      try {
        const result = await this.fetchAndSave(
          meterNo,
          accountNo,
          monthFrom,
          monthTo
        );

        if (result.success) {
          totalSaved += result.saved || 0;
          totalInserted += result.inserted || 0;
          totalUpdated += result.updated || 0;
          console.log(
            `[MonthlyService] ✅ Chunk ${i + 1} done: ${result.inserted} inserted, ${result.updated} updated`
          );
        } else {
          totalErrors++;
          lastError = result.message;
          console.log(`[MonthlyService] ⚠️ Chunk ${i + 1} failed: ${result.message}`);
        }
      } catch (err) {
        totalErrors++;
        lastError = err.message;
        console.error(`[MonthlyService] ❌ Chunk ${i + 1} threw:`, err.message);
      }

      // Rate limit protection between chunks
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }

      offset += size;
    }

    console.log(
      `\n[${timestamp}] [MonthlyService] ✅ Backfill complete: ${totalSaved} saved (${totalInserted} new, ${totalUpdated} updated), ${totalErrors} errors`
    );
    console.log(`${'═'.repeat(75)}\n`);

    return {
      success: totalErrors === 0,
      saved: totalSaved,
      inserted: totalInserted,
      updated: totalUpdated,
      chunks: chunks.length,
      errors: totalErrors,
      message: lastError,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get from DB (for charts, no API call) ────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  // Reads whatever has been synced to DB — could be 12, 24, 36+ months.
  // Frontend can request any range; backend returns available rows.
  // ═══════════════════════════════════════════════════════════════════════
  async getFromDB(meterNo, monthFrom, monthTo) {
    try {
      const result = await pool.query(
        `SELECT
           consumption_id,
           meter_no,
           consumption_month AS month,
           consumed_unit,
           consumed_taka
         FROM monthly_consumption
         WHERE meter_no = $1
           AND consumption_month BETWEEN $2 AND $3
         ORDER BY consumption_month ASC`,
        [meterNo, monthFrom, monthTo]
      );

      return result.rows.map((row) => ({
        month: row.month,
        consumedUnit:
          row.consumed_unit !== null ? parseFloat(row.consumed_unit) : 0,
        consumedTaka:
          row.consumed_taka !== null ? parseFloat(row.consumed_taka) : 0,
      }));
    } catch (error) {
      console.error(`[MonthlyService] getFromDB error:`, error.message);
      return [];
    }
  }
}

module.exports = new MonthlyConsumptionService();