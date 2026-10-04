// src/routes/meterRoutes.js
const express = require('express');
const router = express.Router();
const meterController = require('../controllers/meterController');
const auth = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════════
// EXISTING ROUTES
// ═══════════════════════════════════════════════════════════════════════
router.get('/', auth, meterController.getUserMeters);
router.post('/', auth, meterController.addMeter);
router.delete('/:meter_id', auth, meterController.deleteMeter);
router.put('/:meter_id/primary', auth, meterController.setPrimaryMeter);

// ═══════════════════════════════════════════════════════════════════════
// NEW BALANCE SYNC ROUTES
// ═══════════════════════════════════════════════════════════════════════

// Admin: Sync all meters
router.post('/sync-all', meterController.syncAllMeters);

// Sync specific meter
router.post('/sync', meterController.syncMeter);

// Get meter info by user serial
router.get('/info', meterController.getMeterInfo);

// Get stale meters (not synced in 24h)
router.get('/stale', meterController.getStaleMeters);

module.exports = router;