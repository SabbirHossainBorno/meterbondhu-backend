// tests/test-02-recharge.js
// ═══════════════════════════════════════════════════════════════════════
// TEST 2: Recharge Flow Test (Mock DESCO)
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool } = require('../src/config/database');
const DescoService = require('../src/services/descoService');
const rechargeService = require('../src/services/rechargeService');
const mockDesco = require('../src/mocks/mockDescoService');
const mockFactory = require('../src/mocks/mockDataFactory');

const USER_SERIAL = process.env.TEST_USER_SERIAL || 'YOUR_USER_SERIAL_HERE';

async function testRecharge() {
  console.log('\n' + '█'.repeat(70));
  console.log('🔄 TEST 2: Recharge Flow');
  console.log('█'.repeat(70));

  try {
    // ─── Mock DESCO Patch ────────────────────────────────────────
    mockDesco.patchRealService(DescoService);
    mockDesco.reset();
    mockDesco.setBalance(150);
    mockDesco.setDailyAvgCost(50);

    // ─── User আনুন ───────────────────────────────────────────────
    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE serial = $1',
      [USER_SERIAL]
    );
    const user = userResult.rows[0];

    console.log(`\n👤 User: ${user.full_name}`);

    // ─── Clean previous test data ────────────────────────────────
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'MOCK%'
    `, [user.account_no]);
    console.log('🧹 Cleaned old test data');

    // ═══════════════════════════════════════════════════════════════
    // Test 2.1: নতুন recharge check
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 2.1: New Recharge Detection');
    console.log('─'.repeat(70));

    // DESCO তে recharge যোগ করুন
    mockDesco.addRecharge(500);
    console.log('📦 Added ৳500 recharge to mock DESCO');

    // Check করুন
    const checkResult = await rechargeService.checkForNewRecharges(USER_SERIAL);
    
    console.log(`\n📊 Check Result:`);
    console.log(`  • Success: ${checkResult.success}`);
    console.log(`  • Message: ${checkResult.message}`);

    if (checkResult.success) {
      console.log(`✅ PASS: New recharge detected and processed`);
    } else {
      console.log(`❌ FAIL: ${checkResult.message}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Test 2.2: Same recharge আবার check (duplicate detection)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 2.2: Duplicate Recharge Detection');
    console.log('─'.repeat(70));

    const checkResult2 = await rechargeService.checkForNewRecharges(USER_SERIAL);
    
    if (!checkResult2.success && checkResult2.message === 'Already processed') {
      console.log(`✅ PASS: Duplicate correctly detected`);
    } else {
      console.log(`❌ FAIL: Duplicate not detected properly`);
      console.log(`   Result: ${JSON.stringify(checkResult2)}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Test 2.3: Today's Total Recharge
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 2.3: Today\'s Total Recharge');
    console.log('─'.repeat(70));

    // আরও ২টি recharge যোগ করুন
    mockDesco.addRecharge(300);
    mockDesco.addRecharge(200);

    await rechargeService.checkForNewRecharges(USER_SERIAL);

    const todayRecharge = await rechargeService.getTodayRecharge(user);
    
    console.log(`\n📊 Today's Total:`);
    console.log(`  • Total: ৳${todayRecharge?.totalAmount || 0}`);
    console.log(`  • Count: ${todayRecharge?.count || 0}`);

    const expectedTotal = 1000; // 500 + 300 + 200
    if (todayRecharge?.totalAmount === expectedTotal) {
      console.log(`✅ PASS: Total ৳${expectedTotal} matches`);
    } else {
      console.log(`❌ FAIL: Expected ৳${expectedTotal}, got ৳${todayRecharge?.totalAmount}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Test 2.4: DB তে সেভ হয়েছে কিনা চেক
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(70));
    console.log('Test 2.4: Database Verification');
    console.log('─'.repeat(70));

    const dbResult = await pool.query(`
      SELECT recharge_id, sequence, total_amount, is_mail_sent
      FROM recharge_history 
      WHERE account_no = $1 
      AND recharge_date >= CURRENT_DATE
      ORDER BY recharge_date DESC
    `, [user.account_no]);

    console.log(`\n📊 DB Records: ${dbResult.rows.length}`);
    dbResult.rows.forEach(row => {
      console.log(`  • ${row.recharge_id}: ৳${row.total_amount} (mail: ${row.is_mail_sent})`);
    });

    if (dbResult.rows.length === 3) {
      console.log(`✅ PASS: All 3 recharges in DB`);
    } else {
      console.log(`❌ FAIL: Expected 3, got ${dbResult.rows.length}`);
    }

    // ─── Cleanup ─────────────────────────────────────────────────
    console.log('\n🧹 Cleaning up...');
    await pool.query(`
      DELETE FROM recharge_history 
      WHERE account_no = $1 
      AND sequence LIKE 'MOCK%'
    `, [user.account_no]);
    console.log('✅ Cleaned');

    // ─── Restore ─────────────────────────────────────────────────
    mockDesco.restoreRealService(DescoService);

    console.log('\n' + '█'.repeat(70));
    console.log('📊 TEST 2 SUMMARY');
    console.log('█'.repeat(70));
    console.log(`  Recharge Detection: ${checkResult.success ? '✅' : '❌'}`);
    console.log(`  Duplicate Detection: ${!checkResult2.success ? '✅' : '❌'}`);
    console.log(`  Today's Total: ${todayRecharge?.totalAmount === expectedTotal ? '✅' : '❌'}`);
    console.log(`  DB Save: ${dbResult.rows.length === 3 ? '✅' : '❌'}`);
    console.log('█'.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    // Restore on error
    mockDesco.restoreRealService(DescoService);
    process.exit(1);
  }
}

testRecharge();