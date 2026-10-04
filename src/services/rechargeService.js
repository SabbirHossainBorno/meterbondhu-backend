// src/services/rechargeService.js
const { pool } = require('../config/database');
const DescoService = require('./descoService');
const emailService = require('./emailService');
const Notification = require('../models/Notification');
const Meter = require('../models/Meter');

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ Helper: Valid status check ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// DESCO has TWO different response formats:
//   system-A (unified): orderStatus = "Execution Successful"
//   system-B (tkdes):   orderStatus = "Successful"
// Both are valid — treat them as the same.
// ═══════════════════════════════════════════════════════════════════════════
const VALID_STATUSES = ['Execution Successful', 'Successful'];

function isValidRecharge(item) {
  if (!item) return false;
  const status = item.orderStatus;
  const amount = parseFloat(item.totalAmount) || 0;
  return VALID_STATUSES.includes(status) && amount > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ Helper: Build date range (fix for DESCO code 908) ───────────────
// ═══════════════════════════════════════════════════════════════════════════
// DESCO rejects ranges that exceed exactly 365 days (code 908).
// So when monthsBack = 12, we subtract 2 days from dateTo.
// ═══════════════════════════════════════════════════════════════════════════
function buildDateRange({ monthsBack = 11, bufferDays = 0 } = {}) {
  const now = new Date();
  const dateTo = new Date(now);        // ✅ আজকের তারিখ (today)
  const dateFrom = new Date(now);
  dateFrom.setMonth(dateFrom.getMonth() - monthsBack);

  // ✅ DESCO rejects ranges > 365 days (code 908).
  // We now keep dateTo = today, and shrink dateFrom by 2 days instead.
  // This way today's recharges are ALWAYS included.
  if (monthsBack === 12) {
    dateFrom.setDate(dateFrom.getDate() + 2);
  }
  dateFrom.setDate(dateFrom.getDate() - bufferDays);

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    dateFrom: fmt(dateFrom),
    dateTo: fmt(dateTo),               // ✅ today
    label: `${monthsBack}m${bufferDays ? `-${bufferDays}d` : ''}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ✅ NEW: Retry wrapper for network/timeout errors ───────────────────
// ═══════════════════════════════════════════════════════════════════════════
// DESCO's system-B (tkdes) sometimes times out for specific accounts.
// This wrapper retries up to 2 times with exponential backoff (2s → 4s).
// ═══════════════════════════════════════════════════════════════════════════
async function fetchWithRetry(fn, { retries = 2, delayMs = 2000, label = '' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      const isTimeout = msg.includes('timeout') || msg.includes('ECONNABORTED');
      const isNetwork = msg.includes('Network') || msg.includes('ECONNREFUSED');
      const isRateLimit = msg.includes('RateLimiter') || msg.includes('rate limit') || msg.includes('does not permit further calls');

      if (isRateLimit && attempt <= retries) {
        // ✅ Rate limit — wait 30s before retry
        const waitTime = 30000;
        console.log(`🛑 [getRechargeHistory] ${label} RATE LIMIT hit, waiting ${waitTime / 1000}s before retry...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      if ((isTimeout || isNetwork) && attempt <= retries) {
        console.log(`🔄 [getRechargeHistory] ${label} attempt ${attempt} failed (${msg.substring(0, 60)}...), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Fetch recharge history with fallback ranges ────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
async function fetchRechargeHistoryWithFallback(accountNo, meterNo) {
  const timestamp = new Date().toISOString();

  // Best-first: safe range age try kore, then chhoto
  const ranges = [
    { monthsBack: 12, bufferDays: 0, label: '12 months (safe)' },
    { monthsBack: 11, bufferDays: 29, label: '~11.9 months' },
    { monthsBack: 6, bufferDays: 0, label: '6 months' },
  ];

  let lastError = null;

  for (const range of ranges) {
    const { dateFrom, dateTo } = buildDateRange(range);

    console.log(`\n🌐 [getRechargeHistory] ${accountNo}, ${meterNo}, ${dateFrom} → ${dateTo} (${range.label})`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    try {
      // ✅ Retry wrapper — 2 retries with exponential backoff
      const response = await fetchWithRetry(
        () => DescoService.getRechargeHistory(accountNo, meterNo, dateFrom, dateTo),
        { retries: 2, delayMs: 2000, label: range.label }
      );

      let recharges = [];
      if (Array.isArray(response)) recharges = response;
      else if (response?.code === 200 && Array.isArray(response.data)) recharges = response.data;
      else if (response?.success && Array.isArray(response.data)) recharges = response.data;
      else if (response?.data && Array.isArray(response.data)) recharges = response.data;

      if (recharges.length > 0) {
        console.log(`✅ [getRechargeHistory] Got ${recharges.length} records with ${range.label}`);
        return recharges;
      }

      console.log(`⚠️ [getRechargeHistory] Empty data with ${range.label}, trying smaller...`);
      lastError = new Error(`Empty with ${range.label}`);

    } catch (err) {
      const msg = err?.message || '';
      const is908 = msg.includes('908') || msg.includes("can't exceed 12 months");
      const isTimeout = msg.includes('timeout') || msg.includes('ECONNABORTED');

      if (is908) {
        console.log(`⚠️ [getRechargeHistory] Range too long (${range.label}), trying smaller...`);
      } else if (isTimeout) {
        console.log(`⚠️ [getRechargeHistory] Timeout with ${range.label} after retries, trying smaller...`);
      } else {
        console.log(`⚠️ [getRechargeHistory] Failed with ${range.label}: ${msg}`);
      }
      lastError = err;
    }
  }

  console.log(`❌ [getRechargeHistory] ALL ranges failed. Last error: ${lastError?.message}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── RechargeService Class ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

class RechargeService {
  // ─── Sync All Recharge History (First Time Load) ────────────────────────
  async syncAllRecharges(userSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔄 Syncing all recharges for user ${userSerial}...`);

    try {
      const user = await this.getUser(userSerial);
      if (!user) {
        console.log(`[${timestamp}] [RechargeService] ❌ User not found: ${userSerial}`);
        return { success: false, message: 'User not found' };
      }

      console.log(`[${timestamp}] [RechargeService] 👤 User: ${user.full_name}, Account: ${user.account_no}, Meter: ${user.meter_no}`);

      const allRecharges = await fetchRechargeHistoryWithFallback(
        user.account_no,
        user.meter_no
      );

      console.log(`[${timestamp}] [RechargeService] 📊 Found ${allRecharges.length} total recharges`);

      // ✅ Use isValidRecharge helper (accepts both status formats)
      const validRecharges = allRecharges.filter(isValidRecharge);

      console.log(`[${timestamp}] [RechargeService] 📊 Found ${validRecharges.length} valid recharges to sync`);

      if (validRecharges.length === 0) {
        console.log(`[${timestamp}] [RechargeService] ⚠️ No valid recharge data found`);
        return { success: false, message: 'No valid recharge data found' };
      }

      let savedCount = 0;
      let skippedCount = 0;

      for (const recharge of validRecharges) {
        try {
          console.log(`[${timestamp}] [RechargeService] 📝 Processing: Seq=${recharge.seqNo}, Amount=৳${recharge.totalAmount}`);

          const exists = await this.isRechargeProcessed(user.account_no, user.meter_no, recharge);

          if (exists) {
            skippedCount++;
            console.log(`[${timestamp}] [RechargeService] ⏳ Skipping: ${recharge.seqNo}`);
            continue;
          }

          const saved = await this.saveRechargeHistory(user, recharge, true);
          if (saved) {
            savedCount++;
            console.log(`[${timestamp}] [RechargeService] ✅ Saved: ${recharge.seqNo} (inserted_by: ${user.m_bondhu_id})`);
          }
        } catch (error) {
          console.error(`[${timestamp}] [RechargeService] ❌ Error saving ${recharge.seqNo}:`, error.message);
        }
      }

      console.log(`[${timestamp}] [RechargeService] ✅ Sync complete: ${savedCount} saved, ${skippedCount} skipped`);
      return {
        success: true,
        message: `Synced ${savedCount} recharges`,
        savedCount,
        skippedCount,
        total: validRecharges.length
      };
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Sync error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ─── Check for New Recharges ────────────────────────────────────────────
  async checkForNewRecharges(userSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔍 Checking for new recharges...`);

    try {
      const user = await this.getUser(userSerial);
      if (!user) {
        console.log(`[${timestamp}] [RechargeService] ❌ User not found: ${userSerial}`);
        return { success: false, message: 'User not found' };
      }

      const latestRecharge = await this.getLatestRechargeFromDESCO(user);

      if (!latestRecharge) {
        console.log(`[${timestamp}] [RechargeService] ⚠️ No recharge found`);
        return { success: false, message: 'No recharge found' };
      }

      const isProcessed = await this.isRechargeProcessed(user.account_no, user.meter_no, latestRecharge);
      if (isProcessed) {
        console.log(`[${timestamp}] [RechargeService] ⏳ Recharge already processed`);
        return { success: false, message: 'Already processed' };
      }

      const savedRecharge = await this.saveRechargeHistory(user, latestRecharge, false);

      if (!savedRecharge) {
        console.log(`[${timestamp}] [RechargeService] ❌ Failed to save recharge`);
        return { success: false, message: 'Failed to save recharge' };
      }

      await this.sendRechargeNotification(user, latestRecharge);
      await this.markMailSent(savedRecharge.recharge_id);

      console.log(`[${timestamp}] [RechargeService] ✅ New recharge processed: ৳${latestRecharge.totalAmount}`);
      return {
        success: true,
        message: 'Recharge processed successfully',
        data: latestRecharge
      };
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── ✅ NEW: Check by account+meter (works for tenant meters too) ─────
  // ═══════════════════════════════════════════════════════════════════════
  async checkForNewRechargesByAccountMeter(accountNo, meterNo, userOverride = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔍 Checking by account+meter: ${accountNo}/${meterNo}`);

    try {
      // Build user object — either fetch or use passed override
      let user = userOverride;
      if (!user) {
        user = await this.getUserByAccountAndMeter(accountNo, meterNo);
      }
      if (!user) {
        console.log(`[${timestamp}] [RechargeService] ❌ No user for ${accountNo}/${meterNo}`);
        return { success: false, message: 'User not found' };
      }

      // Ensure user has account_no / meter_no for downstream calls
      user = {
        ...user,
        account_no: accountNo,
        meter_no: meterNo,
      };

      const latestRecharge = await this.getLatestRechargeFromDESCO(user);

      if (!latestRecharge) {
        console.log(`[${timestamp}] [RechargeService] ⚠️ No recharge found`);
        return { success: false, message: 'No recharge found' };
      }

      const isProcessed = await this.isRechargeProcessed(accountNo, meterNo, latestRecharge);
      if (isProcessed) {
        console.log(`[${timestamp}] [RechargeService] ⏳ Recharge already processed`);
        return { success: false, message: 'Already processed' };
      }

      const savedRecharge = await this.saveRechargeHistory(user, latestRecharge, false);

      if (!savedRecharge) {
        console.log(`[${timestamp}] [RechargeService] ❌ Failed to save recharge`);
        return { success: false, message: 'Failed to save recharge' };
      }

      // ✅ Only send notification if NOT a tenant meter
      const isTenantMeter = userOverride?.is_tenant_meter === true;

      if (!isTenantMeter) {
        await this.sendRechargeNotification(user, latestRecharge);
      } else {
        console.log(`[${timestamp}] [RechargeService] ⏭️ Skipping notification for tenant meter ${meterNo}`);
      }

      await this.markMailSent(savedRecharge.recharge_id);

      console.log(`[${timestamp}] [RechargeService] ✅ New recharge processed: ৳${latestRecharge.totalAmount}`);
      return {
        success: true,
        message: 'Recharge processed successfully',
        data: latestRecharge
      };
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ─── Check All Users for New Recharges (Scheduler) ──────────────────────
  async checkAllUsersForNewRecharges() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔍 Checking all users for new recharges...`);

    try {
      // ✅ UNION: normal users + tenant meters (with flag)
      const query = `
      SELECT 
        u.serial, 
        u.m_bondhu_id, 
        u.account_no, 
        u.meter_no, 
        u.email,
        u.full_name, 
        u.email_notification_enabled,
        false AS is_tenant_meter
      FROM user_info u
      WHERE u.is_active = true AND u.is_deleted = false

      UNION

      SELECT 
        o.serial,
        o.m_bondhu_id,
        t.account_no,
        t.meter_no,
        o.email,
        t.tenant_name AS full_name,
        o.email_notification_enabled,
        true AS is_tenant_meter
      FROM tenant_info t
      INNER JOIN user_info o ON o.serial = t.owner_serial
      WHERE o.is_active = true AND o.is_deleted = false
    `;
      const result = await pool.query(query);
      const users = result.rows;

      console.log(`[${timestamp}] [RechargeService] 👥 Found ${users.length} active users (incl. tenants)`);

      let totalRecharges = 0;
      let totalEmailsSent = 0;
      let errors = 0;

      for (const user of users) {
        try {
          // ✅ TENANT METERS: full sync (all history, no notification)
          if (user.is_tenant_meter) {
            const fullSyncResult = await this.syncAllRechargesByAccountMeter(
              user.account_no,
              user.meter_no,
              user
            );
            if (fullSyncResult.success && fullSyncResult.savedCount > 0) {
              totalRecharges += fullSyncResult.savedCount;
              console.log(`[${timestamp}] [RechargeService] ✅ Tenant full sync: ${fullSyncResult.savedCount} new records for ${user.meter_no}`);
            }
          } else {
            // ✅ NORMAL USERS: incremental check (latest only)
            const checkResult = await this.checkForNewRechargesByAccountMeter(
              user.account_no,
              user.meter_no,
              user
            );
            if (checkResult.success) {
              totalRecharges++;
              if (checkResult.data) {
                totalEmailsSent++;
              }
            }
          }
        } catch (error) {
          errors++;
          console.error(`[${timestamp}] [RechargeService] ❌ Error for user ${user.m_bondhu_id}:`, error.message);
        }

        if (users.indexOf(user) < users.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      console.log(`[${timestamp}] [RechargeService] ✅ Check complete: ${totalRecharges} new recharges, ${totalEmailsSent} emails sent, ${errors} errors`);
      return { success: true, totalRecharges, totalEmailsSent, errors };
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Check all users error:`, error.message);
      return { success: false, message: error.message };
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // ─── ✅ NEW: Full sync for tenant meters (all history, no login) ───────
  // ═══════════════════════════════════════════════════════════════════════
  // Normal users sync on login via syncAllRecharges(userSerial).
  // Tenant meters have no login — so scheduler does full sync for them.
  // 
  // Fetches 12-month history (like syncAllRecharges does for normal users)
  // and saves ALL recharges, skipping duplicates.
  // ═══════════════════════════════════════════════════════════════════════
  async syncAllRechargesByAccountMeter(accountNo, meterNo, userOverride = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔄 Full sync for ${accountNo}/${meterNo}`);

    try {
      // Build user object
      let user = userOverride;
      if (!user) {
        user = await this.getUserByAccountAndMeter(accountNo, meterNo);
      }
      if (!user) {
        console.log(`[${timestamp}] [RechargeService] ❌ No user for ${accountNo}/${meterNo}`);
        return { success: false, message: 'User not found' };
      }

      user = { ...user, account_no: accountNo, meter_no: meterNo };

      // Fetch 12-month history
      const allRecharges = await fetchRechargeHistoryWithFallback(accountNo, meterNo);

      console.log(`[${timestamp}] [RechargeService] 📊 Found ${allRecharges.length} total recharges`);

      const validRecharges = allRecharges.filter(isValidRecharge);
      console.log(`[${timestamp}] [RechargeService] 📊 ${validRecharges.length} valid recharges`);

      if (validRecharges.length === 0) {
        return { success: true, savedCount: 0, skippedCount: 0, total: 0 };
      }

      let savedCount = 0;
      let skippedCount = 0;

      for (const recharge of validRecharges) {
        try {
          const exists = await this.isRechargeProcessed(accountNo, meterNo, recharge);

          if (exists) {
            skippedCount++;
            continue;
          }

          const saved = await this.saveRechargeHistory(user, recharge, true); // isMailSent = true (skip email/notification)
          if (saved) {
            savedCount++;
            console.log(`[${timestamp}] [RechargeService] ✅ Saved: Seq=${recharge.seqNo}, ৳${recharge.totalAmount}`);
          }
        } catch (error) {
          console.error(`[${timestamp}] [RechargeService] ❌ Save error:`, error.message);
        }
      }

      console.log(`[${timestamp}] [RechargeService] ✅ Full sync complete: ${savedCount} saved, ${skippedCount} skipped`);
      return {
        success: true,
        savedCount,
        skippedCount,
        total: validRecharges.length,
      };
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Full sync error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ─── Get User ─────────────────────────────────────────────────────────────
  async getUser(userSerial) {
    const query = 'SELECT * FROM user_info WHERE serial = $1';
    const result = await pool.query(query, [userSerial]);
    return result.rows[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Get Today's Total Recharge ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  async getTodayRecharge(user) {
    const timestamp = new Date().toISOString();
    try {
      const query = `
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(*) as recharge_count,
          MAX(recharge_date) as last_recharge_time,
          COALESCE(SUM(energy_amount), 0) as total_energy
        FROM recharge_history 
        WHERE account_no = $1 
        AND meter_no = $2
        AND order_status IN ('Execution Successful', 'Successful')
        AND total_amount > 0
        AND recharge_date::date = CURRENT_DATE
      `;
      const result = await pool.query(query, [user.account_no, user.meter_no]);

      const totalAmount = parseFloat(result.rows[0]?.total_amount) || 0;
      const count = parseInt(result.rows[0]?.recharge_count) || 0;
      const lastTime = result.rows[0]?.last_recharge_time;
      const totalEnergy = parseFloat(result.rows[0]?.total_energy) || 0;

      console.log(`[${timestamp}] [RechargeService] 💰 Today's recharge: ৳${totalAmount.toFixed(2)} (${count} transactions)`);

      if (count > 0) {
        return {
          totalAmount,
          count,
          lastRechargeTime: lastTime,
          totalEnergy,
          hasRecharged: true
        };
      }

      return null;
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Error:`, error.message);
      return null;
    }
  }

  // ─── Get Latest Recharge from DESCO ────────────────────────────────────
  async getLatestRechargeFromDESCO(user) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🌐 Fetching latest recharge from DESCO...`);

    try {
      const recharges = await fetchRechargeHistoryWithFallback(user.account_no, user.meter_no);
      console.log(`[${timestamp}] [RechargeService] 📊 Found ${recharges.length} recharges`);

      // ✅ DESCO fail korle DB theke try korun
      if (recharges.length === 0) {
        console.log(`[${timestamp}] [RechargeService] ⚠️ DESCO returned empty, checking DB fallback...`);

        const dbQuery = `
          SELECT * FROM recharge_history 
          WHERE account_no = $1 AND meter_no = $2
          AND order_status IN ('Execution Successful', 'Successful')
          AND total_amount > 0
          ORDER BY recharge_date DESC 
          LIMIT 1
        `;
        const dbResult = await pool.query(dbQuery, [user.account_no, user.meter_no]);

        if (dbResult.rows.length > 0) {
          const dbLatest = dbResult.rows[0];
          console.log(`[${timestamp}] [RechargeService] ✅ DB fallback: ৳${dbLatest.total_amount}, Seq: ${dbLatest.sequence}`);
          return {
            totalAmount: parseFloat(dbLatest.total_amount),
            energyAmount: parseFloat(dbLatest.energy_amount),
            chargeAmount: parseFloat(dbLatest.charge_amount),
            rechargeDate: dbLatest.recharge_date,
            rechargeOperator: dbLatest.recharge_operator,
            orderStatus: dbLatest.order_status,
            seqNo: dbLatest.sequence,
            orderID: dbLatest.order_id,
            tokenNo: dbLatest.token,
            VAT: parseFloat(dbLatest.vat),
            rebate: parseFloat(dbLatest.rebate),
            chargeItems: [],
          };
        }

        console.log(`[${timestamp}] [RechargeService] ⚠️ No recharge in DB either`);
        return null;
      }

      // DESCO success — age er moto
      const validRecharges = recharges.filter(isValidRecharge);
      console.log(`[${timestamp}] [RechargeService] 📊 Found ${validRecharges.length} valid recharges`);

      if (validRecharges.length === 0) {
        console.log(`[${timestamp}] [RechargeService] ⚠️ No valid recharge found`);
        return null;
      }

      // ✅ FIX: Sort by rechargeDate DESC (seqNo wraps and is unreliable)
      const sorted = [...validRecharges].sort((a, b) => {
        const dateA = new Date(a.rechargeDate || 0).getTime();
        const dateB = new Date(b.rechargeDate || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;

        // Tie-break by seqNo desc (same-date recharges)
        const seqA = parseInt(a.seqNo) || 0;
        const seqB = parseInt(b.seqNo) || 0;
        return seqB - seqA;
      });

      const latest = sorted[0];
      console.log(
        `[${timestamp}] [RechargeService] ✅ Latest recharge: ৳${latest.totalAmount}, Seq: ${latest.seqNo}, Date: ${latest.rechargeDate}`
      );
      return latest;
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ DESCO error:`, error.message);
      return null;
    }
  }

  // ─── Check if Recharge is Already Processed ─────────────────────────────
  async isRechargeProcessed(accountNo, meterNo, recharge) {
    const seqNo = recharge.seqNo || 'N/A';
    const orderId = recharge.orderID || 'N/A';

    console.log(`[RechargeService] 🔍 Checking: account=${accountNo}, meter=${meterNo}, seqNo=${seqNo}`);

    const query = `
  SELECT COUNT(*) as count FROM recharge_history 
  WHERE account_no = $1 
  AND meter_no = $2
  AND (
    order_id = $4
    OR (order_id = 'N/A' AND sequence = $3)
  )
`;
    const result = await pool.query(query, [accountNo, meterNo, seqNo, orderId]);
    const count = parseInt(result.rows[0].count);
    console.log(`[RechargeService] 📊 Found ${count} existing records`);
    return count > 0;
  }

  // ─── Save Recharge to Database ──────────────────────────────────────────
  async saveRechargeHistory(user, recharge, isMailSent = false) {
    const timestamp = new Date().toISOString();

    try {
      const idResult = await pool.query(
        "SELECT nextval('recharge_history_serial_seq') AS serial"
      );
      const serial = idResult.rows[0].serial;
      const rechargeId = `RCH${String(serial).padStart(8, '0')}`;

      // ✅ Match by account_no + meter_no — works for both normal + tenant meters
      const meterQuery = `
        SELECT serial FROM meter_info 
        WHERE account_no = $1 AND meter_no = $2
        LIMIT 1
      `;
      const meterResult = await pool.query(meterQuery, [user.account_no, user.meter_no]);
      const meterSerial = meterResult.rows.length > 0 ? meterResult.rows[0].serial : null;

      const insertedBy = user.m_bondhu_id;

      console.log(`[${timestamp}] [RechargeService] 💾 Saving: account=${user.account_no}, inserted_by=${insertedBy}, seq=${recharge.seqNo}`);

      const rechargeDate = recharge.rechargeDate || new Date().toISOString();

      let token = recharge.tokenNo || 'N/A';
      if (token && token.length > 500) {
        token = token.substring(0, 497) + '...';
      }

      // ✅ Normalize status to "Execution Successful" for DB storage
      const normalizedStatus = VALID_STATUSES.includes(recharge.orderStatus)
        ? 'Execution Successful'
        : recharge.orderStatus || 'Execution Successful';

      const query = `
        INSERT INTO recharge_history (
          recharge_id, account_no, meter_no, meter_serial, order_id, token,
          sequence, total_amount, energy_amount, charge_amount,
          recharge_date, recharge_operator, rebate, vat,
          order_status, is_mail_sent, inserted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

      const values = [
        rechargeId,
        user.account_no,
        user.meter_no,
        meterSerial,
        recharge.orderID || 'N/A',
        token,
        recharge.seqNo || 'N/A',
        recharge.totalAmount || 0,
        recharge.energyAmount || 0,
        recharge.chargeAmount || 0,
        rechargeDate,
        recharge.rechargeOperator || 'DESCO',
        recharge.rebate || 0,
        recharge.VAT || 0,
        normalizedStatus,
        isMailSent,
        insertedBy
      ];

      const result = await pool.query(query, values);
      console.log(`[${timestamp}] [RechargeService] ✅ Recharge saved: ${rechargeId}, inserted_by: ${insertedBy}`);
      return result.rows[0];
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Save error:`, error.message);
      console.error(`[${timestamp}] [RechargeService] ❌ Stack:`, error.stack);
      return null;
    }
  }

  // ─── Mark Mail as Sent ──────────────────────────────────────────────────
  async markMailSent(rechargeId) {
    const query = `
      UPDATE recharge_history 
      SET is_mail_sent = true 
      WHERE recharge_id = $1
    `;
    await pool.query(query, [rechargeId]);
    console.log(`[RechargeService] ✅ Mail marked as sent for ${rechargeId}`);
  }

  // ─── Get Unprocessed Recharges ──────────────────────────────────────────
  async getUnprocessedRecharges(limit = 100) {
    const query = `
      SELECT * FROM recharge_history 
      WHERE is_mail_sent = false 
      AND order_status IN ('Execution Successful', 'Successful')
      ORDER BY recharge_date DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // ─── Send Recharge Notification ──────────────────────────────────────────
  async sendRechargeNotification(user, rechargeData) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 📧 Sending recharge notification...`);

    try {
      const rechargeInfo = {
        totalAmount: rechargeData.totalAmount || 0,
        energyAmount: rechargeData.energyAmount || 0,
        chargeAmount: rechargeData.chargeAmount || 0,
        rechargeDate: rechargeData.rechargeDate || new Date().toISOString(),
        rechargeOperator: rechargeData.rechargeOperator || 'DESCO',
        orderStatus: rechargeData.orderStatus || 'Execution Successful',
        seqNo: rechargeData.seqNo || 'N/A',
        orderID: rechargeData.orderID || 'N/A',
        tokenNo: rechargeData.tokenNo || 'N/A',
        VAT: rechargeData.VAT || 0,
        rebate: rechargeData.rebate || 0,
        chargeItems: rechargeData.chargeItems || [],
      };

      let emailSent = false;
      if (user.email_notification_enabled !== false) {
        try {
          const profileService = require('./profileService');
          const allEmails = await profileService.getAllAlertEmails(user.m_bondhu_id);

          console.log(`[${timestamp}] [RechargeService] 📧 Sending recharge to ${allEmails.length} email(s): ${allEmails.join(', ')}`);

          for (const toEmail of allEmails) {
            try {
              const userForEmail = { ...user, email: toEmail };
              const sent = await emailService.sendRechargeReceiptEmail(userForEmail, rechargeInfo);

              if (sent) {
                emailSent = true;
                console.log(`[${timestamp}] [RechargeService] 📧 ✅ Recharge email sent to ${toEmail}`);
              } else {
                console.log(`[${timestamp}] [RechargeService] 📧 ❌ Failed to ${toEmail}`);
              }
            } catch (emailErr) {
              console.error(`[${timestamp}] [RechargeService] ❌ Email error for ${toEmail}:`, emailErr.message);
            }
          }

          console.log(`[${timestamp}] [RechargeService] 📧 Recharge emails complete: ${emailSent ? 'SUCCESS' : 'FAILED'}`);
        } catch (emailError) {
          console.error(`[${timestamp}] [RechargeService] ❌ Email error:`, emailError.message);
        }
      }

      try {
        const notification = await Notification.create({
          m_bondhu_id: user.m_bondhu_id,
          notification_type: 'recharge',
          title: '⚡ Recharge Successful',
          message: `৳${(rechargeData.totalAmount || 0).toFixed(2)} added to your DESCO prepaid meter.`,
          data: {
            amount: rechargeData.totalAmount,
            seqNo: rechargeData.seqNo,
            orderID: rechargeData.orderID,
            tokenNo: rechargeData.tokenNo,
            status: rechargeData.orderStatus,
            timestamp: new Date().toISOString(),
            email_sent: emailSent,
          },
        });

        if (notification) {
          await Notification.markAsSent(notification.notification_id);
          console.log(`[${timestamp}] [RechargeService] ✅ In-app notification created`);
        }
      } catch (notifError) {
        console.error(`[${timestamp}] [RechargeService] ⚠️ Notification error:`, notifError.message);
      }

      return emailSent;
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Failed to send notification:`, error.message);
      return false;
    }
  }

  // ─── Process Unprocessed Recharges ──────────────────────────────────────
  async processUnprocessedRecharges() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔄 Processing unprocessed recharges...`);

    try {
      const unprocessed = await this.getUnprocessedRecharges();
      console.log(`[${timestamp}] [RechargeService] 📊 Found ${unprocessed.length} unprocessed recharges`);

      let processed = 0;
      let errors = 0;

      for (const recharge of unprocessed) {
        try {
          const user = await this.getUserByAccountAndMeter(recharge.account_no, recharge.meter_no);
          if (user) {
            const rechargeData = {
              totalAmount: recharge.total_amount,
              energyAmount: recharge.energy_amount,
              chargeAmount: recharge.charge_amount,
              rechargeDate: recharge.recharge_date,
              rechargeOperator: recharge.recharge_operator,
              orderStatus: recharge.order_status,
              seqNo: recharge.sequence,
              orderID: recharge.order_id,
              tokenNo: recharge.token,
              VAT: recharge.vat,
              rebate: recharge.rebate,
              chargeItems: [],
            };

            await this.sendRechargeNotification(user, rechargeData);
            await this.markMailSent(recharge.recharge_id);
            processed++;
            console.log(`[${timestamp}] [RechargeService] ✅ Processed recharge ${recharge.recharge_id}`);
          } else {
            console.log(`[${timestamp}] [RechargeService] ⚠️ User not found for account: ${recharge.account_no}`);
          }
        } catch (error) {
          errors++;
          console.error(`[${timestamp}] [RechargeService] ❌ Error processing ${recharge.recharge_id}:`, error.message);
        }
      }

      console.log(`[${timestamp}] [RechargeService] ✅ Processed ${processed} recharges, ${errors} errors`);
      return { success: true, processed, errors };
    } catch (error) {
      console.error(`[${timestamp}] [RechargeService] ❌ Process unprocessed error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ─── Get User by Account and Meter ──────────────────────────────────────
  async getUserByAccountAndMeter(accountNo, meterNo) {
    const query = `
      SELECT * FROM user_info 
      WHERE account_no = $1 AND meter_no = $2 
      AND is_active = true AND is_deleted = false
      LIMIT 1
    `;
    const result = await pool.query(query, [accountNo, meterNo]);
    return result.rows[0] || null;
  }

  // ─── Get Recharge History by Account and Meter ──────────────────────────
  async getRechargeHistoryByAccountAndMeter(accountNo, meterNo, limit = 50) {
    const query = `
      SELECT * FROM recharge_history 
      WHERE account_no = $1 
      AND meter_no = $2
      AND order_status IN ('Execution Successful', 'Successful')
      AND total_amount > 0
      ORDER BY recharge_date DESC 
      LIMIT $3
    `;
    const result = await pool.query(query, [accountNo, meterNo, limit]);
    return result.rows;
  }

  // ─── Force Check for Specific User ──────────────────────────────────────
  async forceCheckForUser(userSerial) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RechargeService] 🔍 Force checking user ${userSerial}`);
    return await this.checkForNewRecharges(userSerial);
  }
}

module.exports = new RechargeService();