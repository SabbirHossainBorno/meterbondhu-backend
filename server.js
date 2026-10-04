// server.js
require('dotenv').config();
const app = require('./src/app');
const alertScheduler = require('./src/scheduler/alertScheduler');
const rechargeScheduler = require('./src/scheduler/rechargeScheduler');
const meterBalanceScheduler = require('./src/scheduler/meterBalanceScheduler');
const dailyConsumptionScheduler = require('./src/scheduler/dailyConsumptionScheduler');
const monthlyConsumptionScheduler = require('./src/scheduler/monthlyConsumptionScheduler');
const dailyReportScheduler = require('./src/scheduler/dailyReportScheduler');
const monthlyReportScheduler = require('./src/scheduler/monthlyReportScheduler');   // ✅ NEW

const PORT = process.env.PORT || 7788;

// ─── Start Server ─────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MeterBondhu Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  
  // ─── Start Alert Scheduler ─────────────────────────────────────────────
  alertScheduler.start();

  // ─── Start Daily Report Scheduler ──────────────────────────────────────
  // Runs daily at 8:00 AM Bangladesh time
  dailyReportScheduler.start();

  // ─── Start Monthly Report Scheduler ────────────────────────────────────
  // Runs on 1st of every month at 8:05 AM Bangladesh time
  monthlyReportScheduler.start();   // ✅ NEW
  
  // ─── Start Recharge Scheduler ──────────────────────────────────────────
  rechargeScheduler.start();
  
  // ─── Start Meter Balance Scheduler ─────────────────────────────────────
  meterBalanceScheduler.start();

  // ─── Start Daily Consumption Scheduler ─────────────────────────────────
  // Runs at 8:05 AM Bangladesh time daily
  dailyConsumptionScheduler.start();

  // ─── Start Monthly Consumption Scheduler ──────────────────────────────
  // Runs on 1st of every month at 8:05 AM Bangladesh time
  monthlyConsumptionScheduler.start();

  // ─── Run initial checks after 30 seconds ────────────────────────────────
  setTimeout(async () => {
    const alertService = require('./src/services/alertService');
    const rechargeService = require('./src/services/rechargeService');
    const meterService = require('./src/services/meterService');
    
    console.log('\n' + '═'.repeat(75));
    console.log('⏰ Running initial checks...');
    console.log('═'.repeat(75));
    
    // 1. Meter balance sync (first)
    console.log('\n💾 Syncing meter balances...');
    try {
      await meterService.syncAllMeters();
    } catch (error) {
      console.error('Meter sync failed:', error.message);
    }
    
    // 2. Alert check
    console.log('\n🚨 Running alert check...');
    try {
      await alertService.checkLowBalanceAlerts();
    } catch (error) {
      console.error('Alert check failed:', error.message);
    }
    
    // 3. Recharge check
    console.log('\n💰 Running recharge check...');
    try {
      await rechargeService.checkAllUsersForNewRecharges();
    } catch (error) {
      console.error('Recharge check failed:', error.message);
    }
    
    console.log('\n' + '═'.repeat(75));
    console.log('✅ Initial checks complete');
    console.log('═'.repeat(75) + '\n');
  }, 30000);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  alertScheduler.stop();
  rechargeScheduler.stop();
  meterBalanceScheduler.stop();
  dailyConsumptionScheduler.stop();
  monthlyConsumptionScheduler.stop();
  dailyReportScheduler.stop();         // ✅ NEW
  monthlyReportScheduler.stop();       // ✅ NEW
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  alertScheduler.stop();
  rechargeScheduler.stop();
  meterBalanceScheduler.stop();
  dailyConsumptionScheduler.stop();
  monthlyConsumptionScheduler.stop();
  dailyReportScheduler.stop();         // ✅ NEW
  monthlyReportScheduler.stop();       // ✅ NEW
  process.exit(0);
});