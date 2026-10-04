// src/services/profileService.js
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const Notification = require('../models/Notification');

class ProfileService {
  // ═══════════════════════════════════════════════════════════════════════
  // ─── GET PROFILE ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getProfile(mBondhuId) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ProfileService] 👤 Getting profile for ${mBondhuId}`);

    try {
      const userQuery = `
  SELECT 
    serial, m_bondhu_id, full_name, email, mobile, user_type,
    account_no, meter_no, meter_type,
    email_notification_enabled, push_notification_enabled,
    daily_report_enabled, monthly_report_enabled,
    telegram_notification_enabled,
    low_balance_alert_threshold, high_consumption_threshold,
    created_at, last_login
  FROM user_info 
  WHERE m_bondhu_id = $1 AND is_deleted = false
`;
      const userResult = await pool.query(userQuery, [mBondhuId]);

      if (userResult.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const user = userResult.rows[0];

      // ✅ Get other emails (no is_active — hard-delete schema)
      const emailsQuery = `
        SELECT 
          serial, email, is_verified,
          added_by, added_at, updated_at
        FROM user_other_emails
        WHERE m_bondhu_id = $1
        ORDER BY added_at DESC
      `;
      const emailsResult = await pool.query(emailsQuery, [mBondhuId]);

      return {
        success: true,
        user,
        otherEmails: emailsResult.rows,
      };
    } catch (error) {
      console.error(`[${timestamp}] [ProfileService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── UPDATE PROFILE ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async updateProfile(mBondhuId, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ProfileService] 💾 Updating profile for ${mBondhuId}`);

    try {
      const { full_name, mobile } = data;

      if (mobile && mobile.length !== 11) {
        return { success: false, message: 'Mobile number must be 11 digits' };
      }

      const query = `
        UPDATE user_info
        SET 
          full_name = COALESCE($1, full_name),
          mobile = COALESCE($2, mobile),
          updated_at = CURRENT_TIMESTAMP
        WHERE m_bondhu_id = $3
        RETURNING serial, m_bondhu_id, full_name, email, mobile, user_type, account_no, meter_no
      `;

      const result = await pool.query(query, [full_name, mobile, mBondhuId]);

      if (result.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      await this.createProfileNotification(
        mBondhuId,
        '👤 Profile Updated',
        'Your profile information has been updated successfully.',
        'info'
      );

      return {
        success: true,
        message: 'Profile updated successfully',
        user: result.rows[0],
      };
    } catch (error) {
      console.error(`[${timestamp}] [ProfileService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── CHANGE PASSWORD ───────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async changePassword(mBondhuId, currentPassword, newPassword) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ProfileService] 🔐 Changing password for ${mBondhuId}`);

    try {
      if (!currentPassword || !newPassword) {
        return { success: false, message: 'All password fields are required' };
      }

      if (newPassword.length < 8) {
        return { success: false, message: 'New password must be at least 8 characters' };
      }

      const userQuery = 'SELECT password_hash FROM user_info WHERE m_bondhu_id = $1';
      const userResult = await pool.query(userQuery, [mBondhuId]);

      if (userResult.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      if (!isMatch) {
        return { success: false, message: 'Current password is incorrect' };
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await pool.query(
        'UPDATE user_info SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE m_bondhu_id = $2',
        [newHash, mBondhuId]
      );

      await this.createProfileNotification(
        mBondhuId,
        '🔐 Password Changed',
        'Your account password has been changed successfully. If you did not make this change, please contact support immediately.',
        'warning'
      );

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      console.error(`[${timestamp}] [ProfileService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── ADD OTHER EMAIL (with owner restriction + global uniqueness) ──────
  // ═══════════════════════════════════════════════════════════════════════
  async addOtherEmail(mBondhuId, email) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ProfileService] ➕ Adding other email for ${mBondhuId}: ${email}`);

    try {
      // ─── Get user info ──────────────────────────────────────────────
      const userQuery = 'SELECT email, user_type FROM user_info WHERE m_bondhu_id = $1 AND is_deleted = false';
      const userResult = await pool.query(userQuery, [mBondhuId]);

      if (userResult.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const user = userResult.rows[0];

// ✅ Owner restriction REMOVED — both owner + tenant can add emails

// ─── Normalize + validate ────────────────────────────────────────

      // ─── Normalize + validate ────────────────────────────────────────
      const cleanEmail = email.trim().toLowerCase();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return { success: false, message: 'Invalid email address' };
      }

      // ─── Check 1: own primary? ───────────────────────────────────────
      if (user.email.toLowerCase() === cleanEmail) {
        return { success: false, message: 'This is already your primary email' };
      }

      // ─── Check 2: someone else's primary? ────────────────────────────
      const otherUserPrimary = await pool.query(
        `SELECT m_bondhu_id FROM user_info 
         WHERE LOWER(email) = $1 AND is_deleted = false 
         LIMIT 1`,
        [cleanEmail]
      );
      if (otherUserPrimary.rows.length > 0) {
        return {
          success: false,
          message: 'This email is already registered as another user\'s primary email',
        };
      }

      // ─── Check 3: already in user_other_emails (any user)? ──────────
      const otherUserAlert = await pool.query(
        `SELECT serial, m_bondhu_id FROM user_other_emails 
         WHERE LOWER(email) = $1 
         LIMIT 1`,
        [cleanEmail]
      );
      if (otherUserAlert.rows.length > 0) {
        if (otherUserAlert.rows[0].m_bondhu_id === mBondhuId) {
          return { success: false, message: 'This email is already added' };
        }
        return {
          success: false,
          message: 'This email is already in use as an alert email by another account',
        };
      }

      // ─── Check 4: max 10 limit ───────────────────────────────────────
const countQuery = `
  SELECT COUNT(*)::int AS count FROM user_other_emails 
  WHERE m_bondhu_id = $1
`;
const countResult = await pool.query(countQuery, [mBondhuId]);
const count = countResult.rows[0].count;

if (count >= 10) {
  return { success: false, message: 'Maximum 10 additional emails allowed' };
}

      // ─── Insert (no is_active — hard delete schema) ──────────────────
      const insertQuery = `
        INSERT INTO user_other_emails (m_bondhu_id, email, added_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const insertResult = await pool.query(insertQuery, [
        mBondhuId,
        cleanEmail,
        mBondhuId,
      ]);

      await this.createProfileNotification(
        mBondhuId,
        '📧 Email Added',
        `${cleanEmail} has been added to your alert recipients. You will now receive alerts at this email too.`,
        'success'
      );

      return {
        success: true,
        message: 'Email added successfully',
        email: insertResult.rows[0],
      };
    } catch (error) {
      console.error(`[${timestamp}] [ProfileService] ❌ Error:`, error.message);
      if (error.code === '23505') {
        return { success: false, message: 'This email is already added' };
      }
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── REMOVE OTHER EMAIL (HARD DELETE) ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async removeOtherEmail(mBondhuId, emailSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ProfileService] ➖ Removing email serial: ${emailSerial}`);

    try {
      // ─── Get user info ──────────────────────────────────────────────
      const userQuery = 'SELECT user_type FROM user_info WHERE m_bondhu_id = $1 AND is_deleted = false';
      const userResult = await pool.query(userQuery, [mBondhuId]);

      if (userResult.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const user = userResult.rows[0];

// ✅ Owner restriction REMOVED — both owner + tenant can remove emails

// ─── Verify ownership + fetch email for notification ────────────

      // ─── Verify ownership + fetch email for notification ────────────
      const getQuery = `
        SELECT * FROM user_other_emails 
        WHERE serial = $1 AND m_bondhu_id = $2
      `;
      const getResult = await pool.query(getQuery, [emailSerial, mBondhuId]);

      if (getResult.rows.length === 0) {
        return { success: false, message: 'Email not found' };
      }

      const email = getResult.rows[0].email;

      // ✅ HARD DELETE — row permanently removed
      await pool.query(
        `DELETE FROM user_other_emails WHERE serial = $1 AND m_bondhu_id = $2`,
        [emailSerial, mBondhuId]
      );

      await this.createProfileNotification(
        mBondhuId,
        '📧 Email Removed',
        `${email} has been removed from your alert recipients. You will no longer receive alerts at this email.`,
        'info'
      );

      return { success: true, message: 'Email removed successfully' };
    } catch (error) {
      console.error(`[${timestamp}] [ProfileService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── GET ALL ALERT EMAILS (for sending emails) ─────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getAllAlertEmails(mBondhuId) {
    try {
      const emails = new Set();

      // 1. Primary email
      const userQuery = 'SELECT email FROM user_info WHERE m_bondhu_id = $1 AND is_deleted = false';
      const userResult = await pool.query(userQuery, [mBondhuId]);

      if (userResult.rows[0]?.email) {
        emails.add(userResult.rows[0].email);
      }

      // 2. Other emails (no is_active — hard-delete schema)
      const otherQuery = `
        SELECT email FROM user_other_emails
        WHERE m_bondhu_id = $1
        ORDER BY added_at ASC
      `;
      const otherResult = await pool.query(otherQuery, [mBondhuId]);

      otherResult.rows.forEach((row) => emails.add(row.email));

      const allEmails = Array.from(emails);

      console.log(
        `[ProfileService] 📧 Found ${allEmails.length} alert email(s) for ${mBondhuId}`
      );

      return allEmails;
    } catch (error) {
      console.error(`[ProfileService] ❌ Error:`, error.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── CREATE PROFILE NOTIFICATION ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async createProfileNotification(mBondhuId, title, message, type = 'info') {
    try {
      const notification = await Notification.create({
        m_bondhu_id: mBondhuId,
        notification_type: type,
        title,
        message,
        data: {
          action: 'profile_update',
          timestamp: new Date().toISOString(),
        },
      });

      if (notification) {
        await Notification.markAsSent(notification.notification_id);
      }
    } catch (error) {
      console.error(`[ProfileService] ⚠️ Notification error:`, error.message);
    }
  }
}

module.exports = new ProfileService();