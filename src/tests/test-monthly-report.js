// src/tests/test-monthly-report.js
// ═══════════════════════════════════════════════════════════════════════════
// Manual Test: Monthly Report Email + Notification
// ═══════════════════════════════════════════════════════════════════════════
// Usage:
//   node src/tests/test-monthly-report.js                       → USR003MBONDHU, Sep 2026
//   node src/tests/test-monthly-report.js USR5MBONDHU           → USR5MBONDHU, Sep 2026
//   node src/tests/test-monthly-report.js USR003MBONDHU 2026-08 → USR003MBONDHU, Aug 2026
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Load .env from PROJECT ROOT
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const { pool } = require('../config/database');
const monthlyReportService = require('../services/monthlyReportService');

// ─── CLI arguments ─────────────────────────────────────────────────────
// Default: USR003MBONDHU (meter = 030110015238)
const DEFAULT_M_BONDHU_ID = 'USR003MBONDHU';
const TARGET_ID = process.argv[2] || DEFAULT_M_BONDHU_ID;

// ─── Default month: Sep 2026 ───────────────────────────────────────────
// If not provided → 2026-09
const DEFAULT_MONTH = '2026-09';
const TARGET_MONTH_ARG = process.argv[3] || DEFAULT_MONTH;

// ═══════════════════════════════════════════════════════════════════════
// ─── Override month logic for testing ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
const originalBuildReportData = monthlyReportService.buildReportData.bind(monthlyReportService);

monthlyReportService.buildReportData = async function (user) {
  if (!TARGET_MONTH_ARG) {
    return originalBuildReportData(user);
  }

  const [yearStr, monthStr] = TARGET_MONTH_ARG.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
    throw new Error(`Invalid month format: "${TARGET_MONTH_ARG}". Use YYYY-MM (e.g., 2026-09)`);
  }

  // Fake today = 1st day of month AFTER target
  // So that `today.getMonth() - 1` = target month
  const fakeToday = new Date(year, month + 1, 1);

  const RealDate = Date;
  const fakeDate = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fakeToday.getTime());
      } else {
        super(...args);
      }
    }
    static now() {
      return fakeToday.getTime();
    }
  };

  global.Date = fakeDate;
  try {
    return await originalBuildReportData(user);
  } finally {
    global.Date = RealDate;
  }
};

// ─── Tiny formatting helpers ───────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const bold = (s) => `${C.bold}${s}${C.reset}`;
const dim = (s) => `${C.dim}${s}${C.reset}`;
const green = (s) => `${C.green}${s}${C.reset}`;
const red = (s) => `${C.red}${s}${C.reset}`;
const yellow = (s) => `${C.yellow}${s}${C.reset}`;
const blue = (s) => `${C.blue}${s}${C.reset}`;
const cyan = (s) => `${C.cyan}${s}${C.reset}`;
const magenta = (s) => `${C.magenta}${s}${C.reset}`;

const line = (char = '═', len = 65) => char.repeat(len);
const header = (title) => {
  console.log(`\n${C.cyan}${line()}${C.reset}`);
  console.log(`${C.cyan}${bold(title)}${C.reset}`);
  console.log(`${C.cyan}${line()}${C.reset}\n`);
};

const step = (n, total, text) => {
  console.log(`\n${C.blue}${bold(`[${n}/${total}]`)} ${text}${C.reset}`);
};

const ok = (text) => console.log(`   ${green('✅')} ${text}`);
const fail = (text) => console.log(`   ${red('❌')} ${text}`);
const info = (label, value) =>
  console.log(`   ${dim('•')} ${label.padEnd(24)} ${bold(value)}`);

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN TEST ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  const startedAt = Date.now();

  header(`🧪 Monthly Report Test — ${TARGET_ID} (${TARGET_MONTH_ARG})`);

  // ─── Env check ─────────────────────────────────────────────────────
  console.log(`${dim('Environment check:')}`);
  console.log(`   ${dim('•')} EMAIL_HOST   = ${process.env.EMAIL_HOST || red('(missing)')}`);
  console.log(`   ${dim('•')} EMAIL_USER   = ${process.env.EMAIL_USER || red('(missing)')}`);
  console.log(`   ${dim('•')} EMAIL_PASS   = ${process.env.EMAIL_PASS ? green('***set***') : red('(missing)')}`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n${red(bold('❌ EMAIL_USER or EMAIL_PASS missing from .env'))}`);
    process.exit(1);
  }

  let exitCode = 0;

  try {
    // ═════════════════════════════════════════════════════════════════
    // STEP 1 — Fetch user
    // ═════════════════════════════════════════════════════════════════
    step(1, 5, 'Fetching user from database...');

    const userResult = await pool.query(
      'SELECT * FROM user_info WHERE m_bondhu_id = $1 AND is_deleted = false',
      [TARGET_ID]
    );

    if (userResult.rows.length === 0) {
      fail(`User not found: ${TARGET_ID}`);
      console.log(`\n${yellow('💡 Available users:')}`);
      const allUsers = await pool.query(
        `SELECT m_bondhu_id, full_name, user_type 
         FROM user_info 
         WHERE is_deleted = false 
         ORDER BY serial`
      );
      allUsers.rows.forEach((u) => {
        console.log(`   ${dim('•')} ${bold(u.m_bondhu_id)} — ${u.full_name} (${u.user_type})`);
      });
      process.exit(1);
    }

    const user = userResult.rows[0];

    ok(`Found: ${bold(user.full_name)}`);
    info('Member ID', user.m_bondhu_id);
    info('Email', user.email);
    info('User Type', user.user_type);
    info('Account No', user.account_no);
    info('Meter No', user.meter_no);
    info('Meter Type', user.meter_type || 'desco');

    if (!user.monthly_report_enabled) {
      console.log(`\n   ${yellow('⚠️  monthly_report_enabled = FALSE')}`);
      console.log(`   ${yellow('Run this SQL to enable:')}`);
      console.log(`   ${dim(`UPDATE user_info SET monthly_report_enabled = true WHERE m_bondhu_id = '${TARGET_ID}';`)}`);
      process.exit(1);
    }
    ok('monthly_report_enabled = true');

    if (!user.email_notification_enabled) {
      console.log(`\n   ${red('⚠️  email_notification_enabled = FALSE')}`);
      process.exit(1);
    }
    ok('email_notification_enabled = true');

    // ═════════════════════════════════════════════════════════════════
    // STEP 2 — Build report data
    // ═════════════════════════════════════════════════════════════════
    step(2, 5, 'Building monthly report data...');

    const reportData = await monthlyReportService.buildReportData(user);

    ok('Report data built successfully');

    console.log(`\n   ${magenta(bold('📅 REPORT MONTH'))}`);
    info('Month Label', reportData.monthLabel);
    info('Month Key', reportData.monthKey);

    console.log(`\n   ${magenta(bold('📊 PRIMARY: This Month Usage (monthly_consumption)'))}`);
    info('Taka', `৳${reportData.monthUsageTaka.toFixed(2)}`);
    info('Unit', reportData.hasUnit
      ? `${reportData.monthUsageUnit.toFixed(2)} kWh`
      : dim('(not available — system-B)'));

    console.log(`\n   ${magenta(bold('📊 SECONDARY: Daily Sum (daily_consumption)'))}`);
    info('Taka', `৳${reportData.dailySumTaka.toFixed(2)}`);
    info('Unit', reportData.dailySumUnit > 0
      ? `${reportData.dailySumUnit.toFixed(2)} kWh`
      : dim('(n/a)'));
    info('Period', reportData.dailySumFrom && reportData.dailySumTo
      ? `${reportData.dailySumFrom} — ${reportData.dailySumTo}`
      : dim('(n/a)'));
    info('Days Count', `${reportData.dailySumDays} days`);

    console.log(`\n   ${magenta(bold('📈 3-MONTH TREND'))}`);
    if (reportData.monthlyTrend.length === 0) {
      console.log(`   ${dim('   (no trend data)')}`);
    } else {
      reportData.monthlyTrend.forEach((m) => {
        const monthName = new Date(m.month + '-01').toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
        console.log(`   ${dim('•')} ${monthName.padEnd(12)} ৳${m.taka.toFixed(2).padStart(10)}${m.unit > 0 ? `  (${m.unit.toFixed(1)} kWh)` : ''}`);
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // ✅ NEW: RECHARGE BREAKDOWN
    // ═════════════════════════════════════════════════════════════════
    console.log(`\n   ${magenta(bold('💰 THIS MONTH RECHARGE'))}`);
    info('Total Amount', `৳${reportData.monthRechargeTaka.toFixed(2)}`);
    info('Transactions', reportData.monthRechargeCount);

    if (reportData.monthRechargeCount > 0) {
      console.log(`\n   ${cyan(bold('   ├─ Recharge Breakdown'))}`);
      info('   ├─ Energy Amount', `৳${reportData.rechargeEnergyAmount.toFixed(2)}`);
      info('   ├─ Charge Amount', `৳${reportData.rechargeChargeAmount.toFixed(2)}`);
      info('   ├─ Rebate', `${reportData.rechargeRebate < 0 ? '-' : ''}৳${Math.abs(reportData.rechargeRebate).toFixed(2)}`);
      info('   ├─ VAT', `৳${reportData.rechargeVat.toFixed(2)}`);
      info('   └─ Total Charges', yellow(bold(`৳${reportData.rechargeTotalCharges.toFixed(2)}`)));

      // Sanity check: energy + total charges vs total
      const computed = reportData.rechargeEnergyAmount + reportData.rechargeTotalCharges;
      const diff = computed - reportData.monthRechargeTaka;
      const diffAbs = Math.abs(diff);

      if (diffAbs < 0.01) {
        console.log(`   ${dim('   ✓')} ${green('Breakdown reconciles perfectly with total')}`);
      } else {
        console.log(`   ${dim('   ⚠')} ${yellow(`Breakdown delta: ৳${diff.toFixed(2)} (Energy + Charges vs Total)`)}`);
      }
    }

    console.log(`\n   ${magenta(bold('📉 PREVIOUS MONTH'))}`);
    info('Label', reportData.prevMonthLabel);
    info('Usage Taka', `৳${reportData.prevMonthUsageTaka.toFixed(2)}`);
    info('Usage Unit', reportData.prevMonthUsageUnit > 0
      ? `${reportData.prevMonthUsageUnit.toFixed(2)} kWh`
      : dim('(n/a)'));

    const usageDiff = reportData.monthUsageTaka - reportData.prevMonthUsageTaka;
    const diffColor = usageDiff > 0 ? red('📈 UP') : green('📉 DOWN');
    console.log(`\n   ${magenta(bold('⚖️  COMPARISON'))}`);
    info('Change', `${diffColor} ৳${Math.abs(usageDiff).toFixed(2)} (${reportData.usagePct.toFixed(1)}%)`);

    console.log(`\n   ${magenta(bold('📈 DAILY STATS'))}`);
    info('Avg Daily Taka', `৳${reportData.avgDailyTaka.toFixed(2)}`);
    info('Avg Daily Unit', reportData.avgDailyUnit > 0
      ? `${reportData.avgDailyUnit.toFixed(2)} kWh`
      : dim('(n/a)'));
    info('Active Days', `${reportData.activeDays} / ${reportData.totalDays}`);
    if (reportData.highestDay) {
      info('Highest Day', `৳${reportData.highestDay.taka.toFixed(2)} on ${reportData.highestDay.date}`);
    }
    if (reportData.lowestDay) {
      info('Lowest Day', `৳${reportData.lowestDay.taka.toFixed(2)} on ${reportData.lowestDay.date}`);
    }

    console.log(`\n   ${magenta(bold('💵 CURRENT BALANCE'))}`);
    info('Balance', `৳${reportData.currentBalance.toFixed(2)}`);
    info('Days of Buffer', `${reportData.daysOfBuffer} days`);

    console.log(`\n   ${magenta(bold('⚡ TOP RECHARGES'))}`);
    if (reportData.topRecharges.length === 0) {
      console.log(`   ${dim('   (no recharges)')}`);
    } else {
      reportData.topRecharges.forEach((r) => {
        console.log(`   ${dim('•')} ${r.date.padEnd(12)} ৳${r.amount.toFixed(2).padStart(8)} (${r.operator})`);
      });
    }

    console.log(`\n   ${magenta(bold('📊 30-DAY CHART'))}`);
    info('Data Points', `${reportData.dailyChart.length} days`);

    console.log(`\n   ${magenta(bold('💡 NEXT MONTH SUGGESTION'))}`);
    if (reportData.suggestionData && reportData.suggestionData.suggestedAmount > 0) {
      info('3-Month Avg', `৳${reportData.suggestionData.avg3Months.toFixed(2)}`);
      info('+ Buffer (10%)', `৳${reportData.suggestionData.buffer.toFixed(2)}`);
      info('Target', `৳${reportData.suggestionData.target.toFixed(2)}`);
      info('- Balance', `৳${reportData.currentBalance.toFixed(2)}`);
      info('- Recharged', `৳${reportData.monthRechargeTaka.toFixed(2)}`);
      info('Net Needed', `৳${reportData.suggestionData.netNeeded.toFixed(2)}`);
      info('Suggested Amount', cyan(bold(`৳${reportData.suggestionData.suggestedAmount}`)));
    } else {
      console.log(`   ${dim('   (no suggestion — balance is sufficient)')}`);
    }

    console.log(`\n   ${magenta(bold('⚙️  SYSTEM INFO'))}`);
    info('Has Unit Data', reportData.hasUnit ? '✅ yes' : '❌ no');
    info('Is System-B', reportData.isSystemB ? '✅ yes' : '❌ no');

    // ═════════════════════════════════════════════════════════════════
    // STEP 3 — Send report
    // ═════════════════════════════════════════════════════════════════
    step(3, 5, 'Sending monthly report (email + notification)...');

    const sendResult = await monthlyReportService.sendMonthlyReportForUser(user);

    if (sendResult.success) {
      ok('Report sent successfully');
    } else {
      fail(`Report failed: ${sendResult.message || 'unknown error'}`);
      exitCode = 1;
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 4 — Verify notification
    // ═════════════════════════════════════════════════════════════════
    step(4, 5, 'Verifying notification in database...');

    await new Promise((r) => setTimeout(r, 500));

    const notifResult = await pool.query(
      `SELECT notification_id, title, message, created_at, is_sent, data
       FROM user_notifications 
       WHERE m_bondhu_id = $1 
         AND notification_type = 'monthly_report'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [TARGET_ID]
    );

    if (notifResult.rows.length > 0) {
      const n = notifResult.rows[0];
      ok('Notification found in DB');
      info('Notification ID', n.notification_id);
      info('Title', n.title);
      info('Is Sent', n.is_sent ? '✅' : '❌');
      info('Created At', new Date(n.created_at).toISOString());
      console.log(`\n   ${dim('Message:')}`);
      console.log(`   ${n.message}`);

      // ✅ Show recharge breakdown from notification payload
      if (n.data && typeof n.data === 'object') {
        const d = n.data;
        if (d.recharge_energy_amount !== undefined) {
          console.log(`\n   ${dim('Notification Payload — Recharge Breakdown:')}`);
          console.log(`   ${dim('•')} energy_amount         = ৳${Number(d.recharge_energy_amount).toFixed(2)}`);
          console.log(`   ${dim('•')} charge_amount         = ৳${Number(d.recharge_charge_amount).toFixed(2)}`);
          console.log(`   ${dim('•')} rebate                = ${Number(d.recharge_rebate) < 0 ? '-' : ''}৳${Math.abs(Number(d.recharge_rebate)).toFixed(2)}`);
          console.log(`   ${dim('•')} vat                   = ৳${Number(d.recharge_vat).toFixed(2)}`);
          console.log(`   ${dim('•')} total_charges         = ৳${Number(d.recharge_total_charges).toFixed(2)}`);
          console.log(`   ${dim('•')} month_recharge_taka   = ৳${Number(d.month_recharge_taka).toFixed(2)}`);
        }
      }
    } else {
      fail('No notification found for this user');
      exitCode = 1;
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 5 — Summary
    // ═════════════════════════════════════════════════════════════════
    step(5, 5, 'Summary');

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);

    console.log(`\n   ${bold('Target User:')}        ${user.full_name} (${user.m_bondhu_id})`);
    console.log(`   ${bold('Meter No:')}           ${user.meter_no}`);
    console.log(`   ${bold('Email:')}              ${user.email}`);
    console.log(`   ${bold('Report Month:')}       ${reportData.monthLabel}`);
    console.log(`   ${bold('Total Recharged:')}    ৳${reportData.monthRechargeTaka.toFixed(2)}`);
    console.log(`   ${bold('  └─ Energy:')}         ৳${reportData.rechargeEnergyAmount.toFixed(2)}`);
    console.log(`   ${bold('  └─ Charges:')}        ৳${reportData.rechargeTotalCharges.toFixed(2)}`);
    console.log(`   ${bold('Report Sent:')}        ${sendResult.success ? green('✅ YES') : red('❌ NO')}`);
    console.log(`   ${bold('Notification:')}       ${notifResult.rows.length > 0 ? green('✅ YES') : red('❌ NO')}`);
    console.log(`   ${bold('Elapsed Time:')}       ${elapsed}s`);

    header(exitCode === 0 ? '✅ TEST PASSED' : '❌ TEST FAILED');

    process.exit(exitCode);
  } catch (error) {
    console.error(`\n${red(bold('❌ TEST CRASHED'))}`);
    console.error(`${red(error.message)}`);
    console.error(`\n${dim(error.stack)}`);
    process.exit(1);
  }
})();