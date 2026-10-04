// src/services/feedbackService.js
const fs = require('fs').promises;
const path = require('path');
const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');   // ✅ ADD THIS
const emailService = require('./emailService');

const STORAGE_DIR = '/home/STORAGE/meterbondhu/feedback_attachment';
const MAX_ATTACHMENTS = 5;

class FeedbackService {
  // ─── Ensure storage dir exists ──────────────────────────────────────
  static async ensureDir() {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch (err) {
      console.error('[FeedbackService] mkdir failed:', err.message);
    }
  }

  // ─── Save base64 image with _N suffix ───────────────────────────────
  static async saveAttachment(base64String, feedbackCode, index) {
    await this.ensureDir();

    let ext = 'jpg';
    let base64Data = base64String;

    const match = base64String.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (match) {
      ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      base64Data = match[2];
    }

    const filename = `${feedbackCode}_${index}.${ext}`;
    const filepath = path.join(STORAGE_DIR, filename);

    await fs.writeFile(filepath, base64Data, { encoding: 'base64' });
    console.log(`[FeedbackService] ✅ Saved: ${filepath}`);
    return filename;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ─── Full feedback submission flow ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  static async submitFeedback({
    user, title, description, pageName, priority, screenshots = [],
  }) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [FeedbackService] New feedback from ${user.m_bondhu_id}`);

    // Validate max 5
    if (screenshots.length > MAX_ATTACHMENTS) {
      throw new Error(`Maximum ${MAX_ATTACHMENTS} screenshots allowed`);
    }

    // ─── Step 1: Insert feedback into DB ─────────────────────────────
    const feedback = await Feedback.create({
      user_serial: user.serial,
      m_bondhu_id: user.m_bondhu_id,
      full_name: user.full_name,
      email: user.email,
      meter_no: user.meter_no,
      account_no: user.account_no,
      title,
      description,
      page_name: pageName,
      priority,
      attachments: [],
    });

    console.log(`[FeedbackService] Inserted feedback: ${feedback.feedback_code}`);

    // ─── Step 2: Save attachments ────────────────────────────────────
    const filenames = [];
    for (let i = 0; i < screenshots.length; i++) {
      try {
        const name = await this.saveAttachment(screenshots[i], feedback.feedback_code, i + 1);
        filenames.push(name);
      } catch (err) {
        console.error(`[FeedbackService] Attachment ${i + 1} failed:`, err.message);
      }
    }

    // ─── Step 3: Update attachments array in DB ──────────────────────
    if (filenames.length > 0) {
      await Feedback.updateAttachments(feedback.serial, filenames);
      feedback.attachments = filenames;
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── Step 4: ✅ INSERT NOTIFICATION ─────────────────────────────
    // ═══════════════════════════════════════════════════════════════
    try {
      const notification = await Notification.create({
        m_bondhu_id: user.m_bondhu_id,
        notification_type: 'success',
        title: '📝 Feedback Received',
        message: `Your feedback "${feedback.feedback_code}" has been received. Our team will review it within 24-48 hours.`,
        data: {
          action: 'feedback_submitted',
          feedback_code: feedback.feedback_code,
          feedback_serial: feedback.serial,
          page_name: pageName,
          priority: priority,
          attachment_count: filenames.length,
          submitted_at: new Date().toISOString(),
        },
      });

      if (notification && notification.notification_id) {
        await Notification.markAsSent(notification.notification_id);
        console.log(`[FeedbackService] ✅ Notification created: ${notification.notification_id}`);
      }
    } catch (notifErr) {
      console.error(`[FeedbackService] ⚠️ Notification failed:`, notifErr.message);
      // Non-fatal — feedback already saved
    }

    // ─── Step 5: Send confirmation email ─────────────────────────────
    try {
      await emailService.sendFeedbackConfirmationEmail(user, feedback, filenames);
      await Feedback.markEmailSent(feedback.serial);
      console.log(`[FeedbackService] ✅ Email sent to ${user.email}`);
    } catch (err) {
      console.error(`[FeedbackService] ⚠️ Email failed:`, err.message);
    }

    return {
      success: true,
      feedback_code: feedback.feedback_code,
      serial: feedback.serial,
      attachment_count: filenames.length,
    };
  }
}

module.exports = FeedbackService;