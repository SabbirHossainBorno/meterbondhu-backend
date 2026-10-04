// src/controllers/rechargeController.js
const { pool } = require('../config/database');
const rechargeService = require('../services/rechargeService');
const DescoService = require('../services/descoService');

// ─── Sync All Recharges (First Time Load) ──────────────────────────────
exports.syncAllRecharges = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 🔄 POST /sync-all called`);

  try {
    const { userSerial } = req.body;

    if (!userSerial) {
      return res.status(400).json({
        success: false,
        message: 'userSerial is required',
      });
    }

    const result = await rechargeService.syncAllRecharges(userSerial);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─── Check for New Recharges ─────────────────────────────────────────────
exports.checkNewRecharge = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 🔍 POST /check-new-recharge called`);

  try {
    const { userSerial } = req.body;

    if (!userSerial) {
      return res.status(400).json({
        success: false,
        message: 'userSerial is required',
      });
    }

    const result = await rechargeService.checkForNewRecharges(userSerial);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─── Get Recharge History ─────────────────────────────────────────────────
// ─── Get Recharge History ─────────────────────────────────────────────────
// @route   GET /api/recharge/history
// @query   EITHER  ?userSerial=X&limit=50
//          OR      ?accountNo=Y&meterNo=Z&limit=50
// @desc    Fetch recharge history from DB.
//          - Normal users: pass userSerial (backend resolves account+meter)
//          - Tenant meters: pass accountNo+meterNo directly (no user_info row)
exports.getRechargeHistory = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 📋 GET /recharge-history called`);

  try {
    const { userSerial, accountNo, meterNo, limit = 50 } = req.query;

    let finalAccountNo = accountNo;
    let finalMeterNo = meterNo;

    // ─── Path A: userSerial provided (normal user) ────────────────
    if (userSerial) {
      const userQuery = 'SELECT account_no, meter_no FROM user_info WHERE serial = $1';
      const userResult = await pool.query(userQuery, [userSerial]);

      if (userResult.rows.length === 0) {
        console.log(`[${timestamp}] [RechargeController] ⚠️ User ${userSerial} not found, trying tenant_info...`);
        
        // ✅ Fallback: tenant_info (kintu tenant_info e userSerial nai)
        // User nai → error
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      finalAccountNo = userResult.rows[0].account_no;
      finalMeterNo = userResult.rows[0].meter_no;
    }

    // ─── Path B: accountNo + meterNo provided directly (tenant) ──
    // (already assigned to finalAccountNo/finalMeterNo)

    // ─── Validation ───────────────────────────────────────────────
    if (!finalAccountNo || !finalMeterNo) {
      return res.status(400).json({
        success: false,
        message: 'Either userSerial OR (accountNo + meterNo) is required',
      });
    }

    // ─── Query recharge_history ──────────────────────────────────
    const query = `
      SELECT * FROM recharge_history 
      WHERE account_no = $1 
      AND meter_no = $2
      AND order_status IN ('Execution Successful', 'Successful')
      AND total_amount > 0
      ORDER BY recharge_date DESC 
      LIMIT $3
    `;
    const result = await pool.query(query, [finalAccountNo, finalMeterNo, parseInt(limit)]);

    console.log(`[${timestamp}] [RechargeController] ✅ Found ${result.rows.length} recharges for ${finalAccountNo}/${finalMeterNo}`);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─── Process Unprocessed Recharges ──────────────────────────────────────
exports.processUnprocessedRecharges = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 🔄 POST /process-unprocessed called`);

  try {
    const result = await rechargeService.processUnprocessedRecharges();
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─── Check All Users ──────────────────────────────────────────────────────
exports.checkAllUsers = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 🔍 POST /check-all-users called`);

  try {
    const result = await rechargeService.checkAllUsersForNewRecharges();
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── NEW: Get Average Energy Percentage ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @desc    Get average energy conversion percentage for user
// @route   GET /api/recharge/energy-percentage
exports.getEnergyPercentage = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 📊 GET /energy-percentage called`);

  try {
    const { accountNo, meterNo } = req.query;

    if (!accountNo || !meterNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo and meterNo are required',
      });
    }

    const query = `
      SELECT 
        AVG(energy_amount / total_amount) as avg_energy_percentage,
        COUNT(*) as total_recharges
      FROM recharge_history 
      WHERE account_no = $1 
      AND meter_no = $2
      AND order_status = 'Execution Successful'
      AND total_amount > 0
      AND energy_amount > 0
    `;

    const result = await pool.query(query, [accountNo, meterNo]);

    const avgPercentage =
      parseFloat(result.rows[0]?.avg_energy_percentage) || 0.803; // Default DESCO ~80.3%

    console.log(`[${timestamp}] [RechargeController] ✅ Energy %: ${(avgPercentage * 100).toFixed(1)}%`);

    res.json({
      success: true,
      avgEnergyPercentage: avgPercentage,
      totalRecharges: parseInt(result.rows[0]?.total_recharges) || 0,
    });
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      avgEnergyPercentage: 0.803, // Fallback
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ NEW: Get Last 3 Months Average Usage (for HomeScreen) ─────────────
// ═══════════════════════════════════════════════════════════════════════════
// Returns: { success, avgEnergyNeeded, avgUnit, monthsCount, months: [...] }
// Uses DB (monthly_consumption) — no DESCO API call. Fast.
// ═══════════════════════════════════════════════════════════════════════════
exports.getLastThreeMonthsAvg = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 📊 GET /last-3-months-avg called`);

  try {
    const { meterNo } = req.query;

    if (!meterNo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo is required',
      });
    }

    // ─── Security check: does user own this meter? ────────────────────
    const accessCheck = await pool.query(
      `SELECT m.serial FROM meter_info m
       WHERE m.meter_no = $1 AND m.user_serial = $2
       LIMIT 1`,
      [meterNo, req.user.serial]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this meter',
      });
    }

    // ─── Get last 3 months from DB (excluding current month) ─────────
    // Current month incomplete — take 3 months BEFORE current.
    const query = `
      SELECT 
        consumption_month AS month,
        COALESCE(consumed_taka, 0) AS consumed_taka,
        COALESCE(consumed_unit, 0) AS consumed_unit
      FROM monthly_consumption
      WHERE meter_no = $1
        AND consumption_month < TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        AND consumed_taka > 0
      ORDER BY consumption_month DESC
      LIMIT 3
    `;
    const result = await pool.query(query, [meterNo]);

    const rows = result.rows;
    const monthsCount = rows.length;

    if (monthsCount === 0) {
      return res.json({
        success: true,
        avgEnergyNeeded: 0,
        avgUnit: 0,
        monthsCount: 0,
        months: [],
        message: 'Not enough data',
      });
    }

    const totalTaka = rows.reduce((s, r) => s + parseFloat(r.consumed_taka), 0);
    const totalUnit = rows.reduce((s, r) => s + parseFloat(r.consumed_unit), 0);
    const avgEnergyNeeded = totalTaka / monthsCount;
    const avgUnit = totalUnit / monthsCount;
    const hasUnit = totalUnit > 0;

    console.log(
      `[${timestamp}] [RechargeController] ✅ Avg: ৳${avgEnergyNeeded.toFixed(2)}, Unit: ${avgUnit.toFixed(2)} (${monthsCount} months)`
    );

    res.json({
      success: true,
      avgEnergyNeeded: parseFloat(avgEnergyNeeded.toFixed(2)),
      avgUnit: parseFloat(avgUnit.toFixed(2)),
      monthsCount,
      hasUnit,
      months: rows.map((r) => ({
        month: r.month,
        consumedTaka: parseFloat(r.consumed_taka),
        consumedUnit: parseFloat(r.consumed_unit),
      })),
    });
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      avgEnergyNeeded: 0,
      avgUnit: 0,
      monthsCount: 0,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── NEW: Get Current Month Recharge ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @desc    Get current month total recharge for user
// @route   GET /api/recharge/current-month
exports.getCurrentMonthRecharge = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 💰 GET /current-month called`);

  try {
    const { accountNo, meterNo } = req.query;

    if (!accountNo || !meterNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo and meterNo are required',
      });
    }

    const query = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_recharge,
        COALESCE(SUM(energy_amount), 0) as total_energy,
        COUNT(*) as transaction_count,
        MAX(recharge_date) as last_recharge_date
      FROM recharge_history 
      WHERE account_no = $1 
      AND meter_no = $2
      AND order_status = 'Execution Successful'
      AND total_amount > 0
      AND recharge_date >= DATE_TRUNC('month', CURRENT_DATE)
    `;

    const result = await pool.query(query, [accountNo, meterNo]);

    const totalRecharge = parseFloat(result.rows[0]?.total_recharge) || 0;
    const totalEnergy = parseFloat(result.rows[0]?.total_energy) || 0;
    const transactionCount = parseInt(result.rows[0]?.transaction_count) || 0;

    console.log(`[${timestamp}] [RechargeController] ✅ Current month: ৳${totalRecharge.toFixed(2)} (${transactionCount} txns)`);

    res.json({
      success: true,
      totalRecharge,
      totalEnergy,
      transactionCount,
      lastRechargeDate: result.rows[0]?.last_recharge_date || null,
    });
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      totalRecharge: 0,
      totalEnergy: 0,
      transactionCount: 0,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── NEW: Get Suggested Recharge (Combined) ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @desc    Get smart recharge suggestion based on usage
// @route   GET /api/recharge/suggestion
exports.getSuggestedRecharge = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [RechargeController] 💡 GET /suggestion called`);

  try {
    const { accountNo, meterNo } = req.query;

    if (!accountNo || !meterNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo and meterNo are required',
      });
    }

    // ─── 1. Get last 3 months usage from DESCO ──────────────────────
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const monthFrom = threeMonthsAgo.toISOString().split('T')[0].slice(0, 7);
    const monthTo = today.toISOString().split('T')[0].slice(0, 7);

    let monthlyData = [];
    try {
      const monthlyResponse = await DescoService.getMonthlyConsumption(
        accountNo,
        meterNo,
        monthFrom,
        monthTo
      );

      if (monthlyResponse && monthlyResponse.success && monthlyResponse.data) {
        monthlyData = monthlyResponse.data;
      } else if (Array.isArray(monthlyResponse)) {
        monthlyData = monthlyResponse;
      } else if (monthlyResponse && monthlyResponse.data && Array.isArray(monthlyResponse.data)) {
        monthlyData = monthlyResponse.data;
      }
    } catch (descoError) {
      console.warn(`[${timestamp}] [RechargeController] ⚠️ DESCO API failed:`, descoError.message);
    }

    // ─── 2. Get energy percentage ──────────────────────────────────
    const energyPctQuery = `
      SELECT AVG(energy_amount / total_amount) as avg_pct
      FROM recharge_history 
      WHERE account_no = $1 AND meter_no = $2
      AND order_status = 'Execution Successful'
      AND total_amount > 0
      AND energy_amount > 0
    `;
    const energyPctResult = await pool.query(energyPctQuery, [accountNo, meterNo]);
    const avgEnergyPercentage =
      parseFloat(energyPctResult.rows[0]?.avg_pct) || 0.803;

    // ─── 3. Get current month recharge ──────────────────────────────
    const currentMonthQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM recharge_history 
      WHERE account_no = $1 AND meter_no = $2
      AND order_status = 'Execution Successful'
      AND total_amount > 0
      AND recharge_date >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const currentMonthResult = await pool.query(currentMonthQuery, [accountNo, meterNo]);
    const currentMonthRecharge = parseFloat(currentMonthResult.rows[0]?.total) || 0;
    const currentMonthEnergy = currentMonthRecharge * avgEnergyPercentage;

    // ─── 4. Calculate average energy needed ────────────────────────
    const validData = monthlyData
      .filter((item) => item.consumedTaka > 0)
      .slice(-3);

    if (validData.length === 0) {
      console.log(`[${timestamp}] [RechargeController] ⚠️ No valid monthly data`);

      return res.json({
        success: true,
        hasData: false,
        message: 'Not enough usage data to suggest',
        avgEnergyNeeded: 0,
        currentMonthRecharge,
        currentMonthEnergy,
        netEnergyNeeded: 0,
        totalRechargeNeeded: 0,
        suggestionAmount: 0,
        avgEnergyPercentage,
        monthlyBreakdown: [],
      });
    }

    const totalEnergy = validData.reduce(
      (sum, item) => sum + (item.consumedTaka || 0),
      0
    );
    const avgEnergyNeeded = totalEnergy / validData.length;

    // ─── 5. Calculate suggestion ────────────────────────────────────
    const netEnergyNeeded = Math.max(0, avgEnergyNeeded - currentMonthEnergy);
    const totalRechargeNeeded = netEnergyNeeded / avgEnergyPercentage;
    const suggestionAmount = Math.ceil(totalRechargeNeeded / 100) * 100;

    const monthlyBreakdown = validData.map((item) => ({
      month: item.month,
      energyAmount: item.consumedTaka,
    }));

    console.log(`[${timestamp}] [RechargeController] ═══════════════════════════════════════`);
    console.log(`[${timestamp}] [RechargeController] 💡 SUGGESTION CALCULATION`);
    console.log(`  • Avg Energy Needed: ৳${avgEnergyNeeded.toFixed(2)}`);
    console.log(`  • Current Month Recharge: ৳${currentMonthRecharge.toFixed(2)}`);
    console.log(`  • Current Month Energy: ৳${currentMonthEnergy.toFixed(2)}`);
    console.log(`  • Net Energy Needed: ৳${netEnergyNeeded.toFixed(2)}`);
    console.log(`  • Total Recharge Needed: ৳${totalRechargeNeeded.toFixed(2)}`);
    console.log(`  • Suggestion: ৳${suggestionAmount}`);
    console.log(`[${timestamp}] [RechargeController] ═══════════════════════════════════════`);

    res.json({
      success: true,
      hasData: true,
      avgEnergyNeeded: parseFloat(avgEnergyNeeded.toFixed(2)),
      currentMonthRecharge: parseFloat(currentMonthRecharge.toFixed(2)),
      currentMonthEnergy: parseFloat(currentMonthEnergy.toFixed(2)),
      netEnergyNeeded: parseFloat(netEnergyNeeded.toFixed(2)),
      totalRechargeNeeded: parseFloat(totalRechargeNeeded.toFixed(2)),
      suggestionAmount,
      avgEnergyPercentage,
      monthlyBreakdown,
    });
  } catch (error) {
    console.error(`[${timestamp}] [RechargeController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      hasData: false,
    });
  }
};