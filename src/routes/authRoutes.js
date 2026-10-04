// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// ─── Auth Routes ──────────────────────────────────────────────────────────
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.me);
router.post('/acknowledge-welcome', auth, authController.acknowledgeWelcome);

// ─── Settings Routes (PER USER) ──────────────────────────────────────────
router.get('/settings', auth, authController.getSettings);          // ✅ NEW LINE
router.put('/settings', auth, authController.updateSettings);
router.put('/settings/update', auth, authController.updateSingleSetting);
router.put('/profile', auth, authController.updateProfile);

// ─── Forgot Password Routes (public) ─────────────────────────────────────
router.post('/find-by-mobile', authController.findByMobile);
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

// ─── Change Password Routes (logged-in user, OTP-verified) ───────────────
router.post('/change-password/send-otp', auth, authController.sendPasswordChangeOTP);
router.post('/change-password/verify-otp', auth, authController.verifyPasswordChangeOTP);
router.post('/change-password/confirm', auth, authController.confirmPasswordChange);

// ─── Add Alert Email Verification Routes (tenant only) ───────────────────
router.post('/other-emails/send-otp', auth, authController.sendAddEmailOTP);
router.post('/other-emails/verify-otp', auth, authController.verifyAddEmailOTP);
router.post('/other-emails/confirm', auth, authController.confirmAddEmail);

module.exports = router;