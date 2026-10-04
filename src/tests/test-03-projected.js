// tests/test-03-projected.js
// ═══════════════════════════════════════════════════════════════════════
// TEST 3: Projected Balance Calculation
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../src/config/database');
const DescoService = require('../src/services/descoService');
const alertService = require('../src/services/alertService');
const rechargeService = require('../src/services/rechargeService');
const mockDesco = require('../src/mocks/mockDescoService');
const mockFactory = require('../src/mocks/mockDataFactory');

const USER_SERIAL = process.env.TEST_USER_SERIAL || 'YOUR_USER_SERIAL_HERE';

async function testProjectedBalance() {
  console.log('\n' + '█'.repeat(70));
  console.log('📊 TEST 3: Projected Balance Calculation');
  console.log('█'.repeat(70));

  try {
    // ─── Mock Setup ──────────────────────────────────────────────
    mockDesco.patchRealService(DescoService);
    mockDesco.reset();

    // ─── User আনুন ───────────────────────────────────────────────
    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );
    const user = userResult.rows[0];
    
    // ─── Threshold সেট করুন ─────────────────────────────────────
    await pool.query(
      'UPDATE user_info SET low_balance_alert_threshold = $1 WHERE serial = $2',
      [200, USER_SERIAL]
    );
    user.low_balance_alert_threshold = 200;

    console.log(`\n👤 User: ${user.full_name}`);
    console.log(`📊 Threshold: ৳${user.low_balance_alert_threshold}`);
    console.log(`📧 Email: ${user.email}`);

    // ─── Clean previous test data ────────────────────────────────
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'TEST%'
    `, [user.account_no]);

    // ─── Scenarios চালান ─────────────────────────────────────────
    const scenarios = mockFactory.scenarios();

    for (const [name, scenario] of Object.entries(scenarios)) {
      console.log('\n' + '═'.repeat(70));
      console.log(`🧪 SCENARIO: ${name}`);
      console.log('═'.repeat(70));

      // Mock reset
      mockDesco.reset();
      mockDesco.setBalance(scenario.balance);
      mockDesco.setDailyAvgCost(scenario.dailyAvg);

      // Recharges যোগ করুন
      scenario.recharges.forEach(amount => {
        mockDesco.addRecharge(amount);
        rechargeService.saveRechargeHistory(user, mockFactory.createRecharge(amount), true);
      });

      // Expected vs Actual
      console.log(`\n📊 Expected:`);
      console.log(`  • Balance: ৳${scenario.balance}`);
      console.log(`  • Recharges: [${scenario.recharges.join(', ')}]`);
      console.log(`  • Total Recharge: ৳${scenario.recharges.reduce((a, b) => a + b, 0)}`);
      console.log(`  • Daily Avg: ৳${scenario.dailyAvg}`);
      console.log(`  • Projected: ৳${scenario.expected.projectedBalance.toFixed(2)}`);
      console.log(`  • Alert Should Send: ${scenario.expected.alertShouldSend ? 'YES ⚠️' : 'NO ✅'}`);

      // ─── Actual Calculation ────────────────────────────────────
      const todayRecharge = await rechargeService.getTodayRecharge(user);
      const dailyAvg = await alertService.calculateDailyAvgCost(user);
      const energyPct = await alertService.getAverageEnergyPercentage(user);
      const balance = await alertService.getUserBalanceDirect(user);

      let actualProjected;
      if (todayRecharge && todayRecharge.hasRecharged) {
        const energy = todayRecharge.totalAmount * energyPct;
        actualProjected = balance + energy - dailyAvg;
      } else {
        actualProjected = balance - dailyAvg;
      }

      console.log(`\n📊 Actual:`);
      console.log(`  • Balance: ৳${balance.toFixed(2)}`);
      console.log(`  • Today's Total: ৳${todayRecharge?.totalAmount || 0}`);
      console.log(`  • Daily Avg: ৳${dailyAvg.toFixed(2)}`);
      console.log(`  • Energy %: ${(energyPct * 100).toFixed(1)}%`);
      console.log(`  • Projected: ৳${actualProjected.toFixed(2)}`);

      // ─── Result ────────────────────────────────────────────────
      const expectedProjected = scenario.expected.projectedBalance;
      const tolerance = 1; // ৳1 tolerance
      const match = Math.abs(actualProjected - expectedProjected) < tolerance;

      console.log(`\n${match ? '✅ PASS' : '❌ FAIL'}: Projected balance ${match ? 'matches' : 'does not match'}`);

      // ─── Cleanup scenario ──────────────────────────────────────
      await pool.query(`
        DELETE FROM recharge_history 
        WHERE account_no = $1 
        AND sequence LIKE 'TEST%'
      `, [user.account_no]);
    }

    // ─── Restore ─────────────────────────────────────────────────
    mockDesco.restoreRealService(DescoService);

    console.log('\n' + '█'.repeat(70));
    console.log('✅ TEST 3 Complete');
    console.log('█'.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    mockDesco.restoreRealService(DescoService);
    process.exit(1);
  }
}

testProjectedBalance();