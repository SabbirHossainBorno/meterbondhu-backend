// src/mocks/mockDataFactory.js
// ═══════════════════════════════════════════════════════════════════════
// Test Data Factory
// ═══════════════════════════════════════════════════════════════════════

class MockDataFactory {
  createRecharge(amount, options = {}) {
    const energyPct = options.energyPercentage || 0.803;
    return {
      seqNo: options.seqNo || `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`,
      orderID: options.orderID || `TEST_ORDER_${Date.now()}`,
      totalAmount: amount,
      energyAmount: parseFloat((amount * energyPct).toFixed(2)),
      chargeAmount: 0,
      rechargeDate: options.date || new Date().toISOString(),
      rechargeOperator: 'DESCO',
      orderStatus: options.status || 'Execution Successful',
      tokenNo: options.tokenNo || `TEST_TOKEN_${Date.now()}`,
      VAT: 0,
      rebate: 0,
    };
  }

  // ─── Test Scenarios ────────────────────────────────────────────
  scenarios() {
    return {
      // Scenario 1: বড় recharge → Projected > Threshold → Alert OFF
      'S1: Big Recharge (৳1000)': {
        balance: 150,
        dailyAvg: 50,
        threshold: 400, // আপনার actual threshold
        recharges: [1000],
        expected: {
          projectedBalance: 150 + (1000 * 0.803) - 50, // ৳903
          alertShouldSend: false,
        }
      },

      // Scenario 2: ছোট recharge → Projected < Threshold → Alert ON
      'S2: Small Recharge (৳100)': {
        balance: 150,
        dailyAvg: 50,
        threshold: 400,
        recharges: [100],
        expected: {
          projectedBalance: 150 + (100 * 0.803) - 50, // ৳180.30
          alertShouldSend: true,
        }
      },

      // Scenario 3: Multiple recharges → Combined
      'S3: Multiple Recharges (৳200+৳300)': {
        balance: 150,
        dailyAvg: 50,
        threshold: 400,
        recharges: [200, 300],
        expected: {
          projectedBalance: 150 + (500 * 0.803) - 50, // ৳501.50
          alertShouldSend: false,
        }
      },

      // Scenario 4: recharge নেই → Alert ON
      'S4: No Recharge Today': {
        balance: 150,
        dailyAvg: 50,
        threshold: 400,
        recharges: [],
        expected: {
          projectedBalance: 150 - 50, // ৳100
          alertShouldSend: true,
        }
      },

      // Scenario 5: Multiple small recharges still below threshold
      'S5: Multiple Small (৳100+৳100)': {
        balance: 150,
        dailyAvg: 50,
        threshold: 400,
        recharges: [100, 100],
        expected: {
          projectedBalance: 150 + (200 * 0.803) - 50, // ৳260.60
          alertShouldSend: true,
        }
      },
    };
  }
}

module.exports = new MockDataFactory();