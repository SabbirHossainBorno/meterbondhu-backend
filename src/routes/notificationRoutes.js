// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// ─── Get User Notifications ──────────────────────────────────────────────
router.get('/', auth, notificationController.getUserNotifications);

// ─── Get Unread Count ────────────────────────────────────────────────────
router.get('/unread-count', auth, notificationController.getUnreadCount);

// ─── Mark as Read ──────────────────────────────────────────────────────
router.put('/:notification_id/read', auth, notificationController.markAsRead);

// ─── Mark All as Read ─────────────────────────────────────────────────
router.put('/read-all', auth, notificationController.markAllAsRead);

// ─── Send Notification ──────────────────────────────────────────────────
router.post('/send', auth, notificationController.sendNotification);

module.exports = router;