// src/controllers/profileController.js
const profileService = require('../services/profileService');

// ─── Get Profile ───────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ProfileController] 📋 GET /profile`);

  try {
    const result = await profileService.getProfile(req.user.m_bondhu_id);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [ProfileController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Update Profile ────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ProfileController] 💾 PUT /profile`);

  try {
    const result = await profileService.updateProfile(req.user.m_bondhu_id, req.body);
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [ProfileController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Change Password ───────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ProfileController] 🔐 PUT /change-password`);

  try {
    const { currentPassword, newPassword } = req.body;
    const result = await profileService.changePassword(
      req.user.m_bondhu_id,
      currentPassword,
      newPassword
    );
    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [ProfileController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Add Other Email (Tenant only) ────────────────────────────────────
exports.addOtherEmail = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ProfileController] ➕ POST /other-emails`);

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const result = await profileService.addOtherEmail(req.user.m_bondhu_id, email);
    
    // ✅ Owner restriction → 403
    if (result.restricted) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [ProfileController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Remove Other Email (Tenant only) ─────────────────────────────────
exports.removeOtherEmail = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ProfileController] ➖ DELETE /other-emails/${req.params.serial}`);

  try {
    const { serial } = req.params;
    if (!serial) {
      return res.status(400).json({ success: false, message: 'Email serial is required' });
    }

    const result = await profileService.removeOtherEmail(req.user.m_bondhu_id, serial);

    // ✅ Owner restriction → 403
    if (result.restricted) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error(`[${timestamp}] [ProfileController] ❌ Error:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};