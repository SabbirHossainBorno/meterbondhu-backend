// src/controllers/notificationController.js
const { pool } = require('../config/database');
const Notification = require('../models/Notification');
const User = require('../models/User');

// ─── Get User's Notifications ──────────────────────────────────────────────
exports.getUserNotifications = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [NotificationController] 📨 Getting notifications for user: ${req.user.m_bondhu_id}`);
  
  try {
    const notifications = await Notification.findByMBondhuId(req.user.m_bondhu_id, 50);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error(`[${timestamp}] [NotificationController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Unread Count ──────────────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [NotificationController] 📊 Getting unread count for: ${req.user.m_bondhu_id}`);
  
  try {
    const count = await Notification.getUnreadCount(req.user.m_bondhu_id);
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error(`[${timestamp}] [NotificationController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Mark as Read ──────────────────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [NotificationController] ✅ Marking notification as read: ${req.params.notification_id}`);
  
  try {
    const notification = await Notification.markAsRead(req.params.notification_id);
    res.json({ success: true, notification });
  } catch (error) {
    console.error(`[${timestamp}] [NotificationController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Mark All as Read ──────────────────────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [NotificationController] ✅ Marking all notifications as read for: ${req.user.m_bondhu_id}`);
  
  try {
    await Notification.markAllAsRead(req.user.m_bondhu_id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error(`[${timestamp}] [NotificationController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Send Notification ──────────────────────────────────────────────────────
exports.sendNotification = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [NotificationController] 📨 Sending notification to: ${req.user.m_bondhu_id}`);
  
  try {
    const { title, message, type, data } = req.body;
    const user = await User.findById(req.user.serial);

    const notification = await Notification.create({
      m_bondhu_id: req.user.m_bondhu_id,
      notification_type: type || 'info',
      title: title,
      message: message,
      data: data || {},
    });

    res.json({
      success: true,
      notification,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error(`[${timestamp}] [NotificationController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};