// src/tests/test-scenarios.js
// ═══════════════════════════════════════════════════════════════════════
// ALL SCENARIOS TEST
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../config/database');
const DescoService = require('../services/descoService');
const rechargeService = require('../services/rechargeService');
const alertService = require('../services/alertService');
const mockDesco = require('../mocks/mockDescoService');
const mockFactory = require('../mocks/mockDataFactory');

const USER_SERIAL = '2';

async function testScenarios() {
  console.log('\n' + '█'.repeat(75));
  console.log('🧪 ALL SCENARIOS TEST');
  console.log('█'.repeat(75));

  const results = [];

  try {
    mockDesco.patchRealService(DescoService);

    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );
    const user = userResult.rows[0];

    console.log(`\n👤 User: ${user.full_name}`);
    console.log(`📊 Threshold: ৳${user.low_balance_alert_threshold}`);

    // Clean
    await pool.query(`
      DELETE FROM recharge_history WHERE account_no = $1 AND sequence LIKE 'TEST%'
    `, [user.account_no]);
    await pool.query(`
      DELETE FROM alert_logs WHERE m_bondhu_id = $1 AND created_at >= CURRENT_DATE
    `, [user.m_bondhu_id]);

    const scenarios = mockFactory.scenarios();

    for (const [name, scenario] of Object.entries(scenarios)) {
      console.log('\n' + '─'.repeat(75));
      console.log(`🧪 ${name}`);
      console.log('─'.repeat(75));

      mockDesco.reset();
      mockDesco.setBalance(scenario.balance);
      mockDesco.setDailyAvgCost(scenario.dailyAvg);

      await pool.query(
        'UPDATE user_info SET low_balance_alert_threshold = $1 WHERE serial = $2',
        [scenario.threshold, USER_SERIAL]
      );
      user.low_balance_alert_threshold = scenario.threshold;

      for (const amount of scenario.recharges) {
        mockDesco.addRecharge(amount);
        await rechargeService.checkForNewRecharges(USER_SERIAL);
      }

      const todayRecharge = await rechargeService.getTodayRecharge(user);
      const balance = await alertService.getUserBalanceDirect(user);
      const dailyAvg = await alertService.calculateDailyAvgCost(user);
      const energyPct = await alertService.getAverageEnergyPercentage(user);
      const energy = (todayRecharge?.totalAmount || 0) * energyPct;
      const projected = balance + energy - dailyAvg;

      console.log(`\n📊 Expected:`);
      console.log(`  • Balance: ৳${scenario.balance}`);
      console.log(`  • Recharges: [${scenario.recharges.join(', ')}]`);
      console.log(`  • Projected: ৳${scenario.expected.projectedBalance.toFixed(2)}`);
      console.log(`  • Alert Should Send: ${scenario.expected.alertShouldSend ? 'YES ⚠️' : 'NO ✅'}`);

      console.log(`\n📊 Actual:`);
      console.log(`  • Projected: ৳${projected.toFixed(2)}`);

      const alertResult = await alertService.forceCheckForUser(user.m_bondhu_id);
      console.log(`  • Alert Sent: ${alertResult.alertSent ? 'YES ⚠️' : 'NO ✅'}`);

      const projectedMatch = Math.abs(projected - scenario.expected.projectedBalance) < 2;
      const alertMatch = alertResult.alertSent === scenario.expected.alertShouldSend;
      const passed = projectedMatch && alertMatch;

      console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}`);
      if (!projectedMatch) console.log(`   ⚠️ Projected mismatch`);
      if (!alertMatch) console.log(`   ⚠️ Alert decision mismatch`);

      results.push({ name, passed });

      await pool.query(`
        DELETE FROM recharge_history WHERE account_no = $1 AND sequence LIKE 'TEST%'
      `, [user.account_no]);
      await pool.query(`
        DELETE FROM alert_logs WHERE m_bondhu_id = $1 AND created_at >= CURRENT_DATE
      `, [user.m_bondhu_id]);
    }

    mockDesco.restoreRealService(DescoService);

    console.log('\n' + '█'.repeat(75));
    console.log('📊 FINAL SUMMARY');
    console.log('█'.repeat(75));
    results.forEach(r => {
      console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
    });
    const passed = results.filter(r => r.passed).length;
    console.log(`\n  Total: ${passed}/${results.length} passed`);
    console.log('█'.repeat(75) + '\n');

    process.exit(passed === results.length ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    mockDesco.restoreRealService(DescoService);
    process.exit(1);
  }
}

testScenarios();