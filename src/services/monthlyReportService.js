// src/services/monthlyReportService.js
// ═══════════════════════════════════════════════════════════════════════════
// Monthly Report Service
// ═══════════════════════════════════════════════════════════════════════════
// Builds + sends monthly report emails to all users with
// monthly_report_enabled = true.
//
// Runs on the 1st of every month at 8:10 AM Dhaka time via
// monthlyReportScheduler.
//
// Data sources:
//   • PRIMARY   — monthly_consumption table (DESCO official)
//   • SECONDARY — daily_consumption table (transparency)
//   • TREND     — last 3 months from monthly_consumption
//
// ═══════════════════════════════════════════════════════════════════════════

const { pool } = require('../config/database');
const emailService = require('./emailService');
const profileService = require('./profileService');
const Notification = require('../models/Notification');

class MonthlyReportService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Main: Send monthly reports to all eligible users ──────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async sendAllMonthlyReports() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MonthlyReportService] 📧 Starting monthly reports...`);

    try {
      const users = await this.getEligibleUsers();
      console.log(`[${timestamp}] [MonthlyReportService] 👥 Found ${users.length} users with monthly_report_enabled=true`);

      let sentCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          const result = await this.sendMonthlyReportForUser(user);
          if (result.success) sentCount++;
          else failCount++;
        } catch (err) {
          failCount++;
          console.error(`[MonthlyReportService] ❌ ${user.m_bondhu_id}:`, err.message);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      console.log(`[${timestamp}] [MonthlyReportService] ✅ Complete: ${sentCount} sent, ${failCount} failed`);
      return { success: true, total: users.length, sentCount, failCount };
    } catch (error) {
      console.error(`[MonthlyReportService] ❌ Fatal:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get eligible users ─────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getEligibleUsers() {
    const query = `
      SELECT 
        serial, m_bondhu_id, full_name, email, account_no, meter_no,
        meter_type, user_type,
        monthly_report_enabled, email_notification_enabled,
        low_balance_alert_threshold
      FROM user_info
      WHERE is_active = true
        AND is_deleted = false
        AND monthly_report_enabled = true
        AND email_notification_enabled = true
        AND account_no IS NOT NULL
        AND meter_no IS NOT NULL
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Send report for one user ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async sendMonthlyReportForUser(user) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MonthlyReportService] 📤 Building report for ${user.m_bondhu_id} (${user.meter_no})`);

    try {
      const reportData = await this.buildReportData(user);

      const allEmails = await profileService.getAllAlertEmails(user.m_bondhu_id);
      if (!allEmails || allEmails.length === 0) {
        console.log(`[MonthlyReportService] ⚠️ No emails for ${user.m_bondhu_id}`);
        return { success: false, message: 'No emails' };
      }

      let emailSent = false;
      for (const email of allEmails) {
        try {
          const userForEmail = { ...user, email };
          const sent = await emailService.sendMonthlyReportEmail(userForEmail, reportData);
          if (sent) emailSent = true;
        } catch (err) {
          console.error(`[MonthlyReportService] ❌ Email to ${email}:`, err.message);
        }
      }

      if (emailSent) {
        try {
          const notifTitle = '📅 Monthly Report Available';
          const notifMessage =
            `Your ${reportData.monthLabel} report has been emailed to ${allEmails.length} address${allEmails.length > 1 ? 'es' : ''}. ` +
            `Total usage: ৳${reportData.monthUsageTaka.toFixed(2)}` +
            (reportData.hasUnit ? ` (${reportData.monthUsageUnit.toFixed(2)} kWh).` : '.');

          const notification = await Notification.create({
            m_bondhu_id: user.m_bondhu_id,
            notification_type: 'monthly_report',
            title: notifTitle,
            message: notifMessage,
            data: {
              action: 'monthly_report_sent',
              report_month: reportData.monthKey,
              month_label: reportData.monthLabel,
              month_usage_taka: reportData.monthUsageTaka,
              month_usage_unit: reportData.monthUsageUnit,
              month_recharge_taka: reportData.monthRechargeTaka,
              recharge_energy_amount: reportData.rechargeEnergyAmount,
              recharge_charge_amount: reportData.rechargeChargeAmount,
              recharge_rebate: reportData.rechargeRebate,
              recharge_vat: reportData.rechargeVat,
              recharge_total_charges: reportData.rechargeTotalCharges,
              prev_month_usage_taka: reportData.prevMonthUsageTaka,
              usage_change_pct: reportData.usagePct,
              current_balance: reportData.currentBalance,
              daily_sum_taka: reportData.dailySumTaka,
              daily_sum_unit: reportData.dailySumUnit,
              daily_sum_days: reportData.dailySumDays,
              suggestion_amount: reportData.suggestionData?.suggestedAmount || 0,
              emails_sent_to: allEmails,
              email_count: allEmails.length,
              has_unit: reportData.hasUnit,
              is_system_b: reportData.isSystemB,
              sent_at: new Date().toISOString(),
            },
          });

          if (notification) {
            await Notification.markAsSent(notification.notification_id);
            console.log(`[MonthlyReportService] 🔔 Notification created for ${user.m_bondhu_id}`);
          }
        } catch (notifError) {
          console.error(`[MonthlyReportService] ⚠️ Notification failed:`, notifError.message);
        }
      }

      return { success: emailSent, data: reportData };
    } catch (error) {
      console.error(`[MonthlyReportService] ❌ Build failed:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Build report data for a user ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async buildReportData(user) {
    const meterNo = user.meter_no;
    const accountNo = user.account_no;

    // ─── Determine report month (previous month by default) ──────────
    const today = new Date();
    const reportMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const reportMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthStartStr = this.formatDate(reportMonth);
    const monthEndStr = this.formatDate(reportMonthEnd);
    const monthKey = `${reportMonth.getFullYear()}-${String(reportMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = reportMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    // ─── Previous month (2 months back) ──────────────────────────────
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthLabel = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // ─── 1. PRIMARY: Monthly usage from monthly_consumption ──────────
    const monthRecord = await this.getMonthlyConsumption(meterNo, monthKey);
    const monthUsageTaka = monthRecord?.consumed_taka || 0;
    const monthUsageUnit = monthRecord?.consumed_unit || 0;
    const hasUnit = monthUsageUnit > 0;
    const isSystemB = !hasUnit && monthUsageTaka > 0;

    // ─── 2. SECONDARY: Daily sum (transparency) ──────────────────────
    const dailySum = await this.getDailySumForMonth(meterNo, monthKey);

    // ─── 3. This month's recharge ────────────────────────────────────
    const monthRecharge = await this.getMonthRecharge(accountNo, meterNo, monthStartStr, monthEndStr);
    const monthRechargeTaka = monthRecharge.total;
    const monthRechargeCount = monthRecharge.count;

    // Recharge breakdown
    const rechargeEnergyAmount = monthRecharge.energyAmount;
    const rechargeChargeAmount = monthRecharge.chargeAmount;
    const rechargeRebate = monthRecharge.rebate;
    const rechargeVat = monthRecharge.vat;
    const rechargeTotalCharges = rechargeChargeAmount + rechargeRebate + rechargeVat;

    // ─── 4. Previous month (primary) ─────────────────────────────────
    const prevMonthRecord = await this.getMonthlyConsumption(meterNo, prevMonthKey);
    const prevMonthUsageTaka = prevMonthRecord?.consumed_taka || 0;
    const prevMonthUsageUnit = prevMonthRecord?.consumed_unit || 0;

    // ─── 5. Net ──────────────────────────────────────────────────────
    const netAmount = monthRechargeTaka - monthUsageTaka;

    // ─── 6. Daily stats (avg, highest, lowest, active days) ──────────
    const dailyStats = await this.getDailyStats(meterNo, monthStartStr, monthEndStr);

    // ─── 7. Balance from meter_info ──────────────────────────────────
    const meterInfo = await this.getMeterInfo(meterNo);
    const currentBalance = meterInfo ? parseFloat(meterInfo.current_balance) || 0 : 0;
    const balanceThreshold = parseFloat(user.low_balance_alert_threshold) || 0;
    const daysOfBuffer = dailyStats.avgDailyTaka > 0
      ? Math.floor(currentBalance / dailyStats.avgDailyTaka)
      : 0;

    // ─── 8. Top recharges ────────────────────────────────────────────
    const topRecharges = await this.getTopRecharges(accountNo, meterNo, monthStartStr, monthEndStr, 5);

    // ─── 9. 30-day chart ─────────────────────────────────────────────
    const dailyChart = await this.getDailyChart(meterNo, monthStartStr, monthEndStr);

    // ─── 10. 3-month trend ───────────────────────────────────────────
    const monthlyTrend = await this.getMonthlyTrend(meterNo, monthKey, 3);

    // ─── 11. Suggestion ──────────────────────────────────────────────
    const suggestionData = await this.buildSuggestion(
      meterNo,
      accountNo,
      monthKey,
      currentBalance,
      monthRechargeTaka
    );

    // ─── 12. Usage diff vs previous month ────────────────────────────
    const usageDiff = monthUsageTaka - prevMonthUsageTaka;
    const usagePct = prevMonthUsageTaka > 0 ? (usageDiff / prevMonthUsageTaka) * 100 : 0;

    return {
      reportMonth,
      monthKey,
      monthLabel,

      // PRIMARY: This month (from monthly_consumption)
      monthUsageTaka,
      monthUsageUnit,

      // SECONDARY: Daily sum (from daily_consumption)
      dailySumTaka: dailySum.total_taka,
      dailySumUnit: dailySum.total_unit,
      dailySumFrom: dailySum.first_date,
      dailySumTo: dailySum.last_date,
      dailySumDays: dailySum.days_count,

      // This month recharge
      monthRechargeTaka,
      monthRechargeCount,
      rechargeEnergyAmount,
      rechargeChargeAmount,
      rechargeRebate,
      rechargeVat,
      rechargeTotalCharges,

      // Previous month
      prevMonthLabel,
      prevMonthUsageTaka,
      prevMonthUsageUnit,

      // Net + diff
      netAmount,
      usagePct,

      // Daily stats
      avgDailyTaka: dailyStats.avgDailyTaka,
      avgDailyUnit: dailyStats.avgDailyUnit,
      highestDay: dailyStats.highestDay,
      lowestDay: dailyStats.lowestDay,
      activeDays: dailyStats.activeDays,
      totalDays: dailyStats.totalDays,

      // Balance
      currentBalance,
      balanceThreshold,
      daysOfBuffer,

      // Recharges + chart + trend
      topRecharges,
      dailyChart,
      monthlyTrend,

      // Suggestion
      suggestionData,

      // System
      hasUnit,
      isSystemB,
      meterType: user.meter_type || 'desco',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Data queries ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // ─── PRIMARY: Monthly consumption (from monthly_consumption) ───────────
  async getMonthlyConsumption(meterNo, monthKey) {
    const result = await pool.query(
      `SELECT consumed_unit, consumed_taka 
       FROM monthly_consumption 
       WHERE meter_no = $1 
         AND consumption_month = $2
       LIMIT 1`,
      [meterNo, monthKey]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      consumed_unit: row.consumed_unit !== null ? parseFloat(row.consumed_unit) : 0,
      consumed_taka: row.consumed_taka !== null ? parseFloat(row.consumed_taka) : 0,
    };
  }

  // ─── SECONDARY: Daily sum for a specific month ─────────────────────────
  async getDailySumForMonth(meterNo, monthKey) {
    const [year, month] = monthKey.split('-');
    const firstDay = `${year}-${month}-01`;
    const nextMonthDate = new Date(parseInt(year), parseInt(month), 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const result = await pool.query(
      `SELECT 
         COALESCE(SUM(consumption_unit), 0) AS total_unit,
         COALESCE(SUM(consumption_taka), 0) AS total_taka,
         MIN(consumption_date) AS first_date,
         MAX(consumption_date) AS last_date,
         COUNT(*) AS days_count
       FROM daily_consumption 
       WHERE meter_no = $1 
         AND consumption_date >= $2
         AND consumption_date < $3
         AND consumption_taka IS NOT NULL
         AND consumption_taka > 0`,
      [meterNo, firstDay, nextMonthStr]
    );

    const row = result.rows[0] || {};
    return {
      total_unit: parseFloat(row.total_unit) || 0,
      total_taka: parseFloat(row.total_taka) || 0,
      first_date: row.first_date ? this.formatDate(row.first_date) : null,
      last_date: row.last_date ? this.formatDate(row.last_date) : null,
      days_count: parseInt(row.days_count) || 0,
    };
  }

  // ─── Month recharge total + breakdown ──────────────────────────────────
  async getMonthRecharge(accountNo, meterNo, fromStr, toStr) {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0) AS total,
        COUNT(*) AS count,
        COALESCE(SUM(energy_amount), 0) AS total_energy_amount,
        COALESCE(SUM(charge_amount), 0) AS total_charge_amount,
        COALESCE(SUM(rebate), 0) AS total_rebate,
        COALESCE(SUM(vat), 0) AS total_vat
       FROM recharge_history 
       WHERE account_no = $1 
         AND meter_no = $2
         AND order_status IN ('Execution Successful', 'Successful')
         AND total_amount > 0
         AND recharge_date::date BETWEEN $3 AND $4`,
      [accountNo, meterNo, fromStr, toStr]
    );
    const row = result.rows[0] || {};
    return {
      total: parseFloat(row.total) || 0,
      count: parseInt(row.count) || 0,
      energyAmount: parseFloat(row.total_energy_amount) || 0,
      chargeAmount: parseFloat(row.total_charge_amount) || 0,
      rebate: parseFloat(row.total_rebate) || 0,
      vat: parseFloat(row.total_vat) || 0,
    };
  }

  // ─── Daily stats (avg, highest, lowest, active days) ───────────────────
  async getDailyStats(meterNo, fromStr, toStr) {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(consumption_date, 'YYYY-MM-DD') AS date,
        COALESCE(consumption_taka, 0) AS taka,
        COALESCE(consumption_unit, 0) AS unit
       FROM daily_consumption 
       WHERE meter_no = $1 
         AND consumption_date BETWEEN $2 AND $3
       ORDER BY consumption_date ASC`,
      [meterNo, fromStr, toStr]
    );

    const rows = result.rows.map((r) => ({
      date: r.date,
      taka: parseFloat(r.taka) || 0,
      unit: parseFloat(r.unit) || 0,
    }));

    const valid = rows.filter((r) => r.taka > 0);
    const totalDays = rows.length;

    if (valid.length === 0) {
      return {
        avgDailyTaka: 0,
        avgDailyUnit: 0,
        highestDay: null,
        lowestDay: null,
        activeDays: 0,
        totalDays,
      };
    }

    const totalTaka = valid.reduce((s, r) => s + r.taka, 0);
    const totalUnit = valid.reduce((s, r) => s + r.unit, 0);
    const avgDailyTaka = totalTaka / valid.length;
    const avgDailyUnit = totalUnit / valid.length;

    const sorted = [...valid].sort((a, b) => b.taka - a.taka);
    const highestDay = sorted[0];
    const lowestDay = sorted[sorted.length - 1];

    return {
      avgDailyTaka,
      avgDailyUnit,
      highestDay,
      lowestDay,
      activeDays: valid.length,
      totalDays,
    };
  }

  // ─── Meter info ────────────────────────────────────────────────────────
  async getMeterInfo(meterNo) {
    const result = await pool.query(
      `SELECT current_balance, current_month_consumption 
       FROM meter_info 
       WHERE meter_no = $1 
       LIMIT 1`,
      [meterNo]
    );
    return result.rows[0] || null;
  }

  // ─── Top recharges ─────────────────────────────────────────────────────
  async getTopRecharges(accountNo, meterNo, fromStr, toStr, limit = 5) {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(recharge_date, 'YYYY-MM-DD') AS date,
        total_amount AS amount,
        recharge_operator AS operator
       FROM recharge_history 
       WHERE account_no = $1 
         AND meter_no = $2
         AND order_status IN ('Execution Successful', 'Successful')
         AND total_amount > 0
         AND recharge_date::date BETWEEN $3 AND $4
       ORDER BY total_amount DESC
       LIMIT $5`,
      [accountNo, meterNo, fromStr, toStr, limit]
    );
    return result.rows.map((r) => ({
      date: r.date,
      amount: parseFloat(r.amount) || 0,
      operator: r.operator || 'DESCO',
    }));
  }

  // ─── Daily chart ───────────────────────────────────────────────────────
  async getDailyChart(meterNo, fromStr, toStr) {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(consumption_date, 'YYYY-MM-DD') AS date,
        COALESCE(consumption_taka, 0) AS taka,
        COALESCE(consumption_unit, 0) AS unit
       FROM daily_consumption 
       WHERE meter_no = $1 
         AND consumption_date BETWEEN $2 AND $3
       ORDER BY consumption_date ASC`,
      [meterNo, fromStr, toStr]
    );

    const rows = result.rows.map((r) => ({
      date: r.date,
      taka: parseFloat(r.taka) || 0,
      unit: parseFloat(r.unit) || 0,
    }));

    if (rows.length === 0) return [];

    const maxTaka = Math.max(...rows.map((r) => r.taka));
    const minTaka = Math.min(...rows.filter((r) => r.taka > 0).map((r) => r.taka));

    return rows.map((r) => ({
      ...r,
      isHighest: r.taka === maxTaka && r.taka > 0,
      isLowest: r.taka === minTaka && r.taka > 0,
    }));
  }

  // ─── 3-month trend ─────────────────────────────────────────────────────
  async getMonthlyTrend(meterNo, endMonthKey, count = 3) {
    const [year, month] = endMonthKey.split('-').map(Number);
    const months = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(m);
    }

    const result = await pool.query(
      `SELECT consumption_month, consumed_unit, consumed_taka 
       FROM monthly_consumption 
       WHERE meter_no = $1 
         AND consumption_month = ANY($2::text[])
       ORDER BY consumption_month ASC`,
      [meterNo, months]
    );

    const byMonth = {};
    result.rows.forEach((r) => {
      byMonth[r.consumption_month] = {
        month: r.consumption_month,
        taka: parseFloat(r.consumed_taka) || 0,
        unit: parseFloat(r.consumed_unit) || 0,
      };
    });

    return months.map((m) => byMonth[m] || { month: m, taka: 0, unit: 0 });
  }

  // ─── Suggestion ────────────────────────────────────────────────────────
  async buildSuggestion(meterNo, accountNo, monthKey, currentBalance, alreadyRecharged) {
    // Get last 3 months from monthly_consumption
    const [year, month] = monthKey.split('-').map(Number);
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(m);
    }

    const result = await pool.query(
      `SELECT consumed_taka 
       FROM monthly_consumption 
       WHERE meter_no = $1 
         AND consumption_month = ANY($2::text[])
         AND consumed_taka IS NOT NULL
         AND consumed_taka > 0`,
      [meterNo, months]
    );

    const values = result.rows.map((r) => parseFloat(r.consumed_taka) || 0);
    const avg3Months = values.length > 0
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0;

    if (avg3Months <= 0) {
      return { suggestedAmount: 0, avg3Months: 0, buffer: 0, netNeeded: 0 };
    }

    const buffer = avg3Months * 0.1;
    const target = avg3Months + buffer;
    const netNeeded = Math.max(0, target - currentBalance - alreadyRecharged);
    const suggestedAmount = Math.ceil(netNeeded / 100) * 100;

    return {
      avg3Months,
      buffer,
      target,
      currentBalance,
      alreadyRecharged,
      netNeeded,
      suggestedAmount,
    };
  }

  // ─── Format date ───────────────────────────────────────────────────────
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = new MonthlyReportService();