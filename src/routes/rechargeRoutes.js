// src/routes/rechargeRoutes.js
const express = require('express');
const router = express.Router();
const rechargeController = require('../controllers/rechargeController');
const auth = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════════
// ─── Existing Routes ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

// ─── Sync all recharges (First time load) ──────────────────────────────
router.post('/sync-all', rechargeController.syncAllRecharges);

// ─── Check for new recharge ──────────────────────────────────────────────
router.post('/check-new', rechargeController.checkNewRecharge);

// ─── Get recharge history ──────────────────────────────────────────────
router.get('/history', rechargeController.getRechargeHistory);

// ─── Process unprocessed recharges ──────────────────────────────────────
router.post('/process-unprocessed', rechargeController.processUnprocessedRecharges);

// ─── Check all users ──────────────────────────────────────────────────────
router.post('/check-all-users', rechargeController.checkAllUsers);

// ═══════════════════════════════════════════════════════════════════════
// ─── NEW Routes (for Recharge Tray Smart Suggestion) ───────────────────
// ═══════════════════════════════════════════════════════════════════════

// ─── Get average energy percentage ─────────────────────────────────────
// @route GET /api/recharge/energy-percentage?accountNo=X&meterNo=Y
router.get(
  '/energy-percentage',
  auth,
  rechargeController.getEnergyPercentage
);

// ─── Get last 3 months average usage (for HomeScreen BalanceHeroCard) ──
router.get(
  '/last-3-months-avg',
  auth,
  rechargeController.getLastThreeMonthsAvg
);

// ─── Get current month total recharge ──────────────────────────────────
// @route GET /api/recharge/current-month?accountNo=X&meterNo=Y
router.get(
  '/current-month',
  auth,
  rechargeController.getCurrentMonthRecharge
);

// ─── Get smart recharge suggestion (combined) ──────────────────────────
// @route GET /api/recharge/suggestion?accountNo=X&meterNo=Y
router.get(
  '/suggestion',
  auth,
  rechargeController.getSuggestedRecharge
);

module.exports = router;