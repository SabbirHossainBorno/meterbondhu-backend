// src/mocks/mockDescoService.js
// ═══════════════════════════════════════════════════════════════════════
// DESCO API Mock - Real recharge ছাড়াই test করার জন্য
// ═══════════════════════════════════════════════════════════════════════

class MockDescoService {
  constructor() {
    this.state = {
      balance: 150.00,
      dailyAvgCost: 50.00,
      energyPercentage: 0.803,
      rechargeHistory: [],
      dailyConsumption: this.generateDailyConsumption(),
      monthlyConsumption: this.generateMonthlyConsumption(),
      shouldFailBalance: false,
      shouldFailRecharge: false,
      apiDelay: 0,
    };
    this.verbose = true;
    this._originals = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  setBalance(amount) {
    this.state.balance = amount;
    this.log(`💰 Balance set to ৳${amount}`);
  }

  setDailyAvgCost(amount) {
    this.state.dailyAvgCost = amount;
    this.log(`📊 Daily Avg set to ৳${amount}`);
  }

  setEnergyPercentage(pct) {
    this.state.energyPercentage = pct;
    this.log(`⚡ Energy % set to ${(pct * 100).toFixed(1)}%`);
  }

  addRecharge(amount, options = {}) {
  // ✅ আজকের date (local timezone এ)
  const now = new Date();
  // Server timezone এ আজকের date string
  const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  const todayString = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayFullISO = `${todayString}T${now.toTimeString().split(' ')[0]}`;

  const recharge = {
    seqNo: options.seqNo || `MOCK${Date.now()}${Math.floor(Math.random() * 1000)}`,
    orderID: options.orderID || `MOCK_ORDER_${Date.now()}`,
    totalAmount: amount,
    energyAmount: parseFloat((amount * this.state.energyPercentage).toFixed(2)),
    chargeAmount: 0,
    // ✅ Force today's date
    rechargeDate: options.date || todayFullISO,
    rechargeOperator: 'DESCO',
    orderStatus: options.status || 'Execution Successful',
    tokenNo: options.tokenNo || `MOCK_TOKEN_${Date.now()}`,
    VAT: 0,
    rebate: 0,
  };
  this.state.rechargeHistory.unshift(recharge);
  this.log(`➕ Recharge added: ৳${amount} (Seq: ${recharge.seqNo}) [${recharge.rechargeDate}]`);
  return recharge;
}

  clearRecharges() {
    this.state.rechargeHistory = [];
    this.log(`🧹 Recharge history cleared`);
  }

  reset() {
    this.state = {
      balance: 150.00,
      dailyAvgCost: 50.00,
      energyPercentage: 0.803,
      rechargeHistory: [],
      dailyConsumption: this.generateDailyConsumption(),
      monthlyConsumption: this.generateMonthlyConsumption(),
      shouldFailBalance: false,
      shouldFailRecharge: false,
      apiDelay: 0,
    };
    this.log(`🔄 Mock state reset`);
  }

  // ═══════════════════════════════════════════════════════════════
  // MOCK DATA GENERATORS
  // ═══════════════════════════════════════════════════════════════

  generateDailyConsumption() {
    const data = [];
    const today = new Date();
    let cumulative = 0;

    for (let i = 7; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dailyCost = 40 + Math.random() * 20;
      cumulative += dailyCost;
      data.push({
        date: date.toISOString().split('T')[0],
        consumedTaka: parseFloat(cumulative.toFixed(2)),
        consumedUnit: parseFloat((cumulative / 9.5).toFixed(2)),
      });
    }
    return data;
  }

  generateMonthlyConsumption() {
    // আপনার actual data থেকে (avg ৳1500/month)
    return [
      { month: '2026-07', consumedTaka: 1450, consumedUnit: 155 },
      { month: '2026-08', consumedTaka: 1520, consumedUnit: 162 },
      { month: '2026-09', consumedTaka: 1593, consumedUnit: 170 },
    ];
  }

  // ═══════════════════════════════════════════════════════════════
  // MOCK API METHODS (Real signature same)
  // ═══════════════════════════════════════════════════════════════

  async getBalance(accountNo, meterNo) {
    await this.delay();
    this.log(`🌐 [MOCK] getBalance(${accountNo}, ${meterNo})`);
    if (this.state.shouldFailBalance) {
      throw new Error('Mock: Balance API failed');
    }
    return {
      success: true,
      data: { balance: this.state.balance, accountNo, meterNo }
    };
  }

  async getRechargeHistory(accountNo, meterNo, dateFrom, dateTo) {
    await this.delay();
    this.log(`🌐 [MOCK] getRechargeHistory(${dateFrom} → ${dateTo})`);
    this.log(`   → Returning ${this.state.rechargeHistory.length} recharges`);
    if (this.state.shouldFailRecharge) {
      throw new Error('Mock: Recharge API failed');
    }
    return {
      code: 200,
      data: [...this.state.rechargeHistory],
    };
  }

  async getDailyConsumption(accountNo, meterNo, dateFrom, dateTo) {
    await this.delay();
    this.log(`🌐 [MOCK] getDailyConsumption(${dateFrom} → ${dateTo})`);
    return { success: true, data: [...this.state.dailyConsumption] };
  }

  async getMonthlyConsumption(accountNo, meterNo, monthFrom, monthTo) {
    await this.delay();
    this.log(`🌐 [MOCK] getMonthlyConsumption(${monthFrom} → ${monthTo})`);
    return { success: true, data: [...this.state.monthlyConsumption] };
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════

  async delay() {
    if (this.state.apiDelay > 0) {
      await new Promise(r => setTimeout(r, this.state.apiDelay));
    }
  }

  log(msg) {
    if (this.verbose) {
      const ts = new Date().toISOString();
      console.log(`[${ts}] ${msg}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH / RESTORE REAL SERVICE
  // ═══════════════════════════════════════════════════════════════

  patchRealService(DescoService) {
    this.log('🔧 Patching real DescoService with mocks...');
    this._originals = {
      getBalance: DescoService.getBalance,
      getRechargeHistory: DescoService.getRechargeHistory,
      getDailyConsumption: DescoService.getDailyConsumption,
      getMonthlyConsumption: DescoService.getMonthlyConsumption,
    };
    DescoService.getBalance = this.getBalance.bind(this);
    DescoService.getRechargeHistory = this.getRechargeHistory.bind(this);
    DescoService.getDailyConsumption = this.getDailyConsumption.bind(this);
    DescoService.getMonthlyConsumption = this.getMonthlyConsumption.bind(this);
    this.log('✅ DescoService patched');
  }

  restoreRealService(DescoService) {
    if (!this._originals) return;
    this.log('🔧 Restoring real DescoService...');
    DescoService.getBalance = this._originals.getBalance;
    DescoService.getRechargeHistory = this._originals.getRechargeHistory;
    DescoService.getDailyConsumption = this._originals.getDailyConsumption;
    DescoService.getMonthlyConsumption = this._originals.getMonthlyConsumption;
    this.log('✅ DescoService restored');
  }
}

module.exports = new MockDescoService();