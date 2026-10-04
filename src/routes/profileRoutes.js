// src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const profileController = require('../controllers/profileController');

// ─── Profile ───────────────────────────────────────────────────────────
router.get('/', auth, profileController.getProfile);
router.put('/', auth, profileController.updateProfile);

// ─── Password ──────────────────────────────────────────────────────────
router.put('/change-password', auth, profileController.changePassword);

// ─── Other Emails (Tenant only) ────────────────────────────────────────
router.post('/other-emails', auth, profileController.addOtherEmail);
router.delete('/other-emails/:serial', auth, profileController.removeOtherEmail); // ← serial

module.exports = router;