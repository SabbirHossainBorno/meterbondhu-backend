// src/routes/descoRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const descoController = require('../controllers/descoController');
const auth = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════════════
// ─── PUBLIC ROUTES (no auth required) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ These routes MUST come before router.use(auth) below
//
// Used by signup screen to verify DESCO account BEFORE user is created.
// Rate limited to prevent abuse (10 req/min per IP).

const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errorType: 'RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  '/public/customer-info',
  publicLimiter,
  descoController.getCustomerInfoPublic
);

// ═══════════════════════════════════════════════════════════════════════════
// ─── AUTHENTICATED ROUTES ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// Everything below this line requires a valid JWT token
router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════
// ─── EXISTING ROUTES ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// API 01: Get Customer Information
router.get('/customer-info', descoController.getCustomerInfo);

// API 02: Get Current Balance
router.get('/balance', descoController.getBalance);

// API 03: Get Daily Consumption (LIVE from DESCO)
router.get('/daily-consumption', descoController.getDailyConsumption);

// API 04: Get Monthly Consumption (LIVE from DESCO)
router.get('/monthly-consumption', descoController.getMonthlyConsumption);

// API 05: Get Recharge History (LIVE from DESCO)
router.get('/recharge-history', descoController.getRechargeHistory);

// API 06: Sync Daily Consumption (legacy)
router.post('/sync-daily', descoController.syncDailyConsumption);

// API 07: Sync Monthly Consumption (legacy)
router.post('/sync-monthly', descoController.syncMonthlyConsumption);

// API: Calculate Bill
router.post('/calculate-bill', descoController.calculateBill);

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ DAILY — FROM DB ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Get daily consumption from DB
// @route   GET /api/desco/daily-consumption-db
// @query   meterNo, dateFrom, dateTo
router.get('/daily-consumption-db', descoController.getDailyConsumptionFromDB);

// Manual daily sync
// @route   POST /api/desco/sync-daily-manual
// @query   meterNo, daysBack (default 90)
router.post('/sync-daily-manual', descoController.syncDailyManual);

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ NEW: MONTHLY — FROM DB ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Get monthly consumption from DB
// @route   GET /api/desco/monthly-consumption-db
// @query   meterNo, monthFrom, monthTo (format: "YYYY-MM")
// @access  Private
// @desc    Returns monthly consumption from DB (auto-synced on login + 1st of month)
router.get('/monthly-consumption-db', descoController.getMonthlyConsumptionFromDB);

// Manual monthly sync
// @route   POST /api/desco/sync-monthly-manual
// @query   meterNo, monthsBack (default 24)
// @access  Private
router.post('/sync-monthly-manual', descoController.syncMonthlyManual);

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ NEW: RECHARGE CHART ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Get recharge vs consumption chart data
// @route   GET /api/desco/recharge-chart
// @query   meterNo, months (default 12)
// @access  Private
router.get('/recharge-chart', descoController.getRechargeChart);

// Get previous year monthly consumption (for comparison)
// @route   GET /api/desco/monthly-previous-year
// @query   meterNo, months (default 12)
// @access  Private
router.get('/monthly-previous-year', descoController.getPreviousYearMonthly);


// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ NEW: DAILY AVERAGE COST ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Get daily average cost (last 7 days)
// @route   GET /api/desco/daily-avg-cost
// @query   meterNo
// @access  Private
router.get('/daily-avg-cost', descoController.getDailyAvgCost);



module.exports = router;