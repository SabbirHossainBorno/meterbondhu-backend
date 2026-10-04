// src/controllers/feedbackController.js
const FeedbackService = require('../services/feedbackService');
const { pool } = require('../config/database');

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/feedback/submit
// ═══════════════════════════════════════════════════════════════════════════
exports.submitFeedback = async (req, res) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [FeedbackController] POST /submit`);

  try {
    const { title, description, pageName, priority, screenshots } = req.body;

    // ─── Validation ──────────────────────────────────────────────────
    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Title must be at least 3 characters',
      });
    }

    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Description must be at least 10 characters',
      });
    }

    const VALID_PAGES = [
      'Home', 'Recharge', 'More', 'Profile', 'Notifications',
      'Meter Management', 'Help & Support', 'Other',
    ];
    if (!pageName || !VALID_PAGES.includes(pageName)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid page',
      });
    }

    const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
    if (!priority || !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid priority',
      });
    }

    if (Array.isArray(screenshots) && screenshots.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 screenshots allowed',
      });
    }

    // ─── Fetch user ──────────────────────────────────────────────────
    const userRes = await pool.query(
      `SELECT serial, m_bondhu_id, full_name, email, meter_no, account_no
       FROM user_info WHERE serial = $1 LIMIT 1`,
      [req.user.serial]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userRes.rows[0];

    // ─── Submit ──────────────────────────────────────────────────────
    const result = await FeedbackService.submitFeedback({
      user,
      title: title.trim(),
      description: description.trim(),
      pageName,
      priority,
      screenshots: screenshots || [],
    });

    res.json({
      success: true,
      data: result,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error(`[FeedbackController] Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit feedback',
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/feedback/my  (user's own history)
// ═══════════════════════════════════════════════════════════════════════════
exports.getMyFeedback = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT serial, feedback_code, title, description, page_name,
              priority, attachments, status, admin_note, created_at
       FROM feedback
       WHERE user_serial = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.serial]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[FeedbackController] getMyFeedback error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};