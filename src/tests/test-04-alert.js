// tests/test-04-alert.js
// ═══════════════════════════════════════════════════════════════════════
// TEST 4: Alert Decision Logic
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../src/config/database');
const DescoService = require('../src/services/descoService');
const alertService = require('../src/services/alertService');
const rechargeService = require('../src/services/rechargeService');
const mockDesco = require('../src/mocks/mockDescoService');
const mockFactory = require('../src/mocks/mockDataFactory');

const USER_SERIAL = process.env.TEST_USER_SERIAL || 'YOUR_USER_SERIAL_HERE';

async function testAlert() {
  console.log('\n' + '█'.repeat(70));
  console.log('🚨 TEST 4: Alert Decision Logic');
  console.log('█'.repeat(70));

  try {
    mockDesco.patchRealService(DescoService);
    mockDesco.reset();

    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );
    const user = userResult.rows[0];

    // Threshold সেট করুন
    await pool.query(
      'UPDATE user_info SET low_balance_alert_threshold = $1 WHERE serial = $2',
      [200, USER_SERIAL]
    );
    user.low_balance_alert_threshold = 200;

    console.log(`\n👤 User: ${user.full_name}`);
    console.log(`📊 Threshold: ৳200`);

    // ─── Clean ───────────────────────────────────────────────────
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'ALERT%'
    `, [user.account_no]);
    
    await pool.query(`
      DELETE FROM alert_logs 
      WHERE m_bondhu_id = $1 
      AND created_at >= CURRENT_DATE
    `, [user.m_bondhu_id]);

    // ═══════════════════════════════════════════════════════════════
    // Test 4.1: Alert বন্ধ হবে (বড় recharge)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 4.1: Big Recharge → Alert OFF');
    console.log('─'.repeat(70));

    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);
    
    // ৳1000 recharge → projected ৳903 > ৳200
    mockDesco.addRecharge(1000);
    await rechargeService.saveRechargeHistory(
      user, 
      mockFactory.createRecharge(1000, { seqNo: `ALERT_${Date.now()}_1` }),
      true
    );

    const result1 = await alertService.forceCheckForUser(user.m_bondhu_id);
    console.log(`\n📊 Result: ${result1.message}`);
    console.log(`   Alert Sent: ${result1.alertSent ? 'YES' : 'NO'}`);

    if (!result1.alertSent) {
      console.log(`✅ PASS: Alert correctly NOT sent`);
    } else {
      console.log(`❌ FAIL: Alert should NOT have been sent`);
    }

    // ─── Clean before next test ─────────────────────────────────
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'ALERT%'
    `, [user.account_no]);

    // ═══════════════════════════════════════════════════════════════
    // Test 4.2: Alert যাবে (ছোট recharge)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 4.2: Small Recharge → Alert ON');
    console.log('─'.repeat(70));

    mockDesco.reset();
    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);

    // ৳100 recharge → projected ৳180.30 < ৳200
    mockDesco.addRecharge(100);
    await rechargeService.saveRechargeHistory(
      user, 
      mockFactory.createRecharge(100, { seqNo: `ALERT_${Date.now()}_2` }),
      true
    );

    const result2 = await alertService.forceCheckForUser(user.m_bondhu_id);
    console.log(`\n📊 Result: ${result2.message}`);
    console.log(`   Alert Sent: ${result2.alertSent ? 'YES' : 'NO'}`);

    if (result2.alertSent) {
      console.log(`✅ PASS: Alert correctly sent`);
    } else {
      console.log(`❌ FAIL: Alert should have been sent`);
    }

    // ─── Clean ──────────────────────────────────────────────────
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'ALERT%'
    `, [user.account_no]);

    // ═══════════════════════════════════════════════════════════════
    // Test 4.3: Multiple Recharges Combined
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 4.3: Multiple Recharges (Combined)');
    console.log('─'.repeat(70));

    mockDesco.reset();
    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);

    // ৳100 + ৳200 = ৳300 → projected ৳340.90 > ৳200
    mockDesco.addRecharge(100);
    mockDesco.addRecharge(200);
    
    await rechargeService.saveRechargeHistory(
      user, 
      mockFactory.createRecharge(100, { seqNo: `ALERT_${Date.now()}_3a` }),
      true
    );
    await rechargeService.saveRechargeHistory(
      user, 
      mockFactory.createRecharge(200, { seqNo: `ALERT_${Date.now()}_3b` }),
      true
    );

    const result3 = await alertService.forceCheckForUser(user.m_bondhu_id);
    console.log(`\n📊 Result: ${result3.message}`);
    console.log(`   Alert Sent: ${result3.alertSent ? 'YES' : 'NO'}`);

    if (!result3.alertSent) {
      console.log(`✅ PASS: Combined recharges → Alert OFF`);
    } else {
      console.log(`❌ FAIL: Alert should NOT have been sent`);
    }

    // ─── Cleanup ─────────────────────────────────────────────────
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'ALERT%'
    `, [user.account_no]);

    await pool.query(`
      DELETE FROM alert_logs 
      WHERE m_bondhu_id = $1 
      AND created_at >= CURRENT_DATE
    `, [user.m_bondhu_id]);

    // ─── Restore ─────────────────────────────────────────────────
    mockDesco.restoreRealService(DescoService);

    console.log('\n' + '█'.repeat(70));
    console.log('📊 TEST 4 SUMMARY');
    console.log('█'.repeat(70));
    console.log(`  Big Recharge (Alert OFF):      ${!result1.alertSent ? '✅' : '❌'}`);
    console.log(`  Small Recharge (Alert ON):     ${result2.alertSent ? '✅' : '❌'}`);
    console.log(`  Multiple Recharges (Alert OFF): ${!result3.alertSent ? '✅' : '❌'}`);
    console.log('█'.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    mockDesco.restoreRealService(DescoService);
    process.exit(1);
  }
}

testAlert();