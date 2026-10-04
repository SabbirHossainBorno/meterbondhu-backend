// src/tests/test-full-flow.js
// ═══════════════════════════════════════════════════════════════════════
// FULL FLOW TEST - Mock DESCO + Real DB + Real Email
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../config/database');
const DescoService = require('../services/descoService');
const rechargeService = require('../services/rechargeService');
const alertService = require('../services/alertService');
const mockDesco = require('../mocks/mockDescoService');

const USER_SERIAL = '2';

async function testFullFlow() {
  console.log('\n' + '█'.repeat(75));
  console.log('🔄 FULL FLOW TEST');
  console.log('█'.repeat(75));

  try {
    mockDesco.patchRealService(DescoService);
    mockDesco.reset();

    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );
    const user = userResult.rows[0];

    console.log(`\n👤 User: ${user.full_name} (${user.m_bondhu_id})`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`📊 Threshold: ৳${user.low_balance_alert_threshold}`);

    // Clean
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'TEST%'
    `, [user.account_no]);

    // ═══════════════════════════════════════════════════════════════
    // SCENARIO 1: Big Recharge → Alert OFF
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(75));
    console.log('🧪 SCENARIO 1: Big Recharge ৳1000 → Alert OFF');
    console.log('═'.repeat(75));

    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);
    mockDesco.addRecharge(1000);

    const check1 = await rechargeService.checkForNewRecharges(USER_SERIAL);
    console.log(`\n📊 Recharge Check: ${check1.success ? '✅' : '❌'} ${check1.message}`);

    const today1 = await rechargeService.getTodayRecharge(user);
    console.log(`💰 Today's Total: ৳${today1?.totalAmount || 0} (${today1?.count || 0} txns)`);

    const balance1 = await alertService.getUserBalanceDirect(user);
    const dailyAvg1 = await alertService.calculateDailyAvgCost(user);
    const energyPct1 = await alertService.getAverageEnergyPercentage(user);
    const energy1 = (today1?.totalAmount || 0) * energyPct1;
    const projected1 = balance1 + energy1 - dailyAvg1;

    console.log(`\n📊 Projected Balance:`);
    console.log(`  • Current: ৳${balance1.toFixed(2)}`);
    console.log(`  • Energy: ৳${energy1.toFixed(2)}`);
    console.log(`  • Daily Avg: ৳${dailyAvg1.toFixed(2)}`);
    console.log(`  • Projected: ৳${projected1.toFixed(2)}`);
    console.log(`  • Threshold: ৳${user.low_balance_alert_threshold}`);
    console.log(`  • Safe: ${projected1 > user.low_balance_alert_threshold ? 'YES ✅' : 'NO ⚠️'}`);

    const alert1 = await alertService.forceCheckForUser(user.m_bondhu_id);
    console.log(`\n🚨 Alert: ${alert1.alertSent ? 'SENT ⚠️' : 'NOT SENT ✅'}`);

    if (!alert1.alertSent) {
      console.log(`✅ PASS: Alert correctly NOT sent`);
    } else {
      console.log(`❌ FAIL: Alert should NOT have been sent`);
    }

    // Cleanup
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'TEST%'
    `, [user.account_no]);

    // ═══════════════════════════════════════════════════════════════
    // SCENARIO 2: Small Recharge → Alert ON
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(75));
    console.log('🧪 SCENARIO 2: Small Recharge ৳100 → Alert ON');
    console.log('═'.repeat(75));

    mockDesco.reset();
    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);
    mockDesco.addRecharge(100);

    const check2 = await rechargeService.checkForNewRecharges(USER_SERIAL);
    console.log(`\n📊 Recharge Check: ${check2.success ? '✅' : '❌'} ${check2.message}`);

    const today2 = await rechargeService.getTodayRecharge(user);
    const balance2 = await alertService.getUserBalanceDirect(user);
    const dailyAvg2 = await alertService.calculateDailyAvgCost(user);
    const energyPct2 = await alertService.getAverageEnergyPercentage(user);
    const energy2 = (today2?.totalAmount || 0) * energyPct2;
    const projected2 = balance2 + energy2 - dailyAvg2;

    console.log(`\n📊 Projected Balance:`);
    console.log(`  • Projected: ৳${projected2.toFixed(2)}`);
    console.log(`  • Threshold: ৳${user.low_balance_alert_threshold}`);

    const alert2 = await alertService.forceCheckForUser(user.m_bondhu_id);
    console.log(`\n🚨 Alert: ${alert2.alertSent ? 'SENT ⚠️' : 'NOT SENT ✅'}`);

    if (alert2.alertSent) {
      console.log(`✅ PASS: Alert correctly sent`);
    } else {
      console.log(`❌ FAIL: Alert should have been sent`);
    }

    // Cleanup
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'TEST%'
    `, [user.account_no]);

    await pool.query(`
      DELETE FROM alert_logs 
      WHERE m_bondhu_id = $1 
      AND created_at >= CURRENT_DATE
    `, [user.m_bondhu_id]);

    // ═══════════════════════════════════════════════════════════════
    // SCENARIO 3: Multiple Recharges → Combined
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(75));
    console.log('🧪 SCENARIO 3: Multiple Recharges (৳200+৳300) → Alert OFF');
    console.log('═'.repeat(75));

    mockDesco.reset();
    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);

    mockDesco.addRecharge(200);
    await rechargeService.checkForNewRecharges(USER_SERIAL);
    console.log('➕ Added ৳200');

    mockDesco.addRecharge(300);
    await rechargeService.checkForNewRecharges(USER_SERIAL);
    console.log('➕ Added ৳300');

    const today3 = await rechargeService.getTodayRecharge(user);
    console.log(`\n💰 Today's Total: ৳${today3?.totalAmount} (${today3?.count} txns)`);

    const balance3 = await alertService.getUserBalanceDirect(user);
    const dailyAvg3 = await alertService.calculateDailyAvgCost(user);
    const energyPct3 = await alertService.getAverageEnergyPercentage(user);
    const energy3 = (today3?.totalAmount || 0) * energyPct3;
    const projected3 = balance3 + energy3 - dailyAvg3;

    console.log(`\n📊 Projected: ৳${projected3.toFixed(2)}`);

    const alert3 = await alertService.forceCheckForUser(user.m_bondhu_id);
    console.log(`\n🚨 Alert: ${alert3.alertSent ? 'SENT ⚠️' : 'NOT SENT ✅'}`);

    if (!alert3.alertSent) {
      console.log(`✅ PASS: Combined → Alert OFF`);
    } else {
      console.log(`❌ FAIL: Alert should NOT have been sent`);
    }

    // Final Cleanup
    console.log('\n🧹 Final cleanup...');
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'TEST%'
    `, [user.account_no]);
    await pool.query(`
      DELETE FROM alert_logs 
      WHERE m_bondhu_id = $1 
      AND created_at >= CURRENT_DATE
    `, [user.m_bondhu_id]);
    console.log('✅ Cleaned');

    mockDesco.restoreRealService(DescoService);

    console.log('\n' + '█'.repeat(75));
    console.log('📊 FINAL SUMMARY');
    console.log('█'.repeat(75));
    console.log(`  S1 (Big Recharge):       ${!alert1.alertSent ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  S2 (Small Recharge):     ${alert2.alertSent ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  S3 (Multiple Recharge):  ${!alert3.alertSent ? '✅ PASS' : '❌ FAIL'}`);
    console.log('█'.repeat(75) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    mockDesco.restoreRealService(DescoService);
    process.exit(1);
  }
}

testFullFlow();