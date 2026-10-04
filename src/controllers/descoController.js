// src/controllers/descoController.js
const axios = require('axios');
const DescoService = require('../services/descoService');
const DailyConsumption = require('../models/DailyConsumption');
const MonthlyConsumption = require('../models/MonthlyConsumption');
const { pool } = require('../config/database'); // ✅ ADD THIS

// ─── Helper function to handle DESCO API errors ──────────────────────────
const handleDESCOError = (error, res, defaultMessage = 'Failed to fetch data') => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [DESCO Controller] ❌ Error:`, error.message);
  
  const errorMessage = error.message || defaultMessage;
  
  if (errorMessage.includes('Does not Exists') || 
      errorMessage.includes('not exist') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('invalid')) {
    return res.status(404).json({
      success: false,
      message: errorMessage,
      errorType: 'NOT_FOUND'
    });
  }
  
  if (errorMessage.includes('Network') || 
      errorMessage.includes('network') || 
      errorMessage.includes('timeout') || 
      errorMessage.includes('ECONNABORTED') || 
      errorMessage.includes('Failed to fetch') || 
      errorMessage.includes('connect') || 
      error.code === 'ECONNABORTED') {
    return res.status(503).json({
      success: false,
      message: 'DESCO service is temporarily unavailable. Please try again later.',
      errorType: 'NETWORK_ERROR'
    });
  }
  
  if (errorMessage.includes('auth') || 
      errorMessage.includes('token') || 
      errorMessage.includes('unauthorized') || 
      errorMessage.includes('permission')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed with DESCO server.',
      errorType: 'AUTH_ERROR'
    });
  }
  
  if (errorMessage.includes('rate') || 
      errorMessage.includes('limit') || 
      errorMessage.includes('too many')) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      errorType: 'RATE_LIMIT'
    });
  }
  
  return res.status(500).json({
    success: false,
    message: errorMessage,
    errorType: 'UNKNOWN_ERROR'
  });
};

// ─── API: Calculate Bill from ekpay ──────────────────────────────────────
exports.calculateBill = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 💰 POST /calculate-bill called`);
  
  try {
    const { accountNo, meterNo, amount } = req.body;
    
    if (!accountNo || !meterNo || !amount) {
      return res.status(400).json({
        success: false,
        message: 'accountNo, meterNo, amount are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const mockResponse = {
      success: true,
      data: {
        bllr_inf: {
          bll_cstnm: 'AKTHARUZZAMAN MIA',
          bllr_accno: accountNo,
          meter_no: meterNo,
          bll_amnt_ttl: parseFloat(amount),
          energyCost: (parseFloat(amount) * 0.85).toFixed(2),
          demandCharge: '84.00',
          bll_vat: (parseFloat(amount) * 0.05).toFixed(2),
          meterRent: '40.00',
          rebate: (parseFloat(amount) * 0.005).toFixed(2),
        },
        others: {
          payableAmount: parseFloat(amount),
          ekpayCharge: 0,
          discount: 0,
        }
      },
      message: 'Bill calculated successfully'
    };
    
    res.json(mockResponse);
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Controller] ❌ Calculate bill error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate bill',
      errorType: 'CALCULATION_ERROR'
    });
  }
};

// ─── Helper: Fetch Bill from ekpay ────────────────────────────────────────
const fetchBillFromEkpay = async (accountNo, meterNo, amount) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Service] 🌐 Fetching bill from ekpay...`);
  
  try {
    const billerInfo = await getBillerInfo('desco prepaid');
    
    const response = await axios.post(
      'https://ekpay.gov.bd/patron/access/fetch-bill',
      {
        bllr_id: billerInfo.billerId,
        bllr_accno: accountNo,
        bill_mobno: '1716653557',
        amount: amount,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    if (response.data && response.data.resp_status?.rsp_cd === '0000') {
      return response.data;
    } else {
      throw new Error(response.data?.resp_status?.rsp_msg || 'Failed to fetch bill from ekpay');
    }
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Service] ❌ Ekpay API error:`, error.message);
    throw error;
  }
};

// ─── Helper: Get Biller Info ──────────────────────────────────────────────
const getBillerInfo = async (billerName) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Service] 🌐 Fetching biller info for: ${billerName}`);
  
  try {
    const response = await axios.get(
      `https://ekpay.gov.bd/patron/access/services/biller?billerName=${encodeURIComponent(billerName)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 15000,
      }
    );
    
    if (response.data && response.data.billerId) {
      return response.data;
    } else {
      throw new Error('Biller not found');
    }
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Service] ❌ Failed to fetch biller info:`, error.message);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── Helpers for DESCO Data Processing ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ─── Calculate Daily Consumption from Cumulative Data ─────────────────────
const calculateDailyConsumption = (data) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📊 Calculating daily consumption from ${data?.length || 0} records`);
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  const sortedData = [...data].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const result = [];

  // First record — as-is
  const firstRecord = sortedData[0];
  result.push({
    date: firstRecord.date,
    consumedTaka: firstRecord.consumedTaka,
    consumedUnit: firstRecord.consumedUnit,
  });

  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i];
    const previous = sortedData[i - 1];

    let dailyTaka, dailyUnit, isReset = false;

    if (current.consumedTaka >= previous.consumedTaka) {
      dailyTaka = current.consumedTaka - previous.consumedTaka;
    } else {
      dailyTaka = current.consumedTaka;
      isReset = true;
    }

    if (current.consumedUnit >= previous.consumedUnit) {
      dailyUnit = current.consumedUnit - previous.consumedUnit;
    } else {
      dailyUnit = current.consumedUnit;
    }

    if (dailyTaka < 0 || dailyUnit < 0) continue;

    result.push({
      date: current.date,
      consumedTaka: dailyTaka,
      consumedUnit: dailyUnit,
    });
  }

  result.sort((a, b) => new Date(a.date) - new Date(b.date));
  return result;
};

// ─── Calculate Monthly Consumption ────────────────────────────────────────
const calculateMonthlyConsumption = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map(item => ({
    month: item.month,
    consumedTaka: item.consumedTaka || 0,
    consumedUnit: item.consumedUnit || 0,
    customerName: item.customerName || 'N/A',
    phaseType: item.phaseType || 'N/A',
    sanctionLoad: item.sanctionLoad || 0,
  }));
};

// ─── Save Daily Consumption to Database (legacy, used by syncDailyConsumption) ───
const saveDailyConsumption = async (userSerial, meterSerial, dailyData) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 💾 Saving ${dailyData?.length || 0} daily consumption records`);
  try {
    for (const item of dailyData) {
      await DailyConsumption.create({
        meter_serial: meterSerial,
        user_serial: userSerial,
        consumption_date: item.date,
        consumption_kwh: item.consumedUnit,
      });
    }
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Controller] ❌ Error saving daily consumption:`, error.message);
  }
};

// ─── Save Monthly Consumption to Database ────────────────────────────────
const saveMonthlyConsumption = async (userSerial, meterSerial, monthlyData) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 💾 Saving ${monthlyData?.length || 0} monthly consumption records`);
  try {
    for (const item of monthlyData) {
      await MonthlyConsumption.create({
        meter_serial: meterSerial,
        user_serial: userSerial,
        consumption_month: item.month,
        consumption_kwh: item.consumedUnit,
      });
    }
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Controller] ❌ Error saving monthly consumption:`, error.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── EXISTING APIs ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ─── API 01: Get Customer Information ─────────────────────────────────────
exports.getCustomerInfo = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📡 GET /customer-info called`);
  try {
    const { accountNo, meterNo } = req.query;
    
    if (!accountNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo is required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const data = await DescoService.getCustomerInfo(accountNo, meterNo);
    
    res.json({
      success: true,
      data,
      message: 'Customer info fetched successfully'
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to fetch customer info');
  }
};

// ─── API 01 (PUBLIC): Get Customer Information for SIGNUP ────────────────
// @route   GET /api/desco/public/customer-info
// @query   accountNo, meterNo
// @access  Public (no auth required — used by SignupScreen)
exports.getCustomerInfoPublic = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📡 GET /public/customer-info called (PUBLIC)`);
  try {
    const { accountNo, meterNo } = req.query;

    if (!accountNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo is required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    const data = await DescoService.getCustomerInfo(accountNo, meterNo);

    res.json({
      success: true,
      data,
      message: 'Customer info fetched successfully',
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to fetch customer info');
  }
};

// ─── API 02: Get Current Balance ──────────────────────────────────────────
exports.getBalance = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 💰 GET /balance called`);
  try {
    const { accountNo, meterNo } = req.query;
    
    if (!accountNo || !meterNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo and meterNo are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const data = await DescoService.getBalance(accountNo, meterNo);
    
    res.json({
      success: true,
      data,
      message: 'Balance fetched successfully'
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to fetch balance');
  }
};

// ─── API 03: Get Daily Consumption (Live from DESCO) ─────────────────────
exports.getDailyConsumption = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📊 GET /daily-consumption called`);
  try {
    const { accountNo, meterNo, dateFrom, dateTo } = req.query;
    
    if (!accountNo || !meterNo || !dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo, meterNo, dateFrom, dateTo are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const rawData = await DescoService.getDailyConsumption(accountNo, meterNo, dateFrom, dateTo);
    const dailyData = calculateDailyConsumption(rawData);
    
    res.json({
      success: true,
      data: dailyData,
      message: 'Daily consumption fetched successfully'
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to fetch daily consumption');
  }
};

// ─── API 04: Get Monthly Consumption (Live from DESCO) ───────────────────
exports.getMonthlyConsumption = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📈 GET /monthly-consumption called`);
  try {
    const { accountNo, meterNo, monthFrom, monthTo, months, yearOffset } = req.query;
    
    if (!accountNo || !meterNo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo and meterNo are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    let finalMonthFrom = monthFrom;
    let finalMonthTo = monthTo;

    // Support both formats: (monthFrom, monthTo) OR (months, yearOffset)
    if (!monthFrom || !monthTo) {
      const monthsBack = parseInt(months) || 12;
      const yOff = parseInt(yearOffset) || 0;
      const today = new Date();
      const end = new Date(today.getFullYear() + yOff, today.getMonth(), 1);
      const start = new Date(end.getFullYear(), end.getMonth() - (monthsBack - 1), 1);

      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      finalMonthFrom = fmt(start);
      finalMonthTo = fmt(end);
    }

    const rawData = await DescoService.getMonthlyConsumption(accountNo, meterNo, finalMonthFrom, finalMonthTo);
    const monthlyData = calculateMonthlyConsumption(rawData);
    
    res.json({
      success: true,
      data: monthlyData,
      message: 'Monthly consumption fetched successfully'
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to fetch monthly consumption');
  }
};

// ─── API 05: Get Recharge History (Live from DESCO) ──────────────────────
exports.getRechargeHistory = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📜 GET /recharge-history called`);
  try {
    const { accountNo, meterNo, dateFrom, dateTo } = req.query;
    
    if (!accountNo || !meterNo || !dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo, meterNo, dateFrom, dateTo are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const data = await DescoService.getRechargeHistory(accountNo, meterNo, dateFrom, dateTo);
    
    res.json({
      success: true,
      data,
      message: 'Recharge history fetched successfully'
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to fetch recharge history');
  }
};

// ─── API 06: Sync Daily Consumption (legacy) ─────────────────────────────
exports.syncDailyConsumption = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 🔄 POST /sync-daily called`);
  try {
    const { accountNo, meterNo, dateFrom, dateTo } = req.query;
    
    if (!accountNo || !meterNo || !dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo, meterNo, dateFrom, dateTo are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const rawData = await DescoService.getDailyConsumption(accountNo, meterNo, dateFrom, dateTo);
    const dailyData = calculateDailyConsumption(rawData);
    
    res.json({
      success: true,
      data: dailyData,
      message: `Fetched ${dailyData.length} daily consumption records`
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to sync daily consumption');
  }
};

// ─── API 07: Sync Monthly Consumption (legacy) ───────────────────────────
exports.syncMonthlyConsumption = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 🔄 POST /sync-monthly called`);
  try {
    const { accountNo, meterNo, monthFrom, monthTo } = req.query;
    
    if (!accountNo || !meterNo || !monthFrom || !monthTo) {
      return res.status(400).json({
        success: false,
        message: 'accountNo, meterNo, monthFrom, monthTo are required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    const rawData = await DescoService.getMonthlyConsumption(accountNo, meterNo, monthFrom, monthTo);
    const monthlyData = calculateMonthlyConsumption(rawData);
    
    res.json({
      success: true,
      data: monthlyData,
      message: `Fetched ${monthlyData.length} monthly consumption records`
    });
  } catch (error) {
    handleDESCOError(error, res, 'Failed to sync monthly consumption');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ NEW APIs — Daily Consumption from DB ────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ─── API: Get Daily Consumption FROM DB ──────────────────────────────────
// @route   GET /api/desco/daily-consumption-db
// @desc    Returns daily consumption from DB (auto-synced on login + 8:05 AM cron)
// @query   meterNo, dateFrom, dateTo
// @access  Private
exports.getDailyConsumptionFromDB = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📊 GET /daily-consumption-db called`);

  try {
    const { meterNo, dateFrom, dateTo } = req.query;

    // Validation
    if (!meterNo || !dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo, dateFrom, dateTo are required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ✅ SECURITY CHECK — Does this user own this meter?
    // ═══════════════════════════════════════════════════════════════════
    const accessCheck = await pool.query(
      `SELECT m.serial, m.meter_id
       FROM meter_info m
       WHERE m.meter_no = $1
         AND m.user_serial = $2
       LIMIT 1`,
      [meterNo, req.user.serial]
    );

    if (accessCheck.rows.length === 0) {
      console.log(
        `[${timestamp}] [DESCO Controller] 🚫 Access denied: user ${req.user.m_bondhu_id} → meter ${meterNo}`
      );
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this meter',
        errorType: 'ACCESS_DENIED',
      });
    }

    // Fetch from DB
    const dbResult = await pool.query(
  `SELECT 
     consumption_id,
     meter_no,
     TO_CHAR(consumption_date, 'YYYY-MM-DD') AS date,
     consumption_unit,
     consumption_taka,
     cumulative_unit,
     cumulative_taka,
     created_at,
     updated_at
   FROM daily_consumption 
   WHERE meter_no = $1 
     AND consumption_date BETWEEN $2 AND $3
   ORDER BY consumption_date ASC`,
  [meterNo, dateFrom, dateTo]
);

    console.log(
      `[${timestamp}] [DESCO Controller] ✅ Found ${dbResult.rows.length} records from DB`
    );

    // Format for frontend
    const formatted = dbResult.rows.map((row) => {
  // ✅ FIX: Convert Date object → "YYYY-MM-DD" string in local time
  let dateStr = null;
  if (row.date) {
    const d = new Date(row.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }

  return {
    consumption_id: row.consumption_id,
    date: dateStr, // ✅ Now "2026-07-30" format
    consumption_unit: row.consumption_unit !== null ? parseFloat(row.consumption_unit) : null,
    consumption_taka: row.consumption_taka !== null ? parseFloat(row.consumption_taka) : null,
    cumulative_unit: row.cumulative_unit !== null ? parseFloat(row.cumulative_unit) : null,
    cumulative_taka: row.cumulative_taka !== null ? parseFloat(row.cumulative_taka) : null,
  };
});

    res.json({
      success: true,
      data: formatted,
      count: formatted.length,
      source: 'database',
      message: 'Daily consumption from database',
    });
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Controller] ❌ DB fetch error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── API: Manual Sync for a Meter ────────────────────────────────────────
// @route   POST /api/desco/sync-daily-manual
// @desc    Manually trigger sync for a specific meter
// @query   meterNo, daysBack (default 90)
// @access  Private
exports.syncDailyManual = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 🔄 POST /sync-daily-manual called`);

  try {
    const { meterNo, daysBack = 90 } = req.query;

    if (!meterNo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo is required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // Security check
    const accessCheck = await pool.query(
      `SELECT m.serial, m.account_no
       FROM meter_info m
       WHERE m.meter_no = $1
         AND m.user_serial = $2
       LIMIT 1`,
      [meterNo, req.user.serial]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this meter',
        errorType: 'ACCESS_DENIED',
      });
    }

    const { account_no } = accessCheck.rows[0];

    // Trigger sync
    const dailyConsumptionService = require('../services/dailyConsumptionService');

    const result = await dailyConsumptionService.backfill(
      meterNo,
      account_no,
      parseInt(daysBack)
    );

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Synced ${result.saved} records`
        : result.message,
    });
  } catch (error) {
    console.error(`[${timestamp}] ❌ Manual sync error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── API: Get Monthly Consumption FROM DATABASE ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @route   GET /api/desco/monthly-consumption-db
// @desc    Returns monthly consumption from DB (auto-synced on login + 1st of month)
// @query   meterNo, monthFrom, monthTo (format: "YYYY-MM")
// @access  Private
//
// Security: User can ONLY access meters they own
// ═══════════════════════════════════════════════════════════════════════════
exports.getMonthlyConsumptionFromDB = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📈 GET /monthly-consumption-db called`);

  try {
    const { meterNo, monthFrom, monthTo } = req.query;

    // ─── Validation ──────────────────────────────────────────────────
    if (!meterNo || !monthFrom || !monthTo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo, monthFrom, monthTo are required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // ─── Security Check: Does this user own this meter? ─────────────
    const accessCheck = await pool.query(
      `SELECT m.serial, m.meter_id
       FROM meter_info m
       WHERE m.meter_no = $1
         AND m.user_serial = $2
       LIMIT 1`,
      [meterNo, req.user.serial]
    );

    if (accessCheck.rows.length === 0) {
      console.log(
        `[${timestamp}] [DESCO Controller] 🚫 Access denied: user ${req.user.m_bondhu_id} → meter ${meterNo}`
      );
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this meter',
        errorType: 'ACCESS_DENIED',
      });
    }

    // ─── Fetch from DB ──────────────────────────────────────────────
    const dbResult = await pool.query(
      `SELECT 
         consumption_id,
         meter_no,
         consumption_month AS month,
         consumed_unit,
         consumed_taka,
         created_at,
         updated_at
       FROM monthly_consumption 
       WHERE meter_no = $1 
         AND consumption_month BETWEEN $2 AND $3
       ORDER BY consumption_month ASC`,
      [meterNo, monthFrom, monthTo]
    );

    console.log(
      `[${timestamp}] [DESCO Controller] ✅ Found ${dbResult.rows.length} monthly records from DB`
    );

    // ─── Format for Frontend ─────────────────────────────────────────
    const formatted = dbResult.rows.map((row) => ({
      consumption_id: row.consumption_id,
      month: row.month, // "YYYY-MM"
      consumedUnit: row.consumed_unit !== null ? parseFloat(row.consumed_unit) : 0,
      consumedTaka: row.consumed_taka !== null ? parseFloat(row.consumed_taka) : 0,
    }));

    res.json({
      success: true,
      data: formatted,
      count: formatted.length,
      source: 'database',
      message: 'Monthly consumption from database',
    });
  } catch (error) {
    console.error(
      `[${timestamp}] [DESCO Controller] ❌ Monthly DB fetch error:`,
      error.message
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── API: Manual Sync Monthly (for Testing/Admin) ──────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @route   POST /api/desco/sync-monthly-manual
// @desc    Manually trigger monthly sync for a meter
// @query   meterNo, monthsBack (default 24)
// @access  Private
// ═══════════════════════════════════════════════════════════════════════════
exports.syncMonthlyManual = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [DESCO Controller] 🔄 POST /sync-monthly-manual called`
  );

  try {
    const { meterNo, monthsBack = 24 } = req.query;

    if (!meterNo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo is required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // ─── Security Check ──────────────────────────────────────────────
    const accessCheck = await pool.query(
      `SELECT m.serial, m.account_no
       FROM meter_info m
       WHERE m.meter_no = $1
         AND m.user_serial = $2
       LIMIT 1`,
      [meterNo, req.user.serial]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this meter',
        errorType: 'ACCESS_DENIED',
      });
    }

    const { account_no } = accessCheck.rows[0];

    // ─── Trigger Sync ────────────────────────────────────────────────
    const monthlyConsumptionService = require('../services/monthlyConsumptionService');

    const result = await monthlyConsumptionService.backfill(
      meterNo,
      account_no,
      parseInt(monthsBack)
    );

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Synced ${result.saved} monthly records`
        : result.message,
    });
  } catch (error) {
    console.error(`[${timestamp}] ❌ Monthly manual sync error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── API: Recharge vs Consumption Chart Data ────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @route   GET /api/desco/recharge-chart
// @desc    Get monthly recharge vs consumption for last N months
// @query   meterNo, months (default 12)
// @access  Private
// ═══════════════════════════════════════════════════════════════════════════
exports.getRechargeChart = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📊 GET /recharge-chart called`);

  try {
    const { meterNo, months = 12 } = req.query;

    if (!meterNo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo is required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    const monthsBack = parseInt(months) || 12;

    // ─── Security Check ──────────────────────────────────────────────
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
        errorType: 'ACCESS_DENIED',
      });
    }

    // ─── 1. Get recharge totals per month from DB ────────────────────
    const rechargeQuery = `
      SELECT
        TO_CHAR(recharge_date, 'YYYY-MM') AS month,
        COALESCE(SUM(total_amount), 0) AS total_recharge,
        COALESCE(SUM(energy_amount), 0) AS total_energy,
        COUNT(*) AS txn_count
      FROM recharge_history
      WHERE meter_no = $1
        AND order_status = 'Execution Successful'
        AND total_amount > 0
        AND recharge_date >= DATE_TRUNC('month', CURRENT_DATE) - ($2 || ' months')::INTERVAL
      GROUP BY TO_CHAR(recharge_date, 'YYYY-MM')
      ORDER BY month ASC
    `;

    const rechargeResult = await pool.query(rechargeQuery, [
      meterNo,
      monthsBack - 1,
    ]);

    // ─── 2. Get monthly consumption from DB ──────────────────────────
    const consumptionQuery = `
      SELECT
        consumption_month AS month,
        COALESCE(consumed_taka, 0) AS total_consumption,
        COALESCE(consumed_unit, 0) AS total_unit
      FROM monthly_consumption
      WHERE meter_no = $1
        AND consumption_month >= TO_CHAR(
          DATE_TRUNC('month', CURRENT_DATE) - ($2 || ' months')::INTERVAL,
          'YYYY-MM'
        )
      ORDER BY consumption_month ASC
    `;

    const consumptionResult = await pool.query(consumptionQuery, [
      meterNo,
      monthsBack - 1,
    ]);

    // ─── 3. Merge by month ───────────────────────────────────────────
    const mergedMap = {};

    rechargeResult.rows.forEach((row) => {
      mergedMap[row.month] = {
        month: row.month,
        recharge: parseFloat(row.total_recharge) || 0,
        rechargeEnergy: parseFloat(row.total_energy) || 0,
        txnCount: parseInt(row.txn_count) || 0,
        consumption: 0,
      };
    });

    consumptionResult.rows.forEach((row) => {
      if (!mergedMap[row.month]) {
        mergedMap[row.month] = {
          month: row.month,
          recharge: 0,
          rechargeEnergy: 0,
          txnCount: 0,
          consumption: 0,
        };
      }
      mergedMap[row.month].consumption = parseFloat(row.total_consumption) || 0;
    });

    const chartData = Object.values(mergedMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    // ─── 4. Summary ──────────────────────────────────────────────────
    const totalRecharge = chartData.reduce((s, d) => s + d.recharge, 0);
    const totalConsumption = chartData.reduce((s, d) => s + d.consumption, 0);
    const net = totalRecharge - totalConsumption;

    console.log(
      `[${timestamp}] 📊 Recharge chart: ${chartData.length} months`
    );

    res.json({
      success: true,
      data: chartData,
      summary: {
        totalRecharge,
        totalConsumption,
        net,
        monthsCovered: chartData.length,
      },
      message: 'Recharge chart data fetched',
    });
  } catch (error) {
    console.error(`[${timestamp}] ❌ Recharge chart error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      data: [],
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── API: Get Daily Average Cost (Last 7 Days) ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// Mirrors AlertService.calculateDailyAvgCost's DB path exactly.
// Uses CURRENT_DATE - INTERVAL '7 days' so the window is timezone-safe.
// Returns: { success, avgCost, daysCount, totalCost, rows: [...] }
// ═══════════════════════════════════════════════════════════════════════════
exports.getDailyAvgCost = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DESCO Controller] 📊 GET /daily-avg-cost called`);

  try {
    const { meterNo } = req.query;

    if (!meterNo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo is required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // ─── Security check ────────────────────────────────────────────────
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
        errorType: 'ACCESS_DENIED',
      });
    }

    // ─── Same window as AlertService: CURRENT_DATE - 7 days → CURRENT_DATE ─
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

    const result = await pool.query(query, [meterNo]);

    console.log(
      `[${timestamp}] [DESCO Controller] 📊 Found ${result.rows.length} rows for ${meterNo}`
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          avgCost: 0,
          daysCount: 0,
          totalCost: 0,
          rows: [],
        },
        message: 'No data available for last 7 days',
      });
    }

    const takas = result.rows.map((r) => parseFloat(r.consumption_taka) || 0);
    const totalCost = takas.reduce((sum, v) => sum + v, 0);
    const daysCount = takas.length;
    const avgCost = totalCost / daysCount;

    console.log(`[${timestamp}] [DESCO Controller] 📊 Total: ৳${totalCost.toFixed(2)}, Days: ${daysCount}, Avg: ৳${avgCost.toFixed(2)}`);

    res.json({
      success: true,
      data: {
        avgCost: parseFloat(avgCost.toFixed(2)),
        daysCount,
        totalCost: parseFloat(totalCost.toFixed(2)),
        rows: result.rows.map((r) => ({
          date: r.date,
          consumption_taka: parseFloat(r.consumption_taka),
          consumption_unit: parseFloat(r.consumption_unit),
        })),
      },
      message: 'Daily average calculated successfully',
    });
  } catch (error) {
    console.error(`[${timestamp}] [DESCO Controller] ❌ Daily avg error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── API: Previous Year Monthly Consumption (for comparison) ────────────
// ═══════════════════════════════════════════════════════════════════════════
// @route   GET /api/desco/monthly-previous-year
// @desc    Returns monthly consumption from DB for previous year
// @query   meterNo, months (default 12)
// @access  Private
// ═══════════════════════════════════════════════════════════════════════════
exports.getPreviousYearMonthly = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [DESCO Controller] 📈 GET /monthly-previous-year called`
  );

  try {
    const { meterNo, months = 12 } = req.query;

    if (!meterNo) {
      return res.status(400).json({
        success: false,
        message: 'meterNo is required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // Security check
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
        errorType: 'ACCESS_DENIED',
      });
    }

    // Get previous year range
    const monthsBack = parseInt(months) || 12;
    const today = new Date();
    const startMonth = new Date();
    startMonth.setFullYear(today.getFullYear() - 1);
    startMonth.setMonth(today.getMonth() - monthsBack + 1);

    const endMonth = new Date();
    endMonth.setFullYear(today.getFullYear() - 1);
    endMonth.setMonth(today.getMonth());

    const fmt = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const monthFromStr = fmt(startMonth);
    const monthToStr = fmt(endMonth);

    const dbResult = await pool.query(
      `SELECT 
         consumption_id,
         consumption_month AS month,
         consumed_unit,
         consumed_taka
       FROM monthly_consumption 
       WHERE meter_no = $1 
         AND consumption_month BETWEEN $2 AND $3
       ORDER BY consumption_month ASC`,
      [meterNo, monthFromStr, monthToStr]
    );

    const formatted = dbResult.rows.map((row) => ({
      consumption_id: row.consumption_id,
      month: row.month,
      consumedUnit: row.consumed_unit !== null ? parseFloat(row.consumed_unit) : 0,
      consumedTaka: row.consumed_taka !== null ? parseFloat(row.consumed_taka) : 0,
    }));

    res.json({
      success: true,
      data: formatted,
      count: formatted.length,
      source: 'database',
      message: 'Previous year monthly consumption from database',
    });
  } catch (error) {
    console.error(
      `[${timestamp}] ❌ Previous year error:`,
      error.message
    );
    res.status(500).json({ success: false, message: error.message });
  }
};