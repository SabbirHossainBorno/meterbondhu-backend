// src/services/dailyReportService.js
// ═══════════════════════════════════════════════════════════════════════════
// Daily Report Service
// ═══════════════════════════════════════════════════════════════════════════
// Builds + sends daily report emails to all users with daily_report_enabled=true.
// Runs at 8:00 AM Dhaka time via dailyReportScheduler.
//
// ✅ After email sent successfully → inserts notification into
//    user_notifications table so the user sees it in-app.
// ═══════════════════════════════════════════════════════════════════════════

const { pool } = require('../config/database');
const emailService = require('./emailService');
const profileService = require('./profileService');
const Notification = require('../models/Notification');   // ✅ NEW

class DailyReportService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Main: Send daily reports to all eligible users ────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async sendAllDailyReports() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DailyReportService] 📧 Starting daily reports...`);

    try {
      const users = await this.getEligibleUsers();
      console.log(`[${timestamp}] [DailyReportService] 👥 Found ${users.length} users with daily_report_enabled=true`);

      let sentCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          const result = await this.sendDailyReportForUser(user);
          if (result.success) {
            sentCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`[DailyReportService] ❌ ${user.m_bondhu_id}:`, err.message);
        }

        // Rate limit — 1s between users
        await new Promise((r) => setTimeout(r, 1000));
      }

      console.log(`[${timestamp}] [DailyReportService] ✅ Complete: ${sentCount} sent, ${failCount} failed`);
      return { success: true, total: users.length, sentCount, failCount };
    } catch (error) {
      console.error(`[DailyReportService] ❌ Fatal:`, error.message);
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
        daily_report_enabled, email_notification_enabled,
        low_balance_alert_threshold
      FROM user_info
      WHERE is_active = true
        AND is_deleted = false
        AND daily_report_enabled = true
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
  async sendDailyReportForUser(user) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DailyReportService] 📤 Building report for ${user.m_bondhu_id} (${user.meter_no})`);

    try {
      const reportData = await this.buildReportData(user);

      // Send to all alert emails (primary + others)
      const allEmails = await profileService.getAllAlertEmails(user.m_bondhu_id);

      if (!allEmails || allEmails.length === 0) {
        console.log(`[DailyReportService] ⚠️ No emails for ${user.m_bondhu_id}`);
        return { success: false, message: 'No emails' };
      }

      let emailSent = false;

      for (const email of allEmails) {
        try {
          const userForEmail = { ...user, email };
          const sent = await emailService.sendDailyReportEmail(userForEmail, reportData);
          if (sent) emailSent = true;
        } catch (err) {
          console.error(`[DailyReportService] ❌ Email to ${email}:`, err.message);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // ✅ NEW: Insert in-app notification after email sent
      // ═══════════════════════════════════════════════════════════════════
      if (emailSent) {
        try {
          const reportDate = reportData.reportDate;
          const dateLabel = reportDate.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          const notifTitle = '📊 Daily Report Sent';
          const notifMessage =
            `Your daily report for ${dateLabel} has been emailed to ${allEmails.length} address${allEmails.length > 1 ? 'es' : ''}. ` +
            `Yesterday's usage: ৳${reportData.yesterdayUsageTaka.toFixed(2)}` +
            (reportData.hasUnit ? ` (${reportData.yesterdayUsageUnit.toFixed(2)} kWh).` : '.');

          const notification = await Notification.create({
            m_bondhu_id: user.m_bondhu_id,
            notification_type: 'daily_report',
            title: notifTitle,
            message: notifMessage,
            data: {
              action: 'daily_report_sent',
              report_date: this.formatDate(reportDate),
              yesterday_usage_taka: reportData.yesterdayUsageTaka,
              yesterday_usage_unit: reportData.yesterdayUsageUnit,
              has_unit: reportData.hasUnit,
              yesterday_recharge_taka: reportData.yesterdayRechargeTaka,
              yesterday_recharge_count: reportData.yesterdayRechargeCount,
              current_balance: reportData.currentBalance,
              daily_avg_cost: reportData.dailyAvgCost,
              month_usage_taka: reportData.monthUsageTaka,
              month_recharge_taka: reportData.monthRechargeTaka,
              emails_sent_to: allEmails,
              email_count: allEmails.length,
              sent_at: new Date().toISOString(),
            },
          });

          if (notification) {
            await Notification.markAsSent(notification.notification_id);
            console.log(`[DailyReportService] 🔔 Notification created for ${user.m_bondhu_id}`);
          }
        } catch (notifError) {
          console.error(`[DailyReportService] ⚠️ Notification failed for ${user.m_bondhu_id}:`, notifError.message);
          // don't fail the whole flow if notification insert fails
        }
      }

      return { success: emailSent, data: reportData };
    } catch (error) {
      console.error(`[DailyReportService] ❌ Build failed:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Build report data for a user ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async buildReportData(user) {
    const meterNo = user.meter_no;
    const accountNo = user.account_no;

    // ─── Date ranges ─────────────────────────────────────────────────
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = this.formatDate(yesterday);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = this.formatDate(monthStart);
    const todayStr = this.formatDate(today);

    // ─── 1. Yesterday's usage (from DB) ──────────────────────────────
    const yesterdayRecord = await this.getDailyConsumption(meterNo, yesterdayStr);
    const yesterdayUsageTaka = yesterdayRecord ? parseFloat(yesterdayRecord.consumption_taka) || 0 : 0;
    const yesterdayUsageUnit = yesterdayRecord ? parseFloat(yesterdayRecord.consumption_unit) || 0 : 0;
    const hasUnit = yesterdayUsageUnit > 0;

    // ─── 2. Yesterday's recharge ─────────────────────────────────────
    const yesterdayRecharge = await this.getRechargeForDate(accountNo, meterNo, yesterdayStr);
    const yesterdayRechargeTaka = yesterdayRecharge?.total || 0;
    const yesterdayRechargeCount = yesterdayRecharge?.count || 0;

    // ─── 3. Current balance (from meter_info) ────────────────────────
    const meterInfo = await this.getMeterInfo(meterNo);
    const currentBalance = meterInfo ? parseFloat(meterInfo.current_balance) || 0 : 0;

    // ─── 4. Daily avg cost (last 7 days) ─────────────────────────────
    const last7Days = await this.getLast7DaysUsage(meterNo);
    const validDays = last7Days.filter((d) => d.taka > 0);
    const dailyAvgCost = validDays.length > 0
      ? validDays.reduce((s, d) => s + d.taka, 0) / validDays.length
      : 0;
    const avgDailyUnit = validDays.length > 0
      ? validDays.reduce((s, d) => s + (d.unit || 0), 0) / validDays.length
      : 0;

    // ─── 5. Month summary ────────────────────────────────────────────
    const monthSummary = await this.getMonthSummary(accountNo, meterNo, monthStartStr, todayStr);

    // ─── 6. Highest peak (last 30 days) ──────────────────────────────
    const highestPeak = await this.getHighestPeak(meterNo, thirtyDaysAgo, today, yesterdayStr);

    // ─── 7. Balance threshold ────────────────────────────────────────
    const balanceThreshold = parseFloat(user.low_balance_alert_threshold) || 0;

    // ─── 8. System-B detection ───────────────────────────────────────
    const isSystemB = !hasUnit && yesterdayUsageTaka > 0;

    return {
      reportDate: yesterday,
      yesterdayUsageTaka,
      yesterdayUsageUnit,
      hasUnit,
      yesterdayRechargeTaka,
      yesterdayRechargeCount,
      currentBalance,
      balanceThreshold,
      dailyAvgCost,
      avgDailyUnit,
      monthUsageTaka: monthSummary.usageTaka,
      monthUsageUnit: monthSummary.usageUnit,
      monthRechargeTaka: monthSummary.rechargeTaka,
      last7Days,
      highestPeak,
      isSystemB,
      meterType: user.meter_type || 'desco',
    };
  }

  // ─── Get daily consumption for a specific date ─────────────────────────
  async getDailyConsumption(meterNo, dateStr) {
    const result = await pool.query(
      `SELECT consumption_taka, consumption_unit 
       FROM daily_consumption 
       WHERE meter_no = $1 AND consumption_date = $2
       LIMIT 1`,
      [meterNo, dateStr]
    );
    return result.rows[0] || null;
  }

  // ─── Get recharge for a specific date ──────────────────────────────────
  async getRechargeForDate(accountNo, meterNo, dateStr) {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0) AS total,
        COUNT(*) AS count
       FROM recharge_history 
       WHERE account_no = $1 
         AND meter_no = $2
         AND order_status IN ('Execution Successful', 'Successful')
         AND total_amount > 0
         AND recharge_date::date = $3`,
      [accountNo, meterNo, dateStr]
    );
    if (result.rows.length === 0) return { total: 0, count: 0 };
    return {
      total: parseFloat(result.rows[0].total) || 0,
      count: parseInt(result.rows[0].count) || 0,
    };
  }

  // ─── Get meter info ─────────────────────────────────────────────────────
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

  // ─── Get last 7 days usage ─────────────────────────────────────────────
  async getLast7DaysUsage(meterNo) {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(consumption_date, 'YYYY-MM-DD') AS date,
        COALESCE(consumption_taka, 0) AS taka,
        COALESCE(consumption_unit, 0) AS unit
       FROM daily_consumption 
       WHERE meter_no = $1 
         AND consumption_date >= CURRENT_DATE - INTERVAL '7 days'
         AND consumption_date < CURRENT_DATE
       ORDER BY consumption_date ASC`,
      [meterNo]
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.formatDate(yesterday);

    return result.rows.map((r) => ({
      date: r.date,
      taka: parseFloat(r.taka) || 0,
      unit: parseFloat(r.unit) || 0,
      isYesterday: r.date === yesterdayStr,
    }));
  }

  // ─── Get month summary ─────────────────────────────────────────────────
  async getMonthSummary(accountNo, meterNo, monthStart, todayStr) {
    const usageResult = await pool.query(
      `SELECT 
        COALESCE(SUM(consumption_taka), 0) AS usage_taka,
        COALESCE(SUM(consumption_unit), 0) AS usage_unit
       FROM daily_consumption 
       WHERE meter_no = $1 
         AND consumption_date BETWEEN $2 AND $3`,
      [meterNo, monthStart, todayStr]
    );

    const rechargeResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS recharge_taka
       FROM recharge_history 
       WHERE account_no = $1 
         AND meter_no = $2
         AND order_status IN ('Execution Successful', 'Successful')
         AND total_amount > 0
         AND recharge_date::date BETWEEN $3 AND $4`,
      [accountNo, meterNo, monthStart, todayStr]
    );

    return {
      usageTaka: parseFloat(usageResult.rows[0]?.usage_taka) || 0,
      usageUnit: parseFloat(usageResult.rows[0]?.usage_unit) || 0,
      rechargeTaka: parseFloat(rechargeResult.rows[0]?.recharge_taka) || 0,
    };
  }

  // ─── Get highest peak (last 30 days) ──────────────────────────────────
  async getHighestPeak(meterNo, fromDate, toDate, yesterdayStr) {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(consumption_date, 'YYYY-MM-DD') AS date,
        COALESCE(consumption_taka, 0) AS taka,
        COALESCE(consumption_unit, 0) AS unit
       FROM daily_consumption 
       WHERE meter_no = $1 
         AND consumption_date BETWEEN $2 AND $3
         AND consumption_taka IS NOT NULL
         AND consumption_taka > 0
       ORDER BY consumption_taka DESC
       LIMIT 1`,
      [meterNo, this.formatDate(fromDate), this.formatDate(toDate)]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      date: row.date,
      taka: parseFloat(row.taka) || 0,
      unit: parseFloat(row.unit) || 0,
      isYesterday: row.date === yesterdayStr,
    };
  }

  // ─── Format date to "YYYY-MM-DD" ──────────────────────────────────────
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = new DailyReportService();