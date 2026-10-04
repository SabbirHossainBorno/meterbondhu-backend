// src/models/User.js
const { pool } = require('../config/database');
const IDGenerator = require('../utils/idGenerator');
const bcrypt = require('bcryptjs');

class User {
  // ─── Create User ──────────────────────────────────────────────────────────
  static async create(userData) {
    const timestamp = new Date().toISOString();
    const {
      full_name, email, mobile, password, user_type,
      account_no, meter_no, meter_type
    } = userData;

    console.log(`\n[${timestamp}] [User.create] ═══════════════════════════════════════`);
    console.log(`[User.create] 📝 Creating user`);
    console.log(`[User.create]    full_name: ${full_name}`);
    console.log(`[User.create]    email: ${email || '(null)'}`);
    console.log(`[User.create]    mobile: ${mobile}`);
    console.log(`[User.create]    user_type: ${user_type}`);
    console.log(`[User.create]    account_no: ${account_no || '(null)'}`);
    console.log(`[User.create]    meter_no: ${meter_no || '(null)'}`);
    console.log(`[User.create]    meter_type: ${meter_type || 'desco'}`);

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    console.log(`[User.create] 🔐 Password hashed`);

    const serialResult = await pool.query(
      "SELECT nextval('user_info_serial_seq') AS serial"
    );
    const serial = serialResult.rows[0].serial;
    const m_bondhu_id = IDGenerator.generateMBondhuId(serial);

    console.log(`[User.create] 🔢 Generated serial: ${serial}, m_bondhu_id: ${m_bondhu_id}`);

    const query = `
      INSERT INTO user_info (
        m_bondhu_id, full_name, email, mobile, password_hash, 
        user_type, account_no, meter_no, meter_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      m_bondhu_id,
      full_name,
      email || null,
      mobile,
      password_hash,
      user_type || 'tenant',
      account_no || null,     // ✅ NULL allowed (owner skip meter)
      meter_no || null,       // ✅ NULL allowed
      meter_type || 'desco'
    ];

    console.log(`[User.create] 💾 Inserting into user_info...`);

    try {
      const result = await pool.query(query, values);
      console.log(`[User.create] ✅ User created — serial: ${result.rows[0].serial}`);
      console.log(`[User.create] ══════════════════════════════════════════════════════\n`);
      return result.rows[0];
    } catch (error) {
      console.error(`[User.create] ❌ Insert failed:`, error.message);
      console.error(`[User.create] ❌ Error code:`, error.code);
      console.error(`[User.create] ❌ Error detail:`, error.detail);
      console.error(`[User.create] ══════════════════════════════════════════════════════\n`);
      throw error;
    }
  }

  // ─── Find User by Email ──────────────────────────────────────────────────
  static async findByEmail(email) {
    const query = 'SELECT * FROM user_info WHERE email = $1 AND is_deleted = false';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  // ─── Find User by Mobile ─────────────────────────────────────────────────
  static async findByMobile(mobile) {
    const query = 'SELECT * FROM user_info WHERE mobile = $1 AND is_deleted = false';
    const result = await pool.query(query, [mobile]);
    return result.rows[0];
  }

  // ─── Find User by Email OR Mobile ────────────────────────────────────────
  static async findByEmailOrMobile(identifier) {
    const query = `
      SELECT * FROM user_info 
      WHERE (email = $1 OR mobile = $1) 
        AND is_deleted = false
      LIMIT 1
    `;
    const result = await pool.query(query, [identifier]);
    return result.rows[0];
  }

  // ─── Find User by ID (Serial) ────────────────────────────────────────────
  static async findById(serial) {
    const query = 'SELECT * FROM user_info WHERE serial = $1 AND is_deleted = false';
    const result = await pool.query(query, [serial]);
    return result.rows[0];
  }

  // ─── Find User by m_bondhu_id ────────────────────────────────────────────
  static async findByMBondhuId(m_bondhu_id) {
    const query = 'SELECT * FROM user_info WHERE m_bondhu_id = $1 AND is_deleted = false';
    const result = await pool.query(query, [m_bondhu_id]);
    return result.rows[0];
  }

  // ─── Find User by Account Number ─────────────────────────────────────────
  static async findByAccountNo(account_no) {
    const query = 'SELECT * FROM user_info WHERE account_no = $1 AND is_deleted = false';
    const result = await pool.query(query, [account_no]);
    return result.rows[0];
  }

  // ─── Find User by Meter Number ────────────────────────────────────────────
  static async findByMeterNo(meter_no) {
    const query = 'SELECT * FROM user_info WHERE meter_no = $1 AND is_deleted = false';
    const result = await pool.query(query, [meter_no]);
    return result.rows[0];
  }

  // ─── Update Last Login ────────────────────────────────────────────────────
  static async updateLastLogin(serial) {
    const query = 'UPDATE user_info SET last_login = CURRENT_TIMESTAMP WHERE serial = $1';
    await pool.query(query, [serial]);
  }

  // ─── Compare Password ────────────────────────────────────────────────────
  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // ─── Get All Active Users ────────────────────────────────────────────────
  static async getAllActiveUsers() {
    const query = `
      SELECT * FROM user_info 
      WHERE is_deleted = false AND is_active = true
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // ─── Get All Users ──────────────────────────────────────────────────────
  static async getAllUsers() {
    const query = `
      SELECT * FROM user_info 
      WHERE is_deleted = false
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // ─── UPDATE NOTIFICATION SETTINGS (PER USER) ─────────────────────────────
static async updateNotificationSettings(serial, settings) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [User Model] 🔄 Updating settings for user serial: ${serial}`);
  console.log(`[${timestamp}] [User Model] 📊 Settings:`, JSON.stringify(settings, null, 2));

  const {
    email_notification_enabled,
    push_notification_enabled,
    daily_report_enabled,
    monthly_report_enabled,          // ✅ ADD THIS LINE
    low_balance_alert_threshold,
  } = settings;

  const query = `
    UPDATE user_info 
    SET 
      email_notification_enabled = COALESCE($1, email_notification_enabled),
      push_notification_enabled = COALESCE($2, push_notification_enabled),
      daily_report_enabled = COALESCE($3, daily_report_enabled),
      monthly_report_enabled = COALESCE($4, monthly_report_enabled),   -- ✅ ADD THIS
      low_balance_alert_threshold = COALESCE($5, low_balance_alert_threshold),
      updated_at = CURRENT_TIMESTAMP
    WHERE serial = $6
    RETURNING *
  `;

  const values = [
    email_notification_enabled !== undefined ? email_notification_enabled : null,
    push_notification_enabled !== undefined ? push_notification_enabled : null,
    daily_report_enabled !== undefined ? daily_report_enabled : null,
    monthly_report_enabled !== undefined ? monthly_report_enabled : null,  // ✅ ADD
    low_balance_alert_threshold !== undefined ? low_balance_alert_threshold : null,
    serial                                                   // ✅ $6 now
  ];

  const result = await pool.query(query, values);
  console.log(`[${timestamp}] [User Model] ✅ Settings updated for user ${serial}`);
  return result.rows[0];
}

  // ─── Get User Notification Settings ──────────────────────────────────────
  static async getNotificationSettings(serial) {
    const query = `
      SELECT 
        serial,
        full_name,
        email,
        mobile,
        account_no,
        meter_no,
        user_type,
        email_notification_enabled,
        push_notification_enabled,
        daily_report_enabled,
        low_balance_alert_threshold,
        high_consumption_threshold
      FROM user_info 
      WHERE serial = $1 AND is_deleted = false
    `;
    const result = await pool.query(query, [serial]);
    return result.rows[0];
  }

  // ─── Update User Profile ─────────────────────────────────────────────────
  static async updateProfile(serial, data) {
    const {
      full_name,
      email,
      mobile,
      user_type,
      account_no,
      meter_no
    } = data;

    const query = `
      UPDATE user_info 
      SET 
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        mobile = COALESCE($3, mobile),
        user_type = COALESCE($4, user_type),
        account_no = COALESCE($5, account_no),
        meter_no = COALESCE($6, meter_no),
        updated_at = CURRENT_TIMESTAMP
      WHERE serial = $7
      RETURNING *
    `;

    const values = [
      full_name || null,
      email || null,
      mobile || null,
      user_type || null,
      account_no || null,
      meter_no || null,
      serial
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ─── Update User Password ────────────────────────────────────────────────
  static async updatePassword(serial, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    const query = `
      UPDATE user_info 
      SET 
        password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE serial = $2
      RETURNING *
    `;

    const result = await pool.query(query, [password_hash, serial]);
    return result.rows[0];
  }

  // ─── Deactivate User ─────────────────────────────────────────────────────
  static async deactivateUser(serial) {
    const query = `
      UPDATE user_info 
      SET 
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE serial = $1 AND is_deleted = false
      RETURNING *
    `;
    const result = await pool.query(query, [serial]);
    return result.rows[0];
  }

  // ─── Activate User ──────────────────────────────────────────────────────
  static async activateUser(serial) {
    const query = `
      UPDATE user_info 
      SET 
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE serial = $1 AND is_deleted = false
      RETURNING *
    `;
    const result = await pool.query(query, [serial]);
    return result.rows[0];
  }

  // ─── Soft Delete User ────────────────────────────────────────────────────
  static async deleteUser(serial) {
    const query = `
      UPDATE user_info 
      SET 
        is_deleted = true,
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE serial = $1
      RETURNING *
    `;
    const result = await pool.query(query, [serial]);
    return result.rows[0];
  }

  // ─── Get Users with Email Notification Enabled ──────────────────────────
  static async getUsersWithEmailEnabled() {
    const query = `
      SELECT * FROM user_info 
      WHERE is_deleted = false 
        AND is_active = true 
        AND email_notification_enabled = true
        AND email IS NOT NULL
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // ─── Count Active Users ──────────────────────────────────────────────────
  static async countActiveUsers() {
    const query = 'SELECT COUNT(*) FROM user_info WHERE is_deleted = false AND is_active = true';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  }

  // ─── Search Users ────────────────────────────────────────────────────────
  static async searchUsers(searchTerm) {
    const query = `
      SELECT * FROM user_info 
      WHERE is_deleted = false 
        AND (
          full_name ILIKE $1 OR
          email ILIKE $1 OR
          mobile ILIKE $1 OR
          account_no ILIKE $1 OR
          meter_no ILIKE $1 OR
          m_bondhu_id ILIKE $1
        )
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [`%${searchTerm}%`]);
    return result.rows;
  }
}

module.exports = User;