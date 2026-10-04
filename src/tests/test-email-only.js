// src/tests/test-email-only.js
// ═══════════════════════════════════════════════════════════════════════
// TEST: Email Only (Recharge + Alert)
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../config/database');
const emailService = require('../services/emailService');
const mockFactory = require('../mocks/mockDataFactory');

// ⚠️ USR001MBONDHU (serial = 2)
const USER_SERIAL = '2';

async function testEmailOnly() {
  console.log('\n' + '█'.repeat(75));
  console.log('📧 TEST: Email Only (Recharge + Alert)');
  console.log('█'.repeat(75));

  try {
    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ User serial=${USER_SERIAL} not found`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`\n👤 User: ${user.full_name} (${user.m_bondhu_id})`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`📋 Account: ${user.account_no}`);
    console.log(`🔢 Meter: ${user.meter_no}`);

    // ═══════════════════════════════════════════════════════════════
    // TEST 1.1: Recharge Receipt Email
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(75));
    console.log('📧 TEST 1.1: Recharge Receipt Email');
    console.log('─'.repeat(75));

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

    console.log(`\n📦 Fake Recharge:`);
    console.log(`  • Amount: ৳${fakeRecharge.totalAmount}`);
    console.log(`  • Energy: ৳${fakeRecharge.energyAmount}`);
    console.log(`  • Operator: ${fakeRecharge.rechargeOperator}`);

    console.log(`\n📤 Sending recharge email...`);
    const rechargeSent = await emailService.sendRechargeReceiptEmail(user, fakeRecharge);

    if (rechargeSent) {
      console.log(`✅ PASS: Recharge email sent to ${user.email}`);
    } else {
      console.log(`❌ FAIL: Recharge email not sent`);
    }

    // ═══════════════════════════════════════════════════════════════
    // TEST 1.2: Low Balance Alert Email
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(75));
    console.log('📧 TEST 1.2: Low Balance Alert Email');
    console.log('─'.repeat(75));

    const alertData = {
      title: '⚠️ Low Balance Alert',
      message: 'Your DESCO prepaid balance is running low.',
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
      monthlyBreakdown: [
        { month: '2026-07', energyAmount: 1450 },
        { month: '2026-08', energyAmount: 1520 },
        { month: '2026-09', energyAmount: 1593 },
      ],
      projectedBalanceInfo: {
        currentBalance: 150,
        rechargeAmount: 100,
        rechargeEnergy: 80.30,
        dailyAvgCost: 50,
        projectedBalance: 180.30,
        energyPercentage: 0.803,
        threshold: 400,
        isSafe: false,
      },
    };

    console.log(`\n📊 Alert Data:`);
    console.log(`  • Balance: ৳${alertData.balance}`);
    console.log(`  • Threshold: ৳${alertData.threshold}`);
    console.log(`  • Projected: ৳${alertData.projectedBalanceInfo.projectedBalance}`);
    console.log(`  • Suggestion: ৳${alertData.suggestionAmount}`);

    console.log(`\n📤 Sending alert email...`);
    const alertSent = await emailService.sendAlertEmail(user, alertData);

    if (alertSent) {
      console.log(`✅ PASS: Alert email sent to ${user.email}`);
    } else {
      console.log(`❌ FAIL: Alert email not sent`);
    }

    // ─── Summary ─────────────────────────────────────────────────
    console.log('\n' + '█'.repeat(75));
    console.log('📊 SUMMARY');
    console.log('█'.repeat(75));
    console.log(`  📧 Recharge Email: ${rechargeSent ? '✅ SENT' : '❌ FAILED'}`);
    console.log(`  ⚠️  Alert Email:    ${alertSent ? '✅ SENT' : '❌ FAILED'}`);
    console.log(`  📬 Check: ${user.email}`);
    console.log('█'.repeat(75) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testEmailOnly();