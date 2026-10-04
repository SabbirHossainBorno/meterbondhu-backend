// src/routes/alertRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const alertController = require('../controllers/alertController');

// ─── Get User Alerts ──────────────────────────────────────────────────────
router.get('/', auth, alertController.getUserAlerts);

// ─── Get Active Alerts ────────────────────────────────────────────────────
router.get('/active', auth, alertController.getActiveAlerts);

// ─── Resolve Alert ────────────────────────────────────────────────────────
router.put('/:alert_id/resolve', auth, alertController.resolveAlert);

// ─── Force Alert Check ────────────────────────────────────────────────────
router.post('/force-check', auth, alertController.forceAlertCheck);

// ─── Get Alert Settings ───────────────────────────────────────────────────
router.get('/settings', auth, alertController.getAlertSettings);

// ─── Get Alert Statistics ─────────────────────────────────────────────────
router.get('/stats', auth, alertController.getAlertStats);

module.exports = router;