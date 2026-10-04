// src/services/alertService.js - সম্পূর্ণ আপডেটেড (Projected Balance সহ)

const { pool } = require('../config/database');
const DescoService = require('./descoService');
const emailService = require('./emailService');
const Notification = require('../models/Notification');
const AlertLog = require('../models/AlertLog');
const User = require('../models/User');
const Meter = require('../models/Meter');

class AlertService {
  constructor() {
    this.alertStatus = {};
    this.lastCheckTime = {};
    this.alertCounts = {};
    this.lastAlertReset = {};
  }

  // ─── Reset Daily Counters ─────────────────────────────────────────────
  resetDailyCounters() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AlertService] 🔄 Resetting daily counters...`);
    this.alertCounts = {};
    this.lastAlertReset = {};
  }

  // ─── Main Alert Check Function (Hourly) ────────────────────────────────
  async checkLowBalanceAlerts() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AlertService] 🔍 Running hourly alert check...`);
    
    try {
      const users = await this.getActiveUsers();
      console.log(`[${timestamp}] [AlertService] 👥 Found ${users.length} active users`);
      
      let alertCount = 0;
      let errorCount = 0;
      
      for (const user of users) {
        try {
          const result = await this.processUserAlert(user, 'hourly');
          if (result) alertCount++;
        } catch (error) {
          errorCount++;
          console.error(`[${timestamp}] [AlertService] ❌ Error for ${user.m_bondhu_id}:`, error.message);
        }
      }
      
      console.log(`[${timestamp}] [AlertService] ✅ Hourly check: ${alertCount} alerts sent, ${errorCount} errors`);
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Check failed:`, error.message);
    }
  }

  // ─── Critical Alert Check (Every 10 min) ───────────────────────────────
  async checkCriticalAlerts() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AlertService] 🔴 Running critical alert check...`);
    
    try {
      const users = await this.getActiveUsers();
      let alertCount = 0;
      
      for (const user of users) {
        try {
          const result = await this.processUserAlert(user, 'critical');
          if (result) alertCount++;
        } catch (error) {
          console.error(`[${timestamp}] [AlertService] ❌ Error for ${user.m_bondhu_id}:`, error.message);
        }
      }
      
      if (alertCount > 0) {
        console.log(`[${timestamp}] [AlertService] ✅ Critical check: ${alertCount} alerts sent`);
      }
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Critical check failed:`, error.message);
    }
  }

  // ─── Get Active Users ────────────────────────────────────────────────────
  async getActiveUsers() {
    const query = `
      SELECT * FROM user_info 
      WHERE is_active = true 
      AND is_deleted = false
      AND low_balance_alert_threshold IS NOT NULL
      AND low_balance_alert_threshold > 0
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // ─── Get Today's Total Recharge ─────────────────────────────────────────
async getTodayRecharge(user) {
  const timestamp = new Date().toISOString();
  try {
    const query = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_amount,
        COUNT(*) as recharge_count,
        MAX(recharge_date) as last_recharge_time,
        COALESCE(SUM(energy_amount), 0) as total_energy
      FROM recharge_history 
      WHERE account_no = $1 
      AND meter_no = $2
      AND order_status = 'Execution Successful'
      AND total_amount > 0
      AND recharge_date::date = CURRENT_DATE
    `;
    const result = await pool.query(query, [user.account_no, user.meter_no]);
    
    const totalAmount = parseFloat(result.rows[0]?.total_amount) || 0;
    const count = parseInt(result.rows[0]?.recharge_count) || 0;
    const lastTime = result.rows[0]?.last_recharge_time;
    const totalEnergy = parseFloat(result.rows[0]?.total_energy) || 0;
    
    console.log(`[${timestamp}] [AlertService] 💰 Today's recharge: ৳${totalAmount.toFixed(2)} (${count} transactions)`);
    
    if (count > 0) {
      return {
        totalAmount,
        count,
        lastRechargeTime: lastTime,
        totalEnergy,
        hasRecharged: true
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[${timestamp}] [AlertService] ❌ Error:`, error.message);
    return null;
  }
}

  // ─── Get Recent Recharge (Last 24 hours) ────────────────────────────────
  async getRecentRecharge(user) {
    const timestamp = new Date().toISOString();
    try {
      const query = `
        SELECT * FROM recharge_history 
        WHERE account_no = $1 
        AND meter_no = $2
        AND order_status = 'Execution Successful'
        AND total_amount > 0
        AND recharge_date > NOW() - INTERVAL '24 hours'
        ORDER BY recharge_date DESC 
        LIMIT 1
      `;
      const result = await pool.query(query, [user.account_no, user.meter_no]);
      
      if (result.rows.length > 0) {
        const recharge = result.rows[0];
        console.log(`[${timestamp}] [AlertService] 💰 Recent recharge: ৳${recharge.total_amount} on ${recharge.recharge_date}`);
        return recharge;
      }
      
      return null;
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Error:`, error.message);
      return null;
    }
  }

  // ─── Process Single User Alert ──────────────────────────────────────────
  async processUserAlert(user, trigger = 'hourly') {
    const timestamp = new Date().toISOString();
    const today = new Date();
    const userKey = `user_${user.m_bondhu_id}`;
    
    try {
      // ─── Reset alert count if new day ──────────────────────────────────
      const todayStr = today.toISOString().split('T')[0];
      const lastResetStr = this.lastAlertReset[userKey] || '';
      if (lastResetStr !== todayStr) {
        this.alertCounts[userKey] = 0;
        this.lastAlertReset[userKey] = todayStr;
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // STEP 1: Get current balance
      // ═══════════════════════════════════════════════════════════════════════
      const balance = await this.getUserBalanceDirect(user);
      
      if (balance === null || balance === undefined) {
        console.log(`[${timestamp}] [AlertService] ⚠️ No balance for ${user.full_name}, skipping`);
        return false;
      }
      
      console.log(`[${timestamp}] [AlertService] 👤 ${user.full_name}: Balance = ৳${balance.toFixed(2)}`);
      
      const threshold = parseFloat(user.low_balance_alert_threshold);
      
      // ═══════════════════════════════════════════════════════════════════════
      // STEP 2: Check if balance is safe
      // ═══════════════════════════════════════════════════════════════════════
      if (balance > threshold) {
        await this.resolveAlert(user.m_bondhu_id);
        this.alertCounts[userKey] = 0;
        console.log(`[${timestamp}] [AlertService] ✅ Balance is safe (৳${balance.toFixed(2)} > ৳${threshold})`);
        return false;
      }
      
      console.log(`[${timestamp}] [AlertService] ⚠️ Low balance! ৳${balance.toFixed(2)} < ৳${threshold}`);
      
      // ═══════════════════════════════════════════════════════════════════════
      // STEP 3: CHECK PROJECTED BALANCE
      // ═══════════════════════════════════════════════════════════════════════
      const recentRecharge = await this.getRecentRecharge(user);
      let projectedBalanceInfo = null;
      
      if (recentRecharge) {
        console.log(`[${timestamp}] [AlertService] 💰 Recent recharge found: ৳${recentRecharge.total_amount}`);
        
        const dailyAvgCost = await this.calculateDailyAvgCost(user);
        const energyPercentage = await this.getAverageEnergyPercentage(user);
        
        const rechargeEnergy = parseFloat(recentRecharge.total_amount) * energyPercentage;
        const projectedBalance = balance + rechargeEnergy - dailyAvgCost;
        
        projectedBalanceInfo = {
          currentBalance: balance,
          rechargeAmount: parseFloat(recentRecharge.total_amount),
          rechargeEnergy: rechargeEnergy,
          dailyAvgCost: dailyAvgCost,
          projectedBalance: projectedBalance,
          energyPercentage: energyPercentage,
          threshold: threshold,
          rechargeDate: recentRecharge.recharge_date,
          isSafe: projectedBalance > threshold,
        };
        
        console.log(`[${timestamp}] [AlertService] ═══════════════════════════════════════`);
        console.log(`[${timestamp}] [AlertService] 📊 PROJECTED BALANCE:`);
        console.log(`  • Current Balance: ৳${balance.toFixed(2)}`);
        console.log(`  • Last Recharge: ৳${recentRecharge.total_amount}`);
        console.log(`  • Energy Received: ৳${rechargeEnergy.toFixed(2)} (${(energyPercentage * 100).toFixed(1)}%)`);
        console.log(`  • Daily Avg: ৳${dailyAvgCost.toFixed(2)}`);
        console.log(`  • Projected: ৳${projectedBalance.toFixed(2)}`);
        console.log(`  • Threshold: ৳${threshold}`);
        console.log(`  • Is Safe: ${projectedBalance > threshold ? 'YES ✅' : 'NO ⚠️'}`);
        console.log(`[${timestamp}] [AlertService] ═══════════════════════════════════════`);
        
        if (projectedBalance > threshold) {
          await this.resolveAlert(user.m_bondhu_id);
          this.alertCounts[userKey] = 0;
          console.log(`[${timestamp}] [AlertService] ✅ STOPPING ALERTS: Projected balance (৳${projectedBalance.toFixed(2)}) > Threshold (৳${threshold})`);
          return false;
        } else {
          console.log(`[${timestamp}] [AlertService] ⚠️ CONTINUING: Even after recharge, projected balance (৳${projectedBalance.toFixed(2)}) ≤ Threshold (৳${threshold})`);
        }
      } else {
        console.log(`[${timestamp}] [AlertService] ℹ️ No recent recharge found`);
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // STEP 4: Determine alert type and send
      // ═══════════════════════════════════════════════════════════════════════
      const dailyAvgCost = await this.calculateDailyAvgCost(user);
      const isCritical = balance < dailyAvgCost;
      
      let shouldSend = false;
      let alertType = 'normal';
      
      if (trigger === 'critical' && isCritical) {
        const alertCount = this.alertCounts[userKey] || 0;
        if (alertCount < 6) {
          shouldSend = true;
          alertType = 'critical';
          this.alertCounts[userKey] = alertCount + 1;
          console.log(`[${timestamp}] [AlertService] 🔴 CRITICAL: ${alertCount + 1}/6 this hour`);
        }
      } else if (trigger === 'hourly' || trigger === 'force') {
        const existingAlert = await this.getExistingAlert(user.m_bondhu_id);
        const currentHour = today.getHours();
        
        if (trigger === 'force') {
          shouldSend = true;
        } else {
          shouldSend = this.shouldSendNotification(existingAlert, currentHour);
        }
        
        alertType = isCritical ? 'critical' : 'normal';
      }
      
      if (shouldSend) {
        const rechargeData = await this.calculateRequiredRecharge(user);
        const sent = await this.sendAlertNotification(
          user, 
          balance, 
          threshold, 
          dailyAvgCost, 
          rechargeData,
          alertType,
          projectedBalanceInfo  // ← পাস করুন
        );
        return sent;
      }
      
      return false;
      
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Error for ${user.m_bondhu_id}:`, error.message);
      return false;
    }
  }

  // ─── Get Last 3 Months Usage Data ──────────────────────────────────────
  async getLastThreeMonthsUsage(user) {
    const timestamp = new Date().toISOString();
    try {
      const today = new Date();
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      
      const monthFrom = threeMonthsAgo.toISOString().split('T')[0].slice(0, 7);
      const monthTo = today.toISOString().split('T')[0].slice(0, 7);
      
      console.log(`[${timestamp}] [AlertService] 📊 Fetching last 3 months: ${monthFrom} to ${monthTo}`);
      
      const response = await DescoService.getMonthlyConsumption(
        user.account_no,
        user.meter_no,
        monthFrom,
        monthTo
      );
      
      let monthlyData = [];
      
      if (response && response.success && response.data) {
        monthlyData = response.data;
      } else if (response && response.data && Array.isArray(response.data)) {
        monthlyData = response.data;
      } else if (Array.isArray(response)) {
        monthlyData = response;
      }
      
      if (monthlyData.length > 0) {
        const validData = monthlyData.filter(item => item.consumedTaka > 0);
        
        if (validData.length > 0) {
          const lastThree = validData.slice(-3);
          
          console.log(`[${timestamp}] [AlertService] 📊 Last 3 months energy:`);
          lastThree.forEach(item => {
            console.log(`  • ${item.month}: ৳${item.consumedTaka}`);
          });
          
          const totalEnergy = lastThree.reduce((sum, item) => sum + (item.consumedTaka || 0), 0);
          const averageEnergy = totalEnergy / lastThree.length;
          
          console.log(`[${timestamp}] [AlertService] 📊 Avg Energy: ৳${averageEnergy.toFixed(2)}`);
          
          return {
            months: lastThree,
            totalEnergy: totalEnergy,
            averageEnergy: averageEnergy,
            count: lastThree.length,
            hasData: true
          };
        }
      }
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Error:`, error.message);
    }
    
    return {
      months: [],
      totalEnergy: 0,
      averageEnergy: 1521,
      count: 0,
      hasData: false
    };
  }

  // ─── Get Average Energy Percentage ──────────────────────────────────────
  async getAverageEnergyPercentage(user) {
    const timestamp = new Date().toISOString();
    try {
      const query = `
        SELECT AVG(energy_amount / total_amount) as avg_energy_percentage
        FROM recharge_history 
        WHERE account_no = $1 
        AND meter_no = $2
        AND order_status = 'Execution Successful'
        AND total_amount > 0
      `;
      const result = await pool.query(query, [user.account_no, user.meter_no]);
      const avgPercentage = parseFloat(result.rows[0]?.avg_energy_percentage) || 0.803;
      console.log(`[${timestamp}] [AlertService] 📊 Energy %: ${(avgPercentage * 100).toFixed(1)}%`);
      return avgPercentage;
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Error:`, error.message);
      return 0.803;
    }
  }

  // ─── Get Current Month Recharge ──────────────────────────────────────────
  async getCurrentMonthRecharge(user) {
    const timestamp = new Date().toISOString();
    try {
      const query = `
        SELECT COALESCE(SUM(total_amount), 0) as total_recharge 
        FROM recharge_history 
        WHERE account_no = $1 
        AND meter_no = $2
        AND order_status = 'Execution Successful'
        AND recharge_date >= DATE_TRUNC('month', CURRENT_DATE)
      `;
      const result = await pool.query(query, [user.account_no, user.meter_no]);
      const total = parseFloat(result.rows[0]?.total_recharge) || 0;
      console.log(`[${timestamp}] [AlertService] 💰 Current month: ৳${total.toFixed(2)}`);
      return total;
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Error:`, error.message);
      return 0;
    }
  }

  // ─── Calculate Required Recharge ──────────────────────────────────────────
  async calculateRequiredRecharge(user) {
    const timestamp = new Date().toISOString();
    
    try {
      const usageData = await this.getLastThreeMonthsUsage(user);
      const avgEnergyNeeded = usageData.hasData ? usageData.averageEnergy : 1521;
      
      const avgEnergyPercentage = await this.getAverageEnergyPercentage(user);
      const currentMonthRecharge = await this.getCurrentMonthRecharge(user);
      const currentMonthEnergy = currentMonthRecharge * avgEnergyPercentage;
      
      const netEnergyNeeded = Math.max(0, avgEnergyNeeded - currentMonthEnergy);
      const totalRechargeNeeded = netEnergyNeeded / avgEnergyPercentage;
      const suggestionAmount = Math.ceil(totalRechargeNeeded / 100) * 100;
      
      const monthlyBreakdown = usageData.months.map(item => ({
        month: item.month,
        energyAmount: item.consumedTaka
      }));
      
      console.log(`[${timestamp}] [AlertService] 📊 Suggestion: ৳${suggestionAmount}`);
      
      return {
        avgEnergyNeeded,
        currentMonthRecharge,
        currentMonthEnergy,
        netEnergyNeeded,
        totalRechargeNeeded,
        suggestionAmount,
        avgEnergyPercentage,
        monthlyBreakdown,
        usageData,
        hasData: usageData.hasData
      };
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Error:`, error.message);
      return {
        avgEnergyNeeded: 1521,
        currentMonthRecharge: 0,
        currentMonthEnergy: 0,
        netEnergyNeeded: 1521,
        totalRechargeNeeded: 1894,
        suggestionAmount: 1900,
        avgEnergyPercentage: 0.803,
        monthlyBreakdown: [],
        usageData: { months: [], totalEnergy: 0, averageEnergy: 1521, count: 0, hasData: false },
        hasData: false
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
// ─── Calculate Daily Average Cost (HYBRID) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// Strategy:
//   1. Check DB freshness (latest consumption_date for this meter)
//   2. If fresh (≤ 2 days old) → read from DB (fast, no API spam)
//   3. If stale (> 2 days old) → fetch from DESCO live API (fallback)
//   4. If DESCO fails → fall back to DB anyway (stale > nothing)
//   5. If everything fails → return ৳50 default
//
// Freshness threshold = 2 days (NOT 1):
//   Cron runs at 8:05 AM Dhaka time and fetches YESTERDAY's data.
//   So between midnight and 8:05 AM, the latest row in DB is
//   naturally ~2 days old — this is NORMAL, not stale.
//   Only when cron fails for 2+ consecutive days do we hit DESCO.
//
// Window: last 7 days (matching alertService policy)
//
// NOTE on DESCO data:
//   DESCO returns CUMULATIVE consumedTaka/consumedUnit.
//   N raw rows → (N-1) daily deltas. First row = baseline only.
//
// NOTE on DB data:
//   daily_consumption.consumption_taka is ALREADY daily delta.
//   Just sum + divide by row count.
// ═══════════════════════════════════════════════════════════════════════════
async calculateDailyAvgCost(user) {
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] [AlertService] ═══════════════════════════════════════`);
  console.log(`[${timestamp}] [AlertService] 📊 calculateDailyAvgCost START`);
  console.log(`[${timestamp}] [AlertService] 📊 Meter: ${user.meter_no} | Account: ${user.account_no}`);
  console.log(`[${timestamp}] [AlertService] ═══════════════════════════════════════`);

  try {
    // ═══════════════════════════════════════════════════════════════════════
// STEP 1 — Check DB freshness (timezone-safe via Postgres date math)
// ═══════════════════════════════════════════════════════════════════════
// এখানে JS Date parsing সম্পূর্ণ avoided:
//   • TO_CHAR(...) → "YYYY-MM-DD" string (কোনো timezone shift নেই)
//   • (CURRENT_DATE - MAX(...)) → সরাসরি integer দিনসংখ্যা
// ═══════════════════════════════════════════════════════════════════════
const freshnessQuery = `
  SELECT
    TO_CHAR(MAX(consumption_date), 'YYYY-MM-DD') AS latest_date,
    COUNT(*)                                      AS total_rows,
    (CURRENT_DATE - MAX(consumption_date))        AS days_old
  FROM daily_consumption
  WHERE meter_no = $1
    AND consumption_taka IS NOT NULL
    AND consumption_taka > 0
`;

const freshnessResult = await pool.query(freshnessQuery, [user.meter_no]);
const latestDate = freshnessResult.rows[0]?.latest_date;   // already "YYYY-MM-DD" string
const totalRows = parseInt(freshnessResult.rows[0]?.total_rows) || 0;
const rawDaysOld = freshnessResult.rows[0]?.days_old;
const daysOld = rawDaysOld === null || rawDaysOld === undefined
  ? 999
  : parseInt(rawDaysOld);

console.log(`[${timestamp}] [AlertService] 📊 DB Freshness Check:`);
console.log(`  • Latest date in DB: ${latestDate || 'none'}`);   // ← সরাসরি string print
console.log(`  • Days old:          ${daysOld === 999 ? 'N/A (no data)' : daysOld}`);
console.log(`  • Total rows:        ${totalRows}`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — Decide which source to use
    // ═══════════════════════════════════════════════════════════════════════
    // Cron runs at 8:05 AM Dhaka time and fetches YESTERDAY's data.
    // So the "natural" daysOld value oscillates between 1 and 2:
    //   • After 8:05 AM → latest = yesterday → daysOld = 1
    //   • Before 8:05 AM → latest = day-before-yesterday → daysOld = 2
    // Threshold = 2 means both are considered "fresh".
    // daysOld ≥ 3 → cron has failed for 2+ days → hit DESCO.
    const DB_FRESH_THRESHOLD_DAYS = 2;
    const dbIsFresh = daysOld <= DB_FRESH_THRESHOLD_DAYS;

    if (dbIsFresh) {
      console.log(`[${timestamp}] [AlertService] ✅ DB is FRESH (daysOld=${daysOld} ≤ ${DB_FRESH_THRESHOLD_DAYS}) → using DB path`);
      console.log(`[${timestamp}] [AlertService] ═══════════════════════════════════════`);

      const dbAvg = await this._getDailyAvgFromDB(user);
      console.log(`[${timestamp}] [AlertService] 📊 Result (DB): ৳${dbAvg.toFixed(2)}/day`);
      return dbAvg;
    }

    console.log(`[${timestamp}] [AlertService] ⚠️ DB is STALE (${daysOld} days old > ${DB_FRESH_THRESHOLD_DAYS}) → trying DESCO`);
    console.log(`[${timestamp}] [AlertService] ═══════════════════════════════════════`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3 — DESCO live API path (fallback when DB is stale)
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const descoAvg = await this._getDailyAvgFromDESCO(user);
      console.log(`[${timestamp}] [AlertService] ✅ DESCO path succeeded`);
      console.log(`[${timestamp}] [AlertService] 📊 Result (DESCO): ৳${descoAvg.toFixed(2)}/day`);
      return descoAvg;

    } catch (descoError) {
      console.error(`[${timestamp}] [AlertService] ❌ DESCO path FAILED: ${descoError.message}`);
      console.log(`[${timestamp}] [AlertService] 🔄 Falling back to DB anyway (stale > nothing)...`);

      // ═══════════════════════════════════════════════════════════════════
      // STEP 4 — Emergency DB fallback (even if stale)
      // ═══════════════════════════════════════════════════════════════════
      try {
        const dbAvg = await this._getDailyAvgFromDB(user);
        console.log(`[${timestamp}] [AlertService] ⚠️ Using STALE DB data: ৳${dbAvg.toFixed(2)}/day`);
        return dbAvg;
      } catch (dbError) {
        console.error(`[${timestamp}] [AlertService] ❌ DB fallback also failed: ${dbError.message}`);
        console.log(`[${timestamp}] [AlertService] 🚨 Everything failed → default ৳50/day`);
        return 50;
      }
    }

  } catch (error) {
    console.error(`[${timestamp}] [AlertService] ❌ calculateDailyAvgCost FATAL:`, error.message);
    console.log(`[${timestamp}] [AlertService] 🚨 Returning default ৳50/day`);
    return 50;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Helper 1: DB path (fast, primary) ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// daily_consumption.consumption_taka is ALREADY daily delta — no math needed.
// ═══════════════════════════════════════════════════════════════════════════
async _getDailyAvgFromDB(user) {
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] [AlertService] 📂 [DB PATH] Querying daily_consumption...`);

  const query = `
    SELECT
      TO_CHAR(consumption_date, 'YYYY-MM-DD') AS date,
      consumption_taka,
      consumption_unit
    FROM daily_consumption
    WHERE meter_no = $1
      AND consumption_date >= CURRENT_DATE - INTERVAL '7 days'
      AND consumption_date <= CURRENT_DATE
      AND consumption_taka IS NOT NULL
      AND consumption_taka > 0
    ORDER BY consumption_date ASC
  `;

  const result = await pool.query(query, [user.meter_no]);

  console.log(`[${timestamp}] [AlertService] 📂 [DB PATH] Rows fetched: ${result.rows.length}`);

  if (result.rows.length === 0) {
    console.log(`[${timestamp}] [AlertService] 📂 [DB PATH] ⚠️ No rows in last 7 days`);
    throw new Error('No daily consumption data in DB for last 7 days');
  }

  // ─── Log each day (already delta) ────────────────────────────────────
  result.rows.forEach((r) => {
    console.log(
      `  • ${r.date}: ৳${parseFloat(r.consumption_taka).toFixed(2)} ` +
      `(${parseFloat(r.consumption_unit).toFixed(2)} kWh)`
    );
  });

  // ─── Sum + divide (no delta math — already delta) ────────────────────
  const takas = result.rows.map((r) => parseFloat(r.consumption_taka) || 0);
  const totalCost = takas.reduce((sum, v) => sum + v, 0);
  const daysCount = takas.length;
  const dailyAvgCost = totalCost / daysCount;

  console.log(`[${timestamp}] [AlertService] 📂 [DB PATH] Calculation:`);
  console.log(`  • Total Cost: ৳${totalCost.toFixed(2)}`);
  console.log(`  • Days Count: ${daysCount}`);
  console.log(`  • Daily Avg:  ৳${dailyAvgCost.toFixed(2)}`);

  return dailyAvgCost;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Helper 2: DESCO path (slow, fallback when DB stale) ────────────────
// ═══════════════════════════════════════════════════════════════════════════
// DESCO API returns CUMULATIVE consumedTaka/consumedUnit.
// N rows → (N-1) daily deltas. First row is baseline only.
// ═══════════════════════════════════════════════════════════════════════════
async _getDailyAvgFromDESCO(user) {
  const timestamp = new Date().toISOString();

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const dateFrom = sevenDaysAgo.toISOString().split('T')[0];
  const dateTo = today.toISOString().split('T')[0];

  console.log(`[${timestamp}] [AlertService] 🌐 [DESCO PATH] Fetching: ${dateFrom} to ${dateTo}`);

  const response = await DescoService.getDailyConsumption(
    user.account_no,
    user.meter_no,
    dateFrom,
    dateTo
  );

  // ─── Normalize response shape ────────────────────────────────────────
  let rawData = [];
  if (response?.success && response.data) {
    rawData = response.data;
  } else if (response?.data && Array.isArray(response.data)) {
    rawData = response.data;
  } else if (Array.isArray(response)) {
    rawData = response;
  }

  console.log(`[${timestamp}] [AlertService] 🌐 [DESCO PATH] Raw records: ${rawData.length}`);

  if (rawData.length === 0) {
    throw new Error('DESCO returned 0 records');
  }

  // ─── Sort ascending by date ──────────────────────────────────────────
  const sortedData = [...rawData].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  console.log(`[${timestamp}] [AlertService] 🌐 [DESCO PATH] Sorted ${sortedData.length} records`);
  console.log(
    `[${timestamp}] [AlertService] 🌐 [DESCO PATH] Baseline (${sortedData[0].date}): ` +
    `৳${sortedData[0].consumedTaka.toFixed(2)} (cumulative — not counted)`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Compute deltas — SKIP first row (baseline)
  // ═══════════════════════════════════════════════════════════════════════
  const dailyValues = [];

  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i];
    const previous = sortedData[i - 1];

    let dailyTaka;
    let dailyUnit;

    // ─── Taka delta (handle reset) ─────────────────────────────────────
    if (current.consumedTaka >= previous.consumedTaka) {
      dailyTaka = current.consumedTaka - previous.consumedTaka;
    } else {
      dailyTaka = current.consumedTaka;
      console.log(`[${timestamp}] [AlertService] 🔄 Taka reset on ${current.date}`);
    }

    // ─── Unit delta (handle reset) ─────────────────────────────────────
    if (current.consumedUnit >= previous.consumedUnit) {
      dailyUnit = current.consumedUnit - previous.consumedUnit;
    } else {
      dailyUnit = current.consumedUnit;
      console.log(`[${timestamp}] [AlertService] 🔄 Unit reset on ${current.date}`);
    }

    // ─── Skip negatives ────────────────────────────────────────────────
    if (dailyTaka < 0 || dailyUnit < 0) {
      console.log(`[${timestamp}] [AlertService] ⚠️ Negative daily on ${current.date}, skipping`);
      continue;
    }

    dailyValues.push({
      date: current.date,
      consumedTaka: dailyTaka,
      consumedUnit: dailyUnit,
    });

    console.log(
      `[${timestamp}] [AlertService] 📊 ${current.date}: ` +
      `৳${dailyTaka.toFixed(2)} (${dailyUnit.toFixed(2)} kWh)`
    );
  }

  // ─── Filter out zero-consumption days ────────────────────────────────
  const validDailyValues = dailyValues.filter((item) => item.consumedTaka > 0);

  if (validDailyValues.length === 0) {
    throw new Error('DESCO returned no valid daily deltas after processing');
  }

  // ─── Sum + divide ────────────────────────────────────────────────────
  const totalCost = validDailyValues.reduce((sum, item) => sum + item.consumedTaka, 0);
  const daysCount = validDailyValues.length;
  const dailyAvgCost = totalCost / daysCount;

  console.log(`[${timestamp}] [AlertService] 🌐 [DESCO PATH] Calculation:`);
  console.log(`  • Total Cost: ৳${totalCost.toFixed(2)}`);
  console.log(`  • Days Count: ${daysCount}`);
  console.log(`  • Daily Avg:  ৳${dailyAvgCost.toFixed(2)}`);

  return dailyAvgCost;
}

  // ─── Get User Balance Direct ──────────────────────────────────────────
  async getUserBalanceDirect(user) {
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`[${timestamp}] [AlertService] 💰 Fetching balance for ${user.account_no}...`);
      
      const meters = await Meter.findByUserSerial(user.serial);
      const meter = meters[0];
      
      if (!meter) {
        console.log(`[${timestamp}] [AlertService] ⚠️ No meter found`);
        return 999999;
      }
      
      const response = await DescoService.getBalance(user.account_no, user.meter_no);
      
      if (response && response.success && response.data) {
        const balance = parseFloat(response.data.balance) || 0;
        console.log(`[${timestamp}] [AlertService] ✅ Balance: ৳${balance.toFixed(2)}`);
        return balance;
      }
      
      if (response && response.balance !== undefined) {
        const balance = parseFloat(response.balance) || 0;
        console.log(`[${timestamp}] [AlertService] ✅ Balance: ৳${balance.toFixed(2)}`);
        return balance;
      }
      
      return 999999;
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Failed:`, error.message);
      return 999999;
    }
  }

  // ─── Get Existing Alert ──────────────────────────────────────────────────
  async getExistingAlert(mBondhuId) {
    const query = `
      SELECT * FROM alert_logs 
      WHERE m_bondhu_id = $1 
      AND is_resolved = false 
      AND alert_type IN ('low_balance', 'critical_low_balance')
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(query, [mBondhuId]);
    return result.rows[0] || null;
  }

  // ─── Should Send Notification ───────────────────────────────────────────
  shouldSendNotification(existingAlert, currentHour) {
    const TEST_MODE = true;
    const TEST_INTERVAL_MINUTES = 1;
    const PRODUCTION_INTERVAL_MINUTES = 60;
    
    const requiredMinutes = TEST_MODE ? TEST_INTERVAL_MINUTES : PRODUCTION_INTERVAL_MINUTES;
    
    if (!existingAlert) return true;
    if (!existingAlert.notification_sent) return true;
    if (!existingAlert.notification_sent_at) return true;
    
    const lastSent = new Date(existingAlert.notification_sent_at);
    const now = new Date();
    const diffMinutes = (now - lastSent) / (1000 * 60);
    
    console.log(`[AlertService] ⏰ Time since last: ${diffMinutes.toFixed(1)} min (Required: ${requiredMinutes} min)`);
    
    return diffMinutes >= requiredMinutes;
  }

  // ─── Resolve Alert ──────────────────────────────────────────────────────
  async resolveAlert(mBondhuId) {
    const query = `
      UPDATE alert_logs 
      SET is_resolved = true, resolved_at = CURRENT_TIMESTAMP 
      WHERE m_bondhu_id = $1 
      AND is_resolved = false 
      AND alert_type IN ('low_balance', 'critical_low_balance')
    `;
    await pool.query(query, [mBondhuId]);
  }

  // ─── Send Alert Notification (Email + Push + In-App) ────────────────────
  async sendAlertNotification(user, balance, threshold, dailyAvgCost, rechargeData, alertType = 'normal', projectedBalanceInfo = null) {
    const timestamp = new Date().toISOString();
    
    try {
      const meters = await Meter.findByUserSerial(user.serial);
      const meter = meters[0] || {};
      
      const isCritical = balance < dailyAvgCost;
      const title = isCritical ? '🔴 CRITICAL: Low Balance Alert' : '⚠️ Low Balance Alert';
      
      let urgencyMessage = '';
      if (isCritical) {
        urgencyMessage = `\n\n⚠️ Your current balance (৳${balance.toFixed(2)}) is less than your daily average consumption (৳${dailyAvgCost.toFixed(2)}). Your electricity may run out within the next 1-2 hours! Please recharge immediately.`;
      } else {
        const daysLeft = Math.floor(balance / dailyAvgCost);
        urgencyMessage = `\n\n⏳ Your current balance (৳${balance.toFixed(2)}) will last approximately ${daysLeft} day(s) at your current usage rate (৳${dailyAvgCost.toFixed(2)}/day).`;
      }
      
      // ─── Add projected balance explanation ────────────────────────────
      let projectedMessage = '';
      if (projectedBalanceInfo && !projectedBalanceInfo.isSafe) {
        projectedMessage = `\n\n📊 Why This Alert Was Sent Even After Recharge:\n`;
        projectedMessage += `• Current Balance: ৳${projectedBalanceInfo.currentBalance.toFixed(2)}\n`;
        projectedMessage += `• Last Recharge: ৳${projectedBalanceInfo.rechargeAmount.toFixed(2)}\n`;
        projectedMessage += `• Energy Received: ৳${projectedBalanceInfo.rechargeEnergy.toFixed(2)} (${(projectedBalanceInfo.energyPercentage * 100).toFixed(1)}%)\n`;
        projectedMessage += `• Daily Avg Consumption: ৳${projectedBalanceInfo.dailyAvgCost.toFixed(2)}\n`;
        projectedMessage += `• Projected Balance: ৳${projectedBalanceInfo.projectedBalance.toFixed(2)}\n`;
        projectedMessage += `• Threshold: ৳${threshold}\n\n`;
        projectedMessage += `⚠️ Even after your recent recharge, the projected balance is still below your threshold. Please recharge again soon.`;
      }
      
      // ─── Build suggestion message ──────────────────────────────────────
      let suggestionMessage = '';
      const avgEnergyNeeded = rechargeData.avgEnergyNeeded || 0;
      const currentMonthRecharge = rechargeData.currentMonthRecharge || 0;
      const currentMonthEnergy = rechargeData.currentMonthEnergy || 0;
      const netEnergyNeeded = rechargeData.netEnergyNeeded || 0;
      const totalRechargeNeeded = rechargeData.totalRechargeNeeded || 0;
      const suggestionAmount = rechargeData.suggestionAmount || 0;
      const avgEnergyPercentage = rechargeData.avgEnergyPercentage || 0.803;
      const energyPercent = (avgEnergyPercentage * 100).toFixed(1);
      const monthlyBreakdown = rechargeData.monthlyBreakdown || [];
      const hasData = rechargeData.hasData || false;
      
      if (suggestionAmount > 0 && hasData) {
        suggestionMessage = `\n\n💡 MeterBondhu Suggestion:\n`;
        suggestionMessage += `Based on your last 3 months usage, you need approximately ৳${avgEnergyNeeded.toFixed(0)} energy per month.\n\n`;
        suggestionMessage += `📝 Calculation Breakdown:\n`;
        suggestionMessage += `• Average Energy Needed: ৳${avgEnergyNeeded.toFixed(0)}/month\n`;
        
        if (currentMonthRecharge > 0) {
          suggestionMessage += `• Already Recharged This Month: ৳${currentMonthRecharge.toFixed(0)}\n`;
          suggestionMessage += `  (Energy Received: ৳${currentMonthEnergy.toFixed(0)})\n`;
          suggestionMessage += `• Net Energy Needed: ৳${netEnergyNeeded.toFixed(0)}\n`;
        }
        
        suggestionMessage += `• Energy Conversion Rate: ${energyPercent}%\n`;
        suggestionMessage += `• Total Recharge Needed: ৳${totalRechargeNeeded.toFixed(0)}\n\n`;
        suggestionMessage += `💰 We suggest you recharge ৳${suggestionAmount} next time.\n`;
        suggestionMessage += `   (This will add approximately ৳${(suggestionAmount * avgEnergyPercentage).toFixed(0)} energy)\n\n`;
        
        if (monthlyBreakdown.length > 0) {
          suggestionMessage += `📊 Your Last 3 Months Energy Usage:\n`;
          monthlyBreakdown.forEach(item => {
            const monthName = new Date(item.month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' });
            suggestionMessage += `• ${monthName}: ৳${item.energyAmount.toFixed(0)}\n`;
          });
          suggestionMessage += `📈 Average: ৳${avgEnergyNeeded.toFixed(0)}/month`;
        }
      } else if (suggestionAmount > 0 && !hasData) {
        suggestionMessage = `\n\n💡 MeterBondhu Suggestion:\n`;
        suggestionMessage += `We suggest you recharge ৳${suggestionAmount} next time.`;
      } else {
        suggestionMessage = `\n\n✅ You have already recharged ৳${currentMonthRecharge.toFixed(0)} this month.`;
      }

      const fullMessage = `Your DESCO prepaid balance is ৳${balance.toFixed(2)}. This is below your threshold of ৳${threshold}.${urgencyMessage}${projectedMessage}${suggestionMessage}`;
      
      const alertData = {
        title,
        message: fullMessage,
        type: isCritical ? 'critical' : 'warning',
        data: {
          balance,
          threshold,
          dailyAvgCost,
          avgEnergyNeeded,
          currentMonthRecharge,
          currentMonthEnergy,
          netEnergyNeeded,
          totalRechargeNeeded,
          suggestionAmount,
          avgEnergyPercentage,
          accountNo: user.account_no,
          meterNo: meter.meter_no || 'N/A',
          isCritical,
          alertType,
          monthlyBreakdown,
          projectedBalanceInfo,
        }
      };
      
      console.log(`[${timestamp}] [AlertService] 📤 Sending ${alertType} alert...`);
      
      // ═══════════════════════════════════════════════════════════════════
      // ১. CREATE ALERT LOG
      // ═══════════════════════════════════════════════════════════════════
      let alert = null;
      try {
        alert = await AlertLog.create({
          m_bondhu_id: user.m_bondhu_id,
          meter_serial: meter.serial || null,
          alert_type: isCritical ? 'critical_low_balance' : 'low_balance',
          threshold_value: threshold,
          current_value: balance,
          message: alertData.message,
        });
        console.log(`[${timestamp}] [AlertService] ✅ Alert log created`);
      } catch (alertError) {
        console.error(`[${timestamp}] [AlertService] ⚠️ Alert log failed:`, alertError.message);
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // ২. SEND EMAIL
      // ═══════════════════════════════════════════════════════════════════
      let emailSent = false;
      if (user.email_notification_enabled !== false) {
        try {
          const profileService = require('./profileService');
          const allEmails = await profileService.getAllAlertEmails(user.m_bondhu_id);

          console.log(`[${timestamp}] [AlertService] 📧 Sending alert to ${allEmails.length} email(s): ${allEmails.join(', ')}`);

          for (const toEmail of allEmails) {
            try {
              const userForEmail = { ...user, email: toEmail };
              
              const sent = await emailService.sendAlertEmail(userForEmail, {
                title: alertData.title,
                message: alertData.message,
                type: isCritical ? 'critical' : 'warning',
                meterNo: meter.meter_no,
                balance: balance.toFixed(2),
                threshold,
                dailyAvgCost,
                avgEnergyNeeded,
                currentMonthRecharge,
                currentMonthEnergy,
                netEnergyNeeded,
                totalRechargeNeeded,
                suggestionAmount,
                avgEnergyPercentage,
                isCritical,
                monthlyBreakdown,
                projectedBalanceInfo,
              });

              if (sent) {
                emailSent = true;
                console.log(`[${timestamp}] [AlertService] 📧 ✅ Alert email sent to ${toEmail}`);
              } else {
                console.log(`[${timestamp}] [AlertService] 📧 ❌ Failed to ${toEmail}`);
              }
            } catch (emailErr) {
              console.error(`[${timestamp}] [AlertService] ❌ Email error for ${toEmail}:`, emailErr.message);
            }
          }

          console.log(`[${timestamp}] [AlertService] 📧 Alert emails complete: ${emailSent ? 'SUCCESS' : 'FAILED'}`);
        } catch (emailError) {
          console.error(`[${timestamp}] [AlertService] ❌ Email error:`, emailError.message);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // ৩. CREATE IN-APP NOTIFICATION
      // ═══════════════════════════════════════════════════════════════════
      if (emailSent) {
        try {
          const notification = await Notification.create({
            m_bondhu_id: user.m_bondhu_id,
            notification_type: isCritical ? 'critical_alert' : 'alert',
            title: alertData.title,
            message: alertData.message,
            data: {
              ...alertData.data,
              email_sent: emailSent,
              sent_at: new Date().toISOString(),
            },
          });
          
          if (notification) {
            await Notification.markAsSent(notification.notification_id);
            console.log(`[${timestamp}] [AlertService] ✅ In-app notification created`);
          }
        } catch (notifError) {
          console.error(`[${timestamp}] [AlertService] ⚠️ Notification failed:`, notifError.message);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // ৪. MARK ALERT AS NOTIFICATION SENT
      // ═══════════════════════════════════════════════════════════════════
      if (alert && emailSent) {
        try {
          await AlertLog.markNotificationSent(alert.alert_id);
        } catch (markError) {
          console.error(`[${timestamp}] [AlertService] ⚠️ Mark failed:`, markError.message);
        }
      }
      
      console.log(`[${timestamp}] [AlertService] 📊 Result: Email=${emailSent}`);
      return emailSent;
      
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Failed:`, error.message);
      return false;
    }
  }

  // ─── Force Check for Specific User ──────────────────────────────────────
  async forceCheckForUser(mBondhuId) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AlertService] 🔍 Force checking ${mBondhuId}`);
    
    try {
      const query = 'SELECT * FROM user_info WHERE m_bondhu_id = $1';
      const result = await pool.query(query, [mBondhuId]);
      const user = result.rows[0];
      
      if (user) {
        const sent = await this.processUserAlert(user, 'force');
        return { 
          success: true, 
          message: sent ? 'Alert sent' : 'No alert needed',
          alertSent: sent 
        };
      }
      return { success: false, message: 'User not found' };
    } catch (error) {
      console.error(`[${timestamp}] [AlertService] ❌ Force check failed:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ─── Get Alert Statistics ───────────────────────────────────────────────
  async getAlertStats() {
    const query = `
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN is_resolved THEN 1 END) as resolved,
        COUNT(CASE WHEN NOT is_resolved THEN 1 END) as active,
        COUNT(CASE WHEN notification_sent THEN 1 END) as notifications_sent,
        COUNT(CASE WHEN notification_sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
        COUNT(CASE WHEN alert_type = 'critical_low_balance' THEN 1 END) as critical_alerts
      FROM alert_logs
    `;
    const result = await pool.query(query);
    return result.rows[0] || {};
  }
}

module.exports = new AlertService();