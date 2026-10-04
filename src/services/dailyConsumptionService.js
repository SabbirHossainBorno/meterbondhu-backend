// src/services/dailyConsumptionService.js
// ═══════════════════════════════════════════════════════════════════════════
// Daily Consumption Service
// ═══════════════════════════════════════════════════════════════════════════
//
// Responsibilities:
//   1. Fetch cumulative data from DESCO API
//   2. Calculate daily values from cumulative
//   3. Save to DB (upsert)
//
// Calculation Rules:
//   ┌─────────────────────┬──────────────────────┬──────────────────────┐
//   │ Case                │ consumption_unit     │ consumption_taka     │
//   ├─────────────────────┼──────────────────────┼──────────────────────┤
//   │ First record        │ null                 │ null                 │
//   │ Normal day          │ current - previous   │ current - previous   │
//   │ Taka reset          │ current - previous   │ current (as-is)      │
//   │ Unit reset (rare)   │ current (as-is)      │ current - previous   │
//   └─────────────────────┴──────────────────────┴──────────────────────┘
//
// Unique constraint: (meter_no, consumption_date)
// ═══════════════════════════════════════════════════════════════════════════

const DescoService = require('./descoService');
const DailyConsumption = require('../models/DailyConsumption');

class DailyConsumptionService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Calculate Daily from Cumulative ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  calculateDailyFromCumulative(rawData) {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    // Sort by date ascending
    const sorted = [...rawData].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const result = [];

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 FIRST RECORD — Both daily values = null
    // ═══════════════════════════════════════════════════════════════════
    // No previous day exists, so we can't calculate daily consumption.
    // We store the cumulative values (raw) but leave daily as null.
    // ═══════════════════════════════════════════════════════════════════
    const first = sorted[0];
    result.push({
      date: first.date,
      consumption_unit: null,
      consumption_taka: null,
      cumulative_unit: parseFloat(first.consumedUnit) || 0,
      cumulative_taka: parseFloat(first.consumedTaka) || 0,
    });

    // ═══════════════════════════════════════════════════════════════════
    // SUBSEQUENT RECORDS
    // ═══════════════════════════════════════════════════════════════════
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];

      const currentUnit = parseFloat(current.consumedUnit) || 0;
      const previousUnit = parseFloat(previous.consumedUnit) || 0;

      const currentTaka = parseFloat(current.consumedTaka) || 0;
      const previousTaka = parseFloat(previous.consumedTaka) || 0;

      let consumption_unit;
      let consumption_taka;

      // ─── UNIT: check reset ────────────────────────────────────────
      if (currentUnit >= previousUnit) {
        // Normal case
        consumption_unit = currentUnit - previousUnit;
      } else {
        // Reset (rare for unit — meter reading normally never resets)
        consumption_unit = currentUnit;
      }

      // ─── TAKA: check reset ────────────────────────────────────────
      if (currentTaka >= previousTaka) {
        // Normal case
        consumption_taka = currentTaka - previousTaka;
      } else {
        // Reset (new month started — taka counter resets to 0)
        consumption_taka = currentTaka;
      }

      // ─── Validation ───────────────────────────────────────────────
      if (consumption_unit < 0 || consumption_taka < 0) {
        // Skip corrupted records
        continue;
      }

      // ─── Round to 2 decimals ──────────────────────────────────────
      consumption_unit = Math.round(consumption_unit * 100) / 100;
      consumption_taka = Math.round(consumption_taka * 100) / 100;

      result.push({
        date: current.date,
        consumption_unit,
        consumption_taka,
        cumulative_unit: currentUnit,
        cumulative_taka: currentTaka,
      });
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Fetch from DESCO & Save to DB ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async fetchAndSave(meterNo, accountNo, dateFrom, dateTo) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [DailyService] 🔄 Fetching ${meterNo} from ${dateFrom} to ${dateTo}`
    );

    try {
      // ─── 1. Fetch raw data from DESCO ─────────────────────────────
      const rawData = await DescoService.getDailyConsumption(
        accountNo,
        meterNo,
        dateFrom,
        dateTo
      );

      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        console.log(`[DailyService] ⚠️ No data from DESCO`);
        return { success: true, saved: 0, message: 'No data available' };
      }

      console.log(`[DailyService] 📊 Raw records: ${rawData.length}`);

      // ─── 2. Calculate daily ───────────────────────────────────────
      const dailyData = this.calculateDailyFromCumulative(rawData);

      console.log(`[DailyService] 📊 Calculated records: ${dailyData.length}`);

      // ─── 3. Prepare rows for DB ───────────────────────────────────
      const rows = dailyData.map((item) => ({
        meter_no: meterNo,
        consumption_date: item.date,
        consumption_unit: item.consumption_unit,
        consumption_taka: item.consumption_taka,
        cumulative_unit: item.cumulative_unit,
        cumulative_taka: item.cumulative_taka,
      }));

      // ─── 4. Bulk upsert to DB ─────────────────────────────────────
      const result = await DailyConsumption.bulkUpsert(rows);

      console.log(
        `[${timestamp}] [DailyService] ✅ Saved: ${result.inserted} inserted, ${result.updated} updated`
      );

      if (result.errors && result.errors.length > 0) {
        console.error(
          `[DailyService] ⚠️ ${result.errors.length} errors during upsert`
        );
      }

      return {
        success: true,
        saved: result.inserted + result.updated,
        inserted: result.inserted,
        updated: result.updated,
        total: result.total,
        errors: result.errors.length,
      };
    } catch (error) {
      console.error(
        `[${timestamp}] [DailyService] ❌ Error:`,
        error.message
      );
      return { success: false, message: error.message, saved: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Sync on Login (Last 30 Days) ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async syncOnLogin(meterNo, accountNo) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [DailyService] 🚀 Login sync for meter ${meterNo}`
    );

    const today = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(today.getDate() - 30);

    return this.fetchAndSave(
      meterNo,
      accountNo,
      dateFrom.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Sync Yesterday + Today (Cron Job) ────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async syncYesterdayAndToday(meterNo, accountNo) {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [DailyService] ⏰ Cron sync for meter ${meterNo}`
  );

  // ✅ Fetch last 7 days (DESCO API has 2-3 day delay, so 7 days buffer)
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  return this.fetchAndSave(
    meterNo,
    accountNo,
    sevenDaysAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  );
}

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Manual Backfill for a Meter ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async backfill(meterNo, accountNo, daysBack = 90) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [DailyService] 🔄 Backfill ${daysBack} days for meter ${meterNo}`
    );

    const today = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(today.getDate() - daysBack);

    return this.fetchAndSave(
      meterNo,
      accountNo,
      dateFrom.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
  }
}

module.exports = new DailyConsumptionService();