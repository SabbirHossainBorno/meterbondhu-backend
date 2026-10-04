// src/controllers/authController.js
const User = require('../models/User');
const Meter = require('../models/Meter');
const Notification = require('../models/Notification');
const DescoService = require('../services/descoService');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const telegramService = require('../services/telegramService');
const { pool } = require('../config/database');

const generateToken = (user) => {
  return jwt.sign(
    { serial: user.serial, m_bondhu_id: user.m_bondhu_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─── OTP Storage ──────────────────────────────────────────────────────────
const otpStore = {};

// @desc    Register User
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  const timestamp = new Date().toISOString();
  const tag = '[Register]';

  console.log(`\n${'═'.repeat(75)}`);
  console.log(`[${timestamp}] ${tag} 🚀 Registration request received`);
  console.log(`${'═'.repeat(75)}`);

  try {
    const {
      full_name, email, mobile, password, user_type,
      account_no, meter_no, meter_type,
      skip_meter,
      tenants = []
    } = req.body;

    // ─── Log incoming payload ────────────────────────────────────────
    console.log(`${tag} 📥 Request body:`);
    console.log(`${tag}    full_name: ${full_name}`);
    console.log(`${tag}    email: ${email || '(null)'}`);
    console.log(`${tag}    mobile: ${mobile}`);
    console.log(`${tag}    user_type: ${user_type}`);
    console.log(`${tag}    account_no: ${account_no || '(null)'}`);
    console.log(`${tag}    meter_no: ${meter_no || '(null)'}`);
    console.log(`${tag}    meter_type: ${meter_type || 'desco'}`);
    console.log(`${tag}    skip_meter: ${skip_meter}`);
    console.log(`${tag}    tenants count: ${Array.isArray(tenants) ? tenants.length : 0}`);

    if (Array.isArray(tenants) && tenants.length > 0) {
      tenants.forEach((t, i) => {
        console.log(`${tag}    tenant[${i}]: flat="${t.flat}", name="${t.name || '(null)'}", account_no="${t.account_no}", meter_no="${t.meter_no}"`);
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── Validation ────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    console.log(`\n${tag} 🔍 Step 1: Validating input...`);

    if (!full_name || !mobile || !password || !user_type) {
      console.log(`${tag} ❌ Missing required fields`);
      return res.status(400).json({
        success: false,
        message: 'full_name, mobile, password, user_type are required',
      });
    }

    if (user_type === 'tenant') {
      if (!account_no || !meter_no) {
        console.log(`${tag} ❌ Tenant missing account_no or meter_no`);
        return res.status(400).json({
          success: false,
          message: 'Tenant must provide account number and meter number',
        });
      }
    }

    if (user_type === 'owner' && !skip_meter) {
      if (!account_no || !meter_no) {
        console.log(`${tag} ❌ Owner missing meter details and skip_meter not set`);
        return res.status(400).json({
          success: false,
          message: 'Please provide meter details or skip',
        });
      }
    }

    console.log(`${tag} ✅ Validation passed`);

    // ═══════════════════════════════════════════════════════════════════
    // ─── Uniqueness checks ─────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    console.log(`\n${tag} 🔍 Step 2: Uniqueness checks...`);

    if (email) {
      console.log(`${tag}    Checking email: ${email}`);
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        console.log(`${tag} ❌ Email already registered`);
        return res.status(400).json({
          success: false,
          message: 'This email is already registered. Please login.',
          errorType: 'EMAIL_EXISTS',
        });
      }

      const emailUsedAsAlert = await pool.query(
        `SELECT serial FROM user_other_emails WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      if (emailUsedAsAlert.rows.length > 0) {
        console.log(`${tag} ❌ Email used as alert email`);
        return res.status(400).json({
          success: false,
          message: 'This email is already in use as an alert email.',
          errorType: 'EMAIL_USED_AS_ALERT',
        });
      }
      console.log(`${tag}    ✅ Email available`);
    }

    console.log(`${tag}    Checking mobile: ${mobile}`);
    const existingMobile = await User.findByMobile(mobile);
    if (existingMobile) {
      console.log(`${tag} ❌ Mobile already registered`);
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered.',
        errorType: 'MOBILE_EXISTS',
      });
    }
    console.log(`${tag}    ✅ Mobile available`);

    if (account_no && meter_no) {
      console.log(`${tag}    Checking meter: ${meter_no}`);
      const existingMeter = await pool.query(
        'SELECT serial, user_serial FROM meter_info WHERE meter_no = $1',
        [meter_no]
      );

      if (existingMeter.rows.length > 0 && existingMeter.rows[0].user_serial !== null) {
        console.log(`${tag} ❌ Meter already registered to user ${existingMeter.rows[0].user_serial}`);
        return res.status(400).json({
          success: false,
          message: 'This meter is already registered with another account.',
          errorType: 'METER_EXISTS',
        });
      }
      console.log(`${tag}    ✅ Meter available`);
    }

    console.log(`${tag} ✅ All uniqueness checks passed`);

    // ═══════════════════════════════════════════════════════════════════
    // ─── 1. Create user ────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    console.log(`\n${tag} 🔍 Step 3: Creating user account...`);

    const user = await User.create({
      full_name,
      email: email || null,
      mobile,
      password,
      user_type,
      account_no: skip_meter ? null : account_no,
      meter_no: skip_meter ? null : meter_no,
      meter_type: meter_type || 'desco',
    });

    console.log(`${tag} ✅ User created — serial: ${user.serial}, m_bondhu_id: ${user.m_bondhu_id}`);

    // ═══════════════════════════════════════════════════════════════════
    // ─── 2. Owner's own meter (if not skipped) ─────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    if (user_type === 'owner' && !skip_meter && account_no && meter_no) {
      console.log(`\n${tag} 🔍 Step 4: Adding owner's own meter...`);

      try {
        console.log(`${tag}    Fetching DESCO info for ${account_no}/${meter_no}...`);
        const descoData = await DescoService.getCustomerInfo(account_no, meter_no);
        console.log(`${tag}    ✅ DESCO data received — customer: ${descoData.customerName}`);

        const existingMeterRow = await pool.query(
          'SELECT serial FROM meter_info WHERE meter_no = $1',
          [meter_no]
        );

        if (existingMeterRow.rows.length === 0) {
          console.log(`${tag}    Meter doesn't exist — creating new meter_info entry`);

          await Meter.create({
            user_serial: user.serial,
            account_no,
            meter_no: descoData.meterNo || meter_no,
            customer_name: descoData.customerName,
            contact_no: descoData.contactNo,
            installation_address: descoData.installationAddress,
            feeder_name: descoData.feederName,
            installation_date: descoData.installationDate,
            phase_type: descoData.phaseType,
            sanction_load: descoData.sanctionLoad,
            tariff_solution: descoData.tariffSolution,
            meter_model: descoData.meterModel,
            transformer: descoData.transformer,
            sd_name: descoData.SDName,
            sync_status: 'success',
          });

          console.log(`${tag}    ✅ Owner meter created`);
        } else {
          console.log(`${tag}    Meter already exists — linking to owner`);

          await pool.query(
            'UPDATE meter_info SET user_serial = $1 WHERE meter_no = $2',
            [user.serial, meter_no]
          );

          console.log(`${tag}    ✅ Owner meter linked`);
        }
      } catch (error) {
        console.warn(`${tag} ⚠️ Owner meter fetch failed: ${error.message}`);
        console.warn(`${tag}    Continuing registration without owner meter`);
      }
    } else if (user_type === 'owner' && skip_meter) {
      console.log(`\n${tag} ⏭️ Step 4: Owner skipped meter — skipping`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── 3. Tenant's own meter (if tenant signup) ──────────────────────
    // ═══════════════════════════════════════════════════════════════════
    if (user_type === 'tenant' && account_no && meter_no) {
      console.log(`\n${tag} 🔍 Step 5: Adding tenant's own meter...`);

      const tenantService = require('../services/tenantService');

      const existing = await pool.query(
        'SELECT serial, user_serial FROM meter_info WHERE meter_no = $1',
        [meter_no]
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].user_serial === null) {
          console.log(`${tag}    Meter exists with user_serial=NULL — linking to tenant`);
          await tenantService.linkTenantToMeter(user.serial, meter_no);
          console.log(`${tag}    ✅ Linked to tenant`);
        } else {
          console.log(`${tag}    ⚠️ Meter already linked to user ${existing.rows[0].user_serial} — skipping`);
        }
      } else {
        console.log(`${tag}    Meter doesn't exist — creating new meter_info entry for tenant`);

        try {
          const descoData = await DescoService.getCustomerInfo(account_no, meter_no);
          await Meter.create({
            user_serial: user.serial,
            account_no,
            meter_no: descoData.meterNo || meter_no,
            customer_name: descoData.customerName,
            contact_no: descoData.contactNo,
            installation_address: descoData.installationAddress,
            feeder_name: descoData.feederName,
            installation_date: descoData.installationDate,
            phase_type: descoData.phaseType,
            sanction_load: descoData.sanctionLoad,
            tariff_solution: descoData.tariffSolution,
            meter_model: descoData.meterModel,
            transformer: descoData.transformer,
            sd_name: descoData.SDName,
            sync_status: 'success',
          });
          console.log(`${tag}    ✅ Tenant meter created`);
        } catch (error) {
          console.warn(`${tag} ⚠️ Tenant meter fetch failed: ${error.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── 4. Owner's tenants (if owner signup) ──────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    if (user_type === 'owner' && Array.isArray(tenants) && tenants.length > 0) {
      console.log(`\n${tag} 🔍 Step 6: Adding ${tenants.length} tenant(s) for owner...`);

      const tenantService = require('../services/tenantService');

      for (let i = 0; i < tenants.length; i++) {
        const t = tenants[i];
        console.log(`${tag}    [${i + 1}/${tenants.length}] Adding tenant: "${t.flat}"`);

        try {
          const result = await tenantService.addTenant(user.serial, {
            flat: t.flat,
            name: t.name || null,
            account_no: t.account_no,
            meter_no: t.meter_no,
            desco_data: t.desco_data,
          });

          if (result.success) {
            console.log(`${tag}    ✅ Tenant "${t.flat}" added successfully`);
          } else {
            console.error(`${tag}    ❌ Tenant "${t.flat}" failed: ${result.message}`);
          }
        } catch (err) {
          console.error(`${tag}    ❌ Tenant "${t.flat}" threw error: ${err.message}`);
        }
      }

      console.log(`${tag} ✅ Tenant addition step complete`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── 5. Response ───────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    console.log(`\n${tag} 🔍 Step 7: Building response...`);

    const token = generateToken(user);
    delete user.password_hash;

        // Welcome email (skip if no email)
    if (user.email) {
      try {
        // ✅ Pass tenants array (owner-এর ক্ষেত্রে) — email-এ দেখাবে
        await emailService.sendWelcomeEmail(
          user,
          user_type === 'owner' ? tenants : []
        );
        console.log('✅ Welcome email sent to:', user.email);
      } catch (emailError) {
        console.error('❌ Welcome email failed:', emailError.message);
      }
    }

    console.log(`${tag}    Sending Telegram notification...`);
    try {
      await telegramService.sendNewUserNotification(user);
      console.log(`${tag}    ✅ Telegram sent`);
    } catch (telegramError) {
      console.error(`${tag}    ❌ Telegram failed: ${telegramError.message}`);
    }

    console.log(`\n${'═'.repeat(75)}`);
    console.log(`[${timestamp}] ${tag} ✅ ✅ ✅ REGISTRATION SUCCESSFUL`);
    console.log(`${tag}    User: ${user.m_bondhu_id} (${user.full_name})`);
    console.log(`${tag}    Type: ${user.user_type}`);
    console.log(`${'═'.repeat(75)}\n`);

    res.status(201).json({
      success: true,
      token,
      user,
      message: 'User registered successfully',
    });
  } catch (error) {
    console.error(`\n${'═'.repeat(75)}`);
    console.error(`[${timestamp}] ${tag} ❌ ❌ ❌ REGISTRATION FAILED`);
    console.error(`${tag}    Error: ${error.message}`);
    console.error(`${tag}    Error code: ${error.code || 'N/A'}`);
    console.error(`${tag}    Error detail: ${error.detail || 'N/A'}`);
    console.error(`${tag}    Error constraint: ${error.constraint || 'N/A'}`);
    console.error(`${tag}    Stack trace:`);
    console.error(error.stack);
    console.error(`${'═'.repeat(75)}\n`);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Login User (Email OR Mobile)
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    // ✅ Accept both `email` (backward compatible) and `identifier`
    const { identifier, email, password } = req.body;
    const loginId = (identifier || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Mobile and password are required',
        errorType: 'VALIDATION_ERROR',
      });
    }

    // ─── Detect: email or mobile? ─────────────────────────────────────
    const isEmail = loginId.includes('@');

    // Basic mobile validation
    if (!isEmail && !/^\d{11}$/.test(loginId)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email or 11-digit mobile number',
        errorType: 'VALIDATION_ERROR',
      });
    }

    console.log(
      `[${timestamp}] [AuthController] 🔐 Login attempt: ${loginId} (${isEmail ? 'email' : 'mobile'})`
    );

    // ─── Find user by email OR mobile ─────────────────────────────────
    const user = await User.findByEmailOrMobile(loginId);

    if (!user) {
      console.log(`[${timestamp}] [AuthController] ❌ User not found: ${loginId}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errorType: 'INVALID_CREDENTIALS',
      });
    }

    // ─── Password check ───────────────────────────────────────────────
    const isMatch = await User.comparePassword(password, user.password_hash);
    if (!isMatch) {
      console.log(`[${timestamp}] [AuthController] ❌ Wrong password for: ${loginId}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errorType: 'INVALID_CREDENTIALS',
      });
    }

        // ⚠️ IMPORTANT: Check last_login BEFORE updating it
    const isFirstLogin = !user.last_login;

    console.log(
      `[${timestamp}] [AuthController] 🔍 isFirstLogin: ${isFirstLogin} (last_login: ${user.last_login || 'null'})`
    );

    // ⚠️ DON'T update last_login here — wait for user to acknowledge welcome modal
    // last_login will be updated via /auth/acknowledge-welcome

    const token = generateToken(user);
    delete user.password_hash;

    // ═══════════════════════════════════════════════════════════════════
    // ✅ Background sync (non-blocking)
    // ═══════════════════════════════════════════════════════════════════
    setImmediate(async () => {
      try {
        const dailyConsumptionService = require('../services/dailyConsumptionService');
        const monthlyConsumptionService = require('../services/monthlyConsumptionService');

        console.log(`[AuthController] 🚀 Background sync triggered for ${user.m_bondhu_id}`);

        try {
          const dailyResult = await dailyConsumptionService.syncOnLogin(
            user.meter_no,
            user.account_no
          );
          console.log(`[AuthController] ✅ Daily sync:`, dailyResult);
        } catch (dailyErr) {
          console.error(`[AuthController] ⚠️ Daily sync failed:`, dailyErr.message);
        }

        await new Promise((r) => setTimeout(r, 500));

        try {
          const monthlyResult = await monthlyConsumptionService.syncOnLogin(
            user.meter_no,
            user.account_no
          );
          console.log(`[AuthController] ✅ Monthly sync:`, monthlyResult);
        } catch (monthlyErr) {
          console.error(`[AuthController] ⚠️ Monthly sync failed:`, monthlyErr.message);
        }
      } catch (syncError) {
        console.error(`[AuthController] ⚠️ Background sync failed:`, syncError.message);
      }
    });

    // ─── Telegram notification ────────────────────────────────────────
    try {
      const message = `
🔐 <b>User Logged In</b>

👤 <b>Name:</b> ${user.full_name}
📧 <b>Email:</b> ${user.email}
📱 <b>Mobile:</b> ${user.mobile}
🆔 <b>ID:</b> ${user.m_bondhu_id}

📅 <b>Time:</b> ${new Date().toLocaleString()}
      `;
      await telegramService.sendMessage(message);
    } catch (telegramError) {
      console.error('❌ Login notification failed:', telegramError.message);
    }

        res.json({
      success: true,
      token,
      user,
      isFirstLogin,       // ✅ NEW — frontend welcome modal-এর জন্য
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Acknowledge welcome modal (mark last_login)
// @route   POST /api/auth/acknowledge-welcome
// @access  Private
exports.acknowledgeWelcome = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AuthController] ✅ Acknowledging welcome for ${req.user.m_bondhu_id}`);

  try {
    await User.updateLastLogin(req.user.serial);

    console.log(`[${timestamp}] [AuthController] ✅ last_login updated for ${req.user.m_bondhu_id}`);

    res.json({
      success: true,
      message: 'Welcome acknowledged',
    });
  } catch (error) {
    console.error(`[${timestamp}] [AuthController] ❌ acknowledgeWelcome error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get Current User
// @route   GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.serial);
    delete user.password_hash;
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ─── UPDATE SETTINGS (BULK - OLD) ───────────────────────────────────────
// @desc    Update User Settings
// @route   PUT /api/auth/settings
exports.updateSettings = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AuthController] ⚙️ Updating settings for user: ${req.user.serial} (${req.user.m_bondhu_id})`);
  
  try {
    const {
      email_notification_enabled,
      push_notification_enabled,
      low_balance_alert_threshold,
      daily_report_enabled,
      monthly_report_enabled,
    } = req.body;

    console.log(`[${timestamp}] [AuthController] 📊 Payload:`, JSON.stringify(req.body, null, 2));

    const updatedUser = await User.updateNotificationSettings(req.user.serial, {
      email_notification_enabled,
      push_notification_enabled,
      low_balance_alert_threshold,
      daily_report_enabled,
      monthly_report_enabled,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    delete updatedUser.password_hash;

    console.log(`[${timestamp}] [AuthController] ✅ Settings updated for user: ${req.user.serial}`);
    console.log(`[${timestamp}] [AuthController] 📊 New threshold: ${updatedUser.low_balance_alert_threshold}`);

    res.json({
      success: true,
      user: updatedUser,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error(`[${timestamp}] [AuthController] ❌ Update settings error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── CHANGE PASSWORD FLOW (Logged-in user, OTP-verified) ───────────────────
// ═══════════════════════════════════════════════════════════════════════════

// @desc    Send OTP for password change (logged-in user)
// @route   POST /api/auth/change-password/send-otp
exports.sendPasswordChangeOTP = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AuthController] 📧 Change-password OTP request for: ${req.user.email}`);

  try {
    const user = await User.findById(req.user.serial);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const email = user.email;
    const now = Date.now();
    const lastAttempt = otpStore[`${email}_cp_last`] || 0;
    const attempts = otpStore[`${email}_cp_attempts`] || 0;

    if (attempts >= 3 && (now - lastAttempt) < 60000) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please wait 1 minute.',
        locked: true,
        waitTime: Math.ceil((60000 - (now - lastAttempt)) / 1000),
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000;

    otpStore[`${email}_cp`] = {
      otp,
      expiresAt,
      attempts: 0,
      verified: false,
      verifiedAt: null,
      purpose: 'change_password',
    };
    otpStore[`${email}_cp_last`] = now;
    otpStore[`${email}_cp_attempts`] = (attempts || 0) + 1;

    console.log(`📧 Change-password OTP for ${email}: ${otp}`);

    try {
      await emailService.sendPasswordChangeOTPEmail(user, otp);
      console.log('✅ Change-password OTP email sent to:', email);
    } catch (emailError) {
      console.error('❌ Change-password OTP email failed:', emailError.message);
      return res.json({
        success: true,
        message: 'OTP sent to your email',
        debug: otp,
      });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      expiresIn: 300,
    });
  } catch (error) {
    console.error('sendPasswordChangeOTP error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP for password change
// @route   POST /api/auth/change-password/verify-otp
exports.verifyPasswordChangeOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.user.email;

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Invalid OTP format' });
    }

    const storedData = otpStore[`${email}_cp`];
    if (!storedData) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    if (storedData.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'Too many wrong attempts. Please request a new OTP.' });
    }

    if (Date.now() > storedData.expiresAt) {
      delete otpStore[`${email}_cp`];
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsLeft: 3 - storedData.attempts,
      });
    }

    storedData.verified = true;
    storedData.verifiedAt = Date.now();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('verifyPasswordChangeOTP error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password (logged-in user, OTP verified)
// @route   POST /api/auth/change-password/confirm
exports.confirmPasswordChange = async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const { newPassword, otp } = req.body;
    const email = req.user.email;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const storedData = otpStore[`${email}_cp`];
    if (!storedData) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    if (!storedData.verified || storedData.otp !== otp) {
      return res.status(400).json({ success: false, message: 'OTP not verified. Please verify first.' });
    }

    if (Date.now() - storedData.verifiedAt > 300000) {
      delete otpStore[`${email}_cp`];
      return res.status(400).json({ success: false, message: 'OTP verification expired. Please request a new one.' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await User.updatePassword(user.serial, newPassword);
    delete otpStore[`${email}_cp`];
    delete otpStore[`${email}_cp_last`];
    delete otpStore[`${email}_cp_attempts`];

    console.log(`[${timestamp}] [AuthController] ✅ Password changed for: ${email}`);

    try {
      await emailService.sendPasswordResetConfirmation(user);
      console.log('✅ Password change confirmation sent');
    } catch (emailError) {
      console.error('❌ Confirmation email failed:', emailError.message);
    }

    try {
      const notification = await Notification.create({
        m_bondhu_id: user.m_bondhu_id,
        notification_type: 'success',
        title: '🔐 Password Changed',
        message: 'Your account password was changed successfully. If this wasn\'t you, please contact support immediately.',
        data: {
          action: 'password_changed',
          changed_at: new Date().toISOString(),
        },
      });
      if (notification) {
        await Notification.markAsSent(notification.notification_id);
      }
    } catch (notifError) {
      console.error('⚠️ Notification error:', notifError.message);
    }

    try {
      await telegramService.sendMessage(`
🔐 <b>Password Changed</b>

👤 <b>Name:</b> ${user.full_name}
📧 <b>Email:</b> ${user.email}
📱 <b>Mobile:</b> ${user.mobile}
🆔 <b>ID:</b> ${user.m_bondhu_id}

📅 <b>Time:</b> ${new Date().toLocaleString()}
      `);
    } catch (tgError) {
      console.error('⚠️ Telegram error:', tgError.message);
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('confirmPasswordChange error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── ADD EMAIL VERIFICATION FLOW (Tenant only, OTP-verified) ───────────────
// ═══════════════════════════════════════════════════════════════════════════

// @desc    Send OTP to verify a new alert email before adding
// @route   POST /api/auth/other-emails/send-otp
exports.sendAddEmailOTP = async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const { email } = req.body;
    const user = await User.findById(req.user.serial);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ Owner accounts can now add alert emails (restriction removed)

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email' });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── GLOBAL UNIQUENESS CHECKS ─────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // Check 1: Already this user's primary email?
    if (cleanEmail === user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'This is already your primary email.',
      });
    }

    // Check 2: Is it used as SOMEONE ELSE'S primary email?
    const otherUserPrimary = await pool.query(
      `SELECT m_bondhu_id, email FROM user_info 
       WHERE LOWER(email) = $1 AND is_deleted = false 
       LIMIT 1`,
      [cleanEmail]
    );
    if (otherUserPrimary.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered as another user\'s primary email.',
      });
    }

    // Check 3: Is it already in user_other_emails (for ANY user)?
    const otherUserAlert = await pool.query(
      `SELECT serial, m_bondhu_id, email FROM user_other_emails 
       WHERE LOWER(email) = $1 
       LIMIT 1`,
      [cleanEmail]
    );
    if (otherUserAlert.rows.length > 0) {
      if (otherUserAlert.rows[0].m_bondhu_id === user.m_bondhu_id) {
        return res.status(400).json({
          success: false,
          message: 'This email is already added to your alert list.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This email is already in use as an alert email by another account.',
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── Rate limit ───────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    const now = Date.now();
    const rateKey = `${cleanEmail}_ae_last`;
    const attemptKey = `${cleanEmail}_ae_attempts`;
    const lastAttempt = otpStore[rateKey] || 0;
    const attempts = otpStore[attemptKey] || 0;

    if (attempts >= 3 && (now - lastAttempt) < 60000) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please wait 1 minute.',
        locked: true,
        waitTime: Math.ceil((60000 - (now - lastAttempt)) / 1000),
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000;

    otpStore[`${cleanEmail}_ae`] = {
      otp,
      expiresAt,
      attempts: 0,
      verified: false,
      verifiedAt: null,
      purpose: 'add_email',
      requestedBy: user.m_bondhu_id,
    };
    otpStore[rateKey] = now;
    otpStore[attemptKey] = (attempts || 0) + 1;

    console.log(`[${timestamp}] 📧 Add-email OTP for ${cleanEmail}: ${otp}`);

    try {
      await emailService.sendAddEmailOTPEmail(user, cleanEmail, otp);
      console.log(`✅ Add-email OTP sent to: ${cleanEmail}`);
    } catch (emailError) {
      console.error('❌ Add-email OTP failed:', emailError.message);
      return res.json({
        success: true,
        message: 'OTP sent to your email',
        debug: otp,
      });
    }

    const masked = cleanEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    res.json({
      success: true,
      message: `Verification code sent to ${masked}`,
      email: masked,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('sendAddEmailOTP error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP for a new alert email
// @route   POST /api/auth/other-emails/verify-otp
exports.verifyAddEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findById(req.user.serial);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ Owner accounts can now add alert emails (restriction removed)

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const storedData = otpStore[`${cleanEmail}_ae`];

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.',
      });
    }

    if (storedData.requestedBy !== user.m_bondhu_id) {
      return res.status(403).json({
        success: false,
        message: 'This OTP does not belong to your account.',
      });
    }

    if (storedData.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many wrong attempts. Please request a new OTP.',
      });
    }

    if (Date.now() > storedData.expiresAt) {
      delete otpStore[`${cleanEmail}_ae`];
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsLeft: 3 - storedData.attempts,
      });
    }

    storedData.verified = true;
    storedData.verifiedAt = Date.now();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('verifyAddEmailOTP error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm & save the verified alert email
// @route   POST /api/auth/other-emails/confirm
exports.confirmAddEmail = async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const { email, otp } = req.body;
    const user = await User.findById(req.user.serial);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ Owner accounts can now add alert emails (restriction removed)

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const storedData = otpStore[`${cleanEmail}_ae`];

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.',
      });
    }

    if (storedData.requestedBy !== user.m_bondhu_id) {
      return res.status(403).json({
        success: false,
        message: 'This OTP does not belong to your account.',
      });
    }

    if (!storedData.verified || storedData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP not verified. Please verify first.',
      });
    }

    if (Date.now() - storedData.verifiedAt > 300000) {
      delete otpStore[`${cleanEmail}_ae`];
      return res.status(400).json({
        success: false,
        message: 'OTP verification expired. Please request a new one.',
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── RE-CHECKS (Race condition protection) ────────────────────────
    // ═══════════════════════════════════════════════════════════════════

    // Check 1: Max 10 other emails
const countRes = await pool.query(
  `SELECT COUNT(*)::int AS count FROM user_other_emails 
   WHERE m_bondhu_id = $1`,
  [user.m_bondhu_id]
);
if (countRes.rows[0].count >= 10) {
  return res.status(400).json({
    success: false,
    message: 'You can add a maximum of 10 alert emails.',
  });
}

    // Check 2: Not own primary
    if (cleanEmail === user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'This is already your primary email.',
      });
    }

    // Check 3: Not another user's primary email
    const otherUserPrimary = await pool.query(
      `SELECT m_bondhu_id FROM user_info 
       WHERE LOWER(email) = $1 AND is_deleted = false 
       LIMIT 1`,
      [cleanEmail]
    );
    if (otherUserPrimary.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered as another user\'s primary email.',
      });
    }

    // Check 4: Already in user_other_emails (any user)
    const otherUserAlert = await pool.query(
      `SELECT serial, m_bondhu_id FROM user_other_emails 
       WHERE LOWER(email) = $1 
       LIMIT 1`,
      [cleanEmail]
    );
    if (otherUserAlert.rows.length > 0) {
      if (otherUserAlert.rows[0].m_bondhu_id === user.m_bondhu_id) {
        return res.status(400).json({
          success: false,
          message: 'This email is already added to your alert list.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This email is already in use as an alert email by another account.',
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── INSERT (no is_active — hard delete schema) ───────────────────
    // ═══════════════════════════════════════════════════════════════════
    const insertRes = await pool.query(
      `INSERT INTO user_other_emails 
         (email, is_verified, added_by, m_bondhu_id)
       VALUES ($1, true, $2, $2)
       RETURNING *`,
      [cleanEmail, user.m_bondhu_id]
    );

    const newEmail = insertRes.rows[0];

    delete otpStore[`${cleanEmail}_ae`];
    delete otpStore[`${cleanEmail}_ae_last`];
    delete otpStore[`${cleanEmail}_ae_attempts`];

    console.log(`[${timestamp}] ✅ Alert email added: ${cleanEmail} for ${user.m_bondhu_id}`);

    try {
      const notification = await Notification.create({
        m_bondhu_id: user.m_bondhu_id,
        notification_type: 'success',
        title: '📧 Alert Email Added',
        message: `${cleanEmail} will now receive all your low-balance and recharge alerts.`,
        data: {
          action: 'other_email_added',
          email: cleanEmail,
          added_at: new Date().toISOString(),
        },
      });
      if (notification) {
        await Notification.markAsSent(notification.notification_id);
      }
    } catch (notifError) {
      console.error('⚠️ Notification error:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Email added successfully',
      otherEmail: newEmail,
    });
  } catch (error) {
    console.error('confirmAddEmail error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ─── UPDATE SINGLE SETTING (with Notification) ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// @desc    Update single setting + create notification
// @route   PUT /api/auth/settings/update
exports.updateSingleSetting = async (req, res) => {
  const timestamp = new Date().toISOString();
  const { setting_key, setting_value } = req.body;
  const mBondhuId = req.user.m_bondhu_id;

  console.log(`[${timestamp}] [AuthController] 🔄 Update single setting: ${setting_key} = ${setting_value} for ${mBondhuId}`);

  try {
    const ALLOWED_KEYS = [
      'email_notification_enabled',
      'push_notification_enabled',
      'daily_report_enabled',
      'monthly_report_enabled',
      'low_balance_alert_threshold',
    ];

    if (!setting_key || !ALLOWED_KEYS.includes(setting_key)) {
      return res.status(400).json({
        success: false,
        message: `Invalid setting key: ${setting_key}`,
      });
    }

    const query = `
      UPDATE user_info 
      SET ${setting_key} = $1, updated_at = CURRENT_TIMESTAMP
      WHERE m_bondhu_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [setting_value, mBondhuId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];
    delete user.password_hash;

    console.log(`[${timestamp}] [AuthController] ✅ DB updated`);

    const NOTIFICATION_CONFIG = {
      email_notification_enabled: {
        title: setting_value 
          ? '📧 Email Notifications Enabled' 
          : '📧 Email Notifications Disabled',
        message: setting_value
          ? 'You will now receive email alerts for low balance and recharge events.'
          : 'Email notifications have been turned off. You will not receive email alerts.',
        type: setting_value ? 'success' : 'info',
      },
      push_notification_enabled: {
        title: setting_value 
          ? '🔔 Push Notifications Enabled' 
          : '🔔 Push Notifications Disabled',
        message: setting_value
          ? 'You will now receive push notifications on your device.'
          : 'Push notifications have been turned off.',
        type: setting_value ? 'success' : 'info',
      },
      daily_report_enabled: {
        title: setting_value 
          ? '📊 Daily Report Enabled' 
          : '📊 Daily Report Disabled',
        message: setting_value
          ? 'You will receive a daily report of your DESCO meter usage.'
          : 'Daily report has been turned off.',
        type: setting_value ? 'success' : 'info',
      },
      monthly_report_enabled: {
        title: setting_value 
          ? '📈 Monthly Report Enabled' 
          : '📈 Monthly Report Disabled',
        message: setting_value
          ? 'You will receive a monthly summary report of your usage.'
          : 'Monthly report has been turned off.',
        type: setting_value ? 'success' : 'info',
      },
      low_balance_alert_threshold: {
        title: '⚡ Low Balance Threshold Updated',
        message: `Your low balance alert threshold has been updated to ৳${Number(setting_value).toFixed(2)}. You will receive alerts when your balance falls below this amount.`,
        type: 'warning',
      },
    };

    const config = NOTIFICATION_CONFIG[setting_key];
    if (config) {
      try {
        const notification = await Notification.create({
          m_bondhu_id: mBondhuId,
          notification_type: setting_key === 'low_balance_alert_threshold' ? 'warning' : 'info',
          title: config.title,
          message: config.message,
          data: {
            setting_key: setting_key,
            setting_value: setting_value,
            action: 'settings_changed',
            changed_at: new Date().toISOString(),
          },
        });

        if (notification) {
          await Notification.markAsSent(notification.notification_id);
          console.log(`[${timestamp}] [AuthController] ✅ Notification created: ${config.title}`);
        }
      } catch (notifError) {
        console.error(`[${timestamp}] [AuthController] ⚠️ Notification error:`, notifError.message);
      }
    }

    console.log(`[${timestamp}] [AuthController] ✅ Updated ${setting_key} = ${setting_value}`);

    res.json({
  success: true,
  message: `${setting_key} updated successfully`,
  user: user,                              // ✅ existing
  settings: {                              // ✅ ADD — frontend এর জন্য convenient
    email_notification_enabled: user.email_notification_enabled,
    push_notification_enabled: user.push_notification_enabled,
    daily_report_enabled: user.daily_report_enabled,
    monthly_report_enabled: user.monthly_report_enabled,
    low_balance_alert_threshold: user.low_balance_alert_threshold,
  },
});
  } catch (error) {
    console.error(`[${timestamp}] [AuthController] ❌ Error:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update User Profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { full_name, email, mobile, user_type, account_no, meter_no } = req.body;

    const updatedUser = await User.updateProfile(req.user.serial, {
      full_name, email, mobile, user_type, account_no, meter_no
    });

    delete updatedUser.password_hash;

    res.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ─── Password Reset Routes ──────────────────────────────────────────────
exports.findByMobile = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || mobile.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 11-digit mobile number'
      });
    }

    const user = await User.findByMobile(mobile);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this mobile number'
      });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        full_name: user.full_name,
        mobile: user.mobile,
        account_no: user.account_no
      }
    });
  } catch (error) {
    console.error('FindByMobile error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all user settings
// @route   GET /api/auth/settings
// @access  Private
exports.getSettings = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [AuthController] 📥 GET /settings for ${req.user.m_bondhu_id}`);

  try {
    const user = await User.findById(req.user.serial);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      settings: {
        email_notification_enabled: user.email_notification_enabled,
        push_notification_enabled: user.push_notification_enabled,
        daily_report_enabled: user.daily_report_enabled,
        monthly_report_enabled: user.monthly_report_enabled,
        telegram_notification_enabled: user.telegram_notification_enabled,
        low_balance_alert_threshold: user.low_balance_alert_threshold,
        high_consumption_threshold: user.high_consumption_threshold,
      },
    });
  } catch (error) {
    console.error(`[${timestamp}] [AuthController] ❌ getSettings error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    const now = Date.now();
    const lastAttempt = otpStore[`${email}_last`] || 0;
    const attempts = otpStore[`${email}_attempts`] || 0;
    
    if (attempts >= 3 && (now - lastAttempt) < 60000) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please wait 1 minute.',
        locked: true,
        waitTime: Math.ceil((60000 - (now - lastAttempt)) / 1000)
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000;

    otpStore[email] = {
      otp,
      expiresAt,
      attempts: 0,
      verified: false,
      verifiedAt: null
    };
    otpStore[`${email}_last`] = now;
    otpStore[`${email}_attempts`] = (attempts || 0) + 1;

    console.log(`📧 OTP for ${email}: ${otp}`);

    try {
      await emailService.sendOTPEmail(user, otp);
      console.log('✅ OTP email sent to:', email);
    } catch (emailError) {
      console.error('❌ OTP email failed:', emailError.message);
      return res.json({
        success: true,
        message: 'OTP sent to your email',
        debug: otp
      });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 300
    });
  } catch (error) {
    console.error('SendOTP error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const storedData = otpStore[email];
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.'
      });
    }

    if (storedData.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many wrong attempts. Please request a new OTP.'
      });
    }

    if (Date.now() > storedData.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attemptsLeft: 3 - storedData.attempts
      });
    }

    otpStore[email].verified = true;
    otpStore[email].verifiedAt = Date.now();

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('VerifyOTP error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, otp } = req.body;

    if (!email || !newPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email, new password and OTP are required'
      });
    }

    const storedData = otpStore[email];
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.'
      });
    }

    if (!storedData.verified) {
      return res.status(400).json({
        success: false,
        message: 'OTP not verified. Please verify first.'
      });
    }

    if (Date.now() - storedData.verifiedAt > 300000) {
      delete otpStore[email];
      return res.status(400).json({
        success: false,
        message: 'OTP verification expired. Please request a new one.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.updatePassword(user.serial, newPassword);
    delete otpStore[email];

    try {
      await emailService.sendPasswordResetConfirmation(user);
      console.log('✅ Password reset confirmation email sent to:', email);
    } catch (emailError) {
      console.error('❌ Confirmation email failed:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('ResetPassword error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};