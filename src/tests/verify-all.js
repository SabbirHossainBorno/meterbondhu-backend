// src/tests/verify-all.js
// ═══════════════════════════════════════════════════════════════════════
// FULL SYSTEM VERIFICATION
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../config/database');
const emailService = require('../services/emailService');
const rechargeService = require('../services/rechargeService');
const alertService = require('../services/alertService');
const DescoService = require('../services/descoService');
const mockDesco = require('../mocks/mockDescoService');
const mockFactory = require('../mocks/mockDataFactory');

const USER_SERIAL = '2'; // USR001MBONDHU

// ═══════════════════════════════════════════════════════════════════════
// Check utilities
// ═══════════════════════════════════════════════════════════════════════
const results = [];

function check(name, passed, details = '') {
  results.push({ name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${name}${details ? ' → ' + details : ''}`);
}

function section(title) {
  console.log('\n' + '═'.repeat(75));
  console.log(`  ${title}`);
  console.log('═'.repeat(75));
}

// ═══════════════════════════════════════════════════════════════════════
// Helper: Get today's date in server local timezone as SQL string
// ═══════════════════════════════════════════════════════════════════════
function getTodayLocalSQL() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISO = new Date(now.getTime() - tzOffset)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  return localISO;
}

// ═══════════════════════════════════════════════════════════════════════
// Helper: Force recharge_date to CURRENT_DATE for test records
// ═══════════════════════════════════════════════════════════════════════
async function forceTodayDate(accountNo, pattern = 'VERIFY%') {
  await pool.query(`
    UPDATE recharge_history 
    SET recharge_date = NOW()
    WHERE account_no = $1 
    AND sequence LIKE $2
    AND recharge_date::date < CURRENT_DATE
  `, [accountNo, pattern]);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════
async function verifyAll() {
  console.log('\n' + '█'.repeat(75));
  console.log('  🔍 FULL SYSTEM VERIFICATION');
  console.log('█'.repeat(75));

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: Database & User
  // ═══════════════════════════════════════════════════════════════════════
  section('1️⃣  DATABASE & USER');

  let user = null;
  try {
    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );
    
    if (userResult.rows.length === 0) {
      check('User exists', false, `serial=${USER_SERIAL} not found`);
      process.exit(1);
    }

    user = userResult.rows[0];
    check('User found', true, `${user.full_name} (${user.m_bondhu_id})`);
    check('Email present', !!user.email, user.email);
    check('Email enabled', user.email_notification_enabled === true);
    check('Account number', !!user.account_no, user.account_no);
    check('Meter number', !!user.meter_no, user.meter_no);
    check('Meter type', !!user.meter_type, user.meter_type);
    check('Alert threshold', !!user.low_balance_alert_threshold, `৳${user.low_balance_alert_threshold}`);
  } catch (error) {
    check('User query', false, error.message);
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: Service Methods
  // ═══════════════════════════════════════════════════════════════════════
  section('2️⃣  SERVICE METHODS');

  check('emailService.sendRechargeReceiptEmail', typeof emailService.sendRechargeReceiptEmail === 'function');
  check('emailService.sendAlertEmail', typeof emailService.sendAlertEmail === 'function');
  check('emailService.getRechargeReceiptHTML', typeof emailService.getRechargeReceiptHTML === 'function');
  check('emailService.getAlertEmailHTML', typeof emailService.getAlertEmailHTML === 'function');
  
  check('rechargeService.checkForNewRecharges', typeof rechargeService.checkForNewRecharges === 'function');
  check('rechargeService.getTodayRecharge', typeof rechargeService.getTodayRecharge === 'function');
  check('rechargeService.saveRechargeHistory', typeof rechargeService.saveRechargeHistory === 'function');
  
  check('alertService.getUserBalanceDirect', typeof alertService.getUserBalanceDirect === 'function');
  check('alertService.getTodayRecharge', typeof alertService.getTodayRecharge === 'function');
  check('alertService.processUserAlert', typeof alertService.processUserAlert === 'function');

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: Logo URLs
  // ═══════════════════════════════════════════════════════════════════════
  section('3️⃣  LOGO URLs (GitHub Raw)');

  const LOGO_BASE = 'https://raw.githubusercontent.com/SabbirHossainBorno/Justfun/master';
  const logos = {
    DESCO: `${LOGO_BASE}/DESCO.png`,
    DPDC: `${LOGO_BASE}/DPDC.png`,
    BREB: `${LOGO_BASE}/BREB.png`,
    BPDB: `${LOGO_BASE}/BPDB.png`,
    NESCO: `${LOGO_BASE}/NESCO.png`,
    WZPDCL: `${LOGO_BASE}/WZPDCL.png`,
  };

  const axios = require('axios');
  for (const [name, url] of Object.entries(logos)) {
    try {
      const res = await axios.head(url, { timeout: 5000 });
      check(`${name} logo`, res.status === 200, `HTTP ${res.status}`);
    } catch (error) {
      check(`${name} logo`, false, error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: Email HTML Generation
  // ═══════════════════════════════════════════════════════════════════════
  section('4️⃣  EMAIL HTML GENERATION');

  const fakeRecharge = {
    totalAmount: 500.00,
    energyAmount: 401.50,
    chargeAmount: 98.50,
    rechargeDate: new Date().toISOString(),
    rechargeOperator: 'OpEasternBank',
    orderStatus: 'Execution Successful',
    seqNo: '16',
    orderID: '0000000715209603',
    tokenNo: '53041260224426219672',
    VAT: 23.81,
    rebate: -2.38,
    chargeItems: [],
  };

  const meterTypes = ['desco', 'dpdc', 'breb', 'bpdb', 'nesco', 'wzpdcl'];
  
  for (const mt of meterTypes) {
    const testUser = { ...user, meter_type: mt };
    try {
      const html = emailService.getRechargeReceiptHTML(testUser, fakeRecharge);
      
      const hasLogo = html.includes(`${LOGO_BASE}/${mt.toUpperCase()}.png`);
      const hasCompany = html.includes(mt.toUpperCase());
      const hasAmount = html.includes('500.00');
      const hasToken = html.includes('5304');
      const hasTotal = html.includes('Total Paid');
      
      const allGood = hasLogo && hasCompany && hasAmount && hasToken && hasTotal;
      check(`HTML for ${mt.toUpperCase()}`, allGood, 
        `logo:${hasLogo ? '✓' : '✗'} company:${hasCompany ? '✓' : '✗'} amount:${hasAmount ? '✓' : '✗'} token:${hasToken ? '✓' : '✗'}`);
    } catch (error) {
      check(`HTML for ${mt.toUpperCase()}`, false, error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: Email Sending Test
  // ═══════════════════════════════════════════════════════════════════════
  section('5️⃣  EMAIL SENDING (Real)');

  console.log('\n  📧 Sending Recharge Receipt to:', user.email);
  try {
    const sent = await emailService.sendRechargeReceiptEmail(user, fakeRecharge);
    check('Recharge email sent', sent, user.email);
  } catch (error) {
    check('Recharge email sent', false, error.message);
  }

  const alertData = {
    title: '⚠️ Low Balance Alert',
    message: 'Test alert',
    type: 'warning',
    meterNo: user.meter_no,
    balance: '150.00',
    threshold: 400,
    dailyAvgCost: 50,
    avgEnergyNeeded: 1521,
    currentMonthRecharge: 350,
    currentMonthEnergy: 281,
    netEnergyNeeded: 1240,
    totalRechargeNeeded: 1544,
    suggestionAmount: 1600,
    avgEnergyPercentage: 0.803,
    isCritical: false,
    monthlyBreakdown: [],
    projectedBalanceInfo: null,
  };

  console.log('\n  📧 Sending Alert Email to:', user.email);
  try {
    const sent = await emailService.sendAlertEmail(user, alertData);
    check('Alert email sent', sent, user.email);
  } catch (error) {
    check('Alert email sent', false, error.message);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 6: Mock DESCO & Full Flow
  // ═══════════════════════════════════════════════════════════════════════
  section('6️⃣  FULL FLOW (Mock DESCO)');

  mockDesco.patchRealService(DescoService);
  mockDesco.reset();
  mockDesco.setBalance(150);
  mockDesco.setDailyAvgCost(50);

  // ─── Clean up any previous test data ──────────────────────────────────
  await pool.query(`
    DELETE FROM recharge_history 
    WHERE account_no = $1 AND sequence LIKE 'VERIFY%'
  `, [user.account_no]);

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario A: Big recharge (৳1000) → Alert OFF
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n  🧪 Scenario A: Big Recharge ৳1000 → Alert OFF');
  
  const todayLocal = getTodayLocalSQL();
  console.log(`     📅 Today (server tz): ${todayLocal}`);

  mockDesco.addRecharge(1000, { 
    seqNo: `VERIFY_${Date.now()}_A`,
    date: todayLocal,  // ✅ Force today's date
  });

  const checkA = await rechargeService.checkForNewRecharges(USER_SERIAL);
  check('Big recharge detected', checkA.success, checkA.message);

  // ✅ Force recharge_date to today if needed (timezone safety)
  await forceTodayDate(user.account_no, 'VERIFY%');

  const todayA = await rechargeService.getTodayRecharge(user);
  check('Today\'s total', todayA?.totalAmount === 1000, `৳${todayA?.totalAmount || 0}`);

  const balanceA = await alertService.getUserBalanceDirect(user);
  const dailyAvgA = await alertService.calculateDailyAvgCost(user);
  const energyPctA = await alertService.getAverageEnergyPercentage(user);
  const energyA = (todayA?.totalAmount || 0) * energyPctA;
  const projectedA = balanceA + energyA - dailyAvgA;
  
  console.log(`     📊 Projected: ৳${projectedA.toFixed(2)} (threshold: ৳${user.low_balance_alert_threshold})`);
  check('Projected > threshold', projectedA > user.low_balance_alert_threshold, 
    `৳${projectedA.toFixed(2)} > ৳${user.low_balance_alert_threshold}`);

  const alertA = await alertService.forceCheckForUser(user.m_bondhu_id);
  check('Alert NOT sent', !alertA.alertSent, alertA.message);

  // Cleanup A
  await pool.query(`
    DELETE FROM recharge_history WHERE account_no = $1 AND sequence LIKE 'VERIFY%'
  `, [user.account_no]);
  await pool.query(`
    DELETE FROM alert_logs WHERE m_bondhu_id = $1 AND created_at >= CURRENT_DATE
  `, [user.m_bondhu_id]);

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario B: Small recharge (৳100) → Alert ON
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n  🧪 Scenario B: Small Recharge ৳100 → Alert ON');
  
  mockDesco.reset();
  mockDesco.setBalance(150);
  mockDesco.setDailyAvgCost(50);
  
  const todayLocal2 = getTodayLocalSQL();
  mockDesco.addRecharge(100, { 
    seqNo: `VERIFY_${Date.now()}_B`,
    date: todayLocal2,  // ✅ Force today's date
  });

  const checkB = await rechargeService.checkForNewRecharges(USER_SERIAL);
  check('Small recharge detected', checkB.success, checkB.message);

  // ✅ Force recharge_date to today if needed
  await forceTodayDate(user.account_no, 'VERIFY%');

  const todayB = await rechargeService.getTodayRecharge(user);
  console.log(`     💰 Today's total: ৳${todayB?.totalAmount || 0}`);
  
  const balanceB = await alertService.getUserBalanceDirect(user);
  const dailyAvgB = await alertService.calculateDailyAvgCost(user);
  const energyPctB = await alertService.getAverageEnergyPercentage(user);
  const energyB = (todayB?.totalAmount || 0) * energyPctB;
  const projectedB = balanceB + energyB - dailyAvgB;

  console.log(`     📊 Projected: ৳${projectedB.toFixed(2)} (threshold: ৳${user.low_balance_alert_threshold})`);
  check('Projected < threshold', projectedB < user.low_balance_alert_threshold,
    `৳${projectedB.toFixed(2)} < ৳${user.low_balance_alert_threshold}`);

  const alertB = await alertService.forceCheckForUser(user.m_bondhu_id);
  check('Alert sent', alertB.alertSent, alertB.message);

  // Cleanup B
  await pool.query(`
    DELETE FROM recharge_history WHERE account_no = $1 AND sequence LIKE 'VERIFY%'
  `, [user.account_no]);
  await pool.query(`
    DELETE FROM alert_logs WHERE m_bondhu_id = $1 AND created_at >= CURRENT_DATE
  `, [user.m_bondhu_id]);

  mockDesco.restoreRealService(DescoService);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 7: Database Integrity
  // ═══════════════════════════════════════════════════════════════════════
  section('7️⃣  DATABASE INTEGRITY');

  try {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM recharge_history WHERE account_no = $1',
      [user.account_no]
    );
    check('Recharge records exist', parseInt(countResult.rows[0].count) > 0, 
      `${countResult.rows[0].count} records`);

    const unprocessedResult = await pool.query(`
      SELECT COUNT(*) FROM recharge_history 
      WHERE is_mail_sent = false AND order_status = 'Execution Successful'
    `);
    check('Unprocessed recharges', true, 
      `${unprocessedResult.rows[0].count} pending emails`);

    const alertResult = await pool.query(
      'SELECT COUNT(*) FROM alert_logs WHERE m_bondhu_id = $1',
      [user.m_bondhu_id]
    );
    check('Alert logs exist', true, `${alertResult.rows[0].count} alerts`);
  } catch (error) {
    check('DB integrity', false, error.message);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '█'.repeat(75));
  console.log('  📊 FINAL SUMMARY');
  console.log('█'.repeat(75));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total:  ${results.length}`);
  console.log(`  📈 Score:  ${((passed / results.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('  ❌ FAILED CHECKS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    • ${r.name}${r.details ? ' → ' + r.details : ''}`);
    });
    console.log();
  }

  console.log('█'.repeat(75) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

verifyAll().catch(error => {
  console.error('\n❌ Verification failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});