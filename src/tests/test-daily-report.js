// src/tests/test-daily-report.js
// ═══════════════════════════════════════════════════════════════════════════
// Manual Test: Daily Report Email + Notification
// ═══════════════════════════════════════════════════════════════════════════
// Usage:
//   node src/tests/test-daily-report.js                    → uses default user
//   node src/tests/test-daily-report.js USR003MBONDHU      → specific user
//   node src/tests/test-daily-report.js USR5MBONDHU        → owner user
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Load .env from PROJECT ROOT (not current working directory)
// When running from src/tests/, __dirname = /home/meterbondhu_stg/src/tests
// So ../../.env = /home/meterbondhu_stg/.env
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const { pool } = require('../config/database');
const dailyReportService = require('../services/dailyReportService');

// ─── Default test user (change if needed) ──────────────────────────────
const DEFAULT_M_BONDHU_ID = 'USR003MBONDHU';
const TARGET_ID = process.argv[2] || DEFAULT_M_BONDHU_ID;

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
  gray: '\x1b[90m',
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
  console.log(`   ${dim('•')} ${label.padEnd(22)} ${bold(value)}`);

// ═══════════════════════════════════════════════════════════════════════
// ─── MAIN TEST ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  const startedAt = Date.now();

  header(`🧪 Daily Report Test — ${TARGET_ID}`);

  // ─── Verify EMAIL env vars are loaded ─────────────────────────────
  console.log(`${dim('Environment check:')}`);
  console.log(`   ${dim('•')} EMAIL_HOST   = ${process.env.EMAIL_HOST || red('(missing)')}`);
  console.log(`   ${dim('•')} EMAIL_PORT   = ${process.env.EMAIL_PORT || red('(missing)')}`);
  console.log(`   ${dim('•')} EMAIL_USER   = ${process.env.EMAIL_USER || red('(missing)')}`);
  console.log(`   ${dim('•')} EMAIL_PASS   = ${process.env.EMAIL_PASS ? green('***set***') : red('(missing)')}`);
  console.log(`   ${dim('•')} EMAIL_FROM   = ${process.env.EMAIL_FROM || red('(missing)')}`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n${red(bold('❌ EMAIL_USER or EMAIL_PASS missing from .env'))}`);
    console.log(`${yellow('Add these to your .env file:')}`);
    console.log(`   EMAIL_USER=your_email@gmail.com`);
    console.log(`   EMAIL_PASS=your_16_char_app_password`);
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
    info('Low Balance Threshold', `৳${user.low_balance_alert_threshold || 0}`);

    // ─── Enable flags check ──────────────────────────────────────────
    if (!user.daily_report_enabled) {
      console.log(`\n   ${red('⚠️  daily_report_enabled = FALSE')}`);
      console.log(`   ${yellow('Run this SQL to enable:')}`);
      console.log(`   ${dim(`UPDATE user_info SET daily_report_enabled = true WHERE m_bondhu_id = '${TARGET_ID}';`)}`);
      process.exit(1);
    }
    ok('daily_report_enabled = true');

    if (!user.email_notification_enabled) {
      console.log(`\n   ${red('⚠️  email_notification_enabled = FALSE')}`);
      console.log(`   ${yellow('Run this SQL to enable:')}`);
      console.log(`   ${dim(`UPDATE user_info SET email_notification_enabled = true WHERE m_bondhu_id = '${TARGET_ID}';`)}`);
      process.exit(1);
    }
    ok('email_notification_enabled = true');

    // ═════════════════════════════════════════════════════════════════
    // STEP 2 — Build report data
    // ═════════════════════════════════════════════════════════════════
    step(2, 5, 'Building report data from database...');

    const reportData = await dailyReportService.buildReportData(user);

    ok('Report data built successfully');

    console.log(`\n   ${magenta(bold('📊 YESTERDAY\'S USAGE'))}`);
    info('Taka', `৳${reportData.yesterdayUsageTaka.toFixed(2)}`);
    info('Unit', reportData.hasUnit
      ? `${reportData.yesterdayUsageUnit.toFixed(2)} kWh`
      : dim('(not available — system-B)'));

    console.log(`\n   ${magenta(bold('💰 YESTERDAY\'S RECHARGE'))}`);
    info('Amount', `৳${reportData.yesterdayRechargeTaka.toFixed(2)}`);
    info('Transactions', reportData.yesterdayRechargeCount);

    console.log(`\n   ${magenta(bold('💵 CURRENT BALANCE'))}`);
    info('Balance', `৳${reportData.currentBalance.toFixed(2)}`);
    info('Daily Avg Cost', `৳${reportData.dailyAvgCost.toFixed(2)}`);
    const daysLeft = reportData.dailyAvgCost > 0
      ? Math.floor(reportData.currentBalance / reportData.dailyAvgCost)
      : '—';
    info('Days Left', daysLeft);

    console.log(`\n   ${magenta(bold('📈 THIS MONTH'))}`);
    info('Usage', `৳${reportData.monthUsageTaka.toFixed(2)}${reportData.hasUnit ? ` (${reportData.monthUsageUnit.toFixed(2)} kWh)` : ''}`);
    info('Recharge', `৳${reportData.monthRechargeTaka.toFixed(2)}`);

    console.log(`\n   ${magenta(bold('📊 LAST 7 DAYS'))}`);
    if (reportData.last7Days.length === 0) {
      console.log(`   ${dim('   (no records)')}`);
    } else {
      reportData.last7Days.forEach((d) => {
        const tag = d.isYesterday ? `${cyan(bold(' ← YESTERDAY'))}` : '';
        console.log(`   ${dim('•')} ${d.date.padEnd(12)} ৳${d.taka.toFixed(2).padStart(8)}${d.unit > 0 ? `  (${d.unit.toFixed(2)} kWh)` : ''}${tag}`);
      });
    }

    console.log(`\n   ${magenta(bold('🏔️  HIGHEST PEAK (last 30 days)'))}`);
    if (reportData.highestPeak) {
      const hp = reportData.highestPeak;
      const tag = hp.isYesterday ? ` ${yellow(bold('← YES, YESTERDAY WAS THE PEAK!'))}` : '';
      info('Peak', `৳${hp.taka.toFixed(2)} on ${hp.date}${tag}`);
    } else {
      console.log(`   ${dim('   (no peak data)')}`);
    }

    console.log(`\n   ${magenta(bold('⚙️  SYSTEM INFO'))}`);
    info('Has Unit Data', reportData.hasUnit ? '✅ yes' : '❌ no');
    info('Is System-B', reportData.isSystemB ? '✅ yes' : '❌ no');

    // ═════════════════════════════════════════════════════════════════
    // STEP 3 — Send report (email + notification)
    // ═════════════════════════════════════════════════════════════════
    step(3, 5, 'Sending report (email + notification)...');

    const sendResult = await dailyReportService.sendDailyReportForUser(user);

    if (sendResult.success) {
      ok('Report sent successfully');
    } else {
      fail(`Report failed: ${sendResult.message || 'unknown error'}`);
      exitCode = 1;
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 4 — Verify notification in DB
    // ═════════════════════════════════════════════════════════════════
    step(4, 5, 'Verifying notification in database...');

    await new Promise((r) => setTimeout(r, 500)); // allow DB commit

    const notifResult = await pool.query(
      `SELECT notification_id, title, message, created_at, is_sent
       FROM user_notifications 
       WHERE m_bondhu_id = $1 
         AND notification_type = 'daily_report'
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
    console.log(`   ${bold('Email:')}              ${user.email}`);
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