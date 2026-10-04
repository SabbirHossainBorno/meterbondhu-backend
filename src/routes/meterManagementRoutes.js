// src/routes/meterManagementRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const meterManagementController = require('../controllers/meterManagementController');

// ─── Unbind Meter ──────────────────────────────────────────────────────
router.post('/unbind', auth, meterManagementController.unbindMeter);

// ─── Re-add Unbind Meter ───────────────────────────────────────────────
router.post('/readd', auth, meterManagementController.readdMeter);

// ─── Get Unbind Meters ─────────────────────────────────────────────────
router.get('/unbind-list', auth, meterManagementController.getUnbindMeters);

// ─── Get Owner Meters (with tenant info) ───────────────────────────────
router.get('/owner', auth, meterManagementController.getOwnerMeters);

// ─── Get Tenant Meters (with unbind) ───────────────────────────────────
router.get('/tenant', auth, meterManagementController.getTenantMeters);

// ─── Update Tenant Meter Config ────────────────────────────────────────
router.put('/tenant-config', auth, meterManagementController.updateTenantConfig);

// ─── ✅ NEW: Tenant add/edit/delete (owner only) ───────────────────────
router.post('/tenant/add', auth, meterManagementController.addTenant);
router.put('/tenant/:tenantSerial', auth, meterManagementController.updateTenant);
router.delete('/tenant/:tenantSerial', auth, meterManagementController.deleteTenant);

module.exports = router;