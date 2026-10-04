// src/services/descoService.js
const axios = require('axios');
const https = require('https');

const DESCO_API_URL = process.env.DESCO_API_URL || 'https://prepaid.desco.org.bd';

// Create axios instance with SSL bypass for DESCO API
const descoAxios = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 60000,
});

class DescoService {
  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Helper: Handle Single Response ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static handleResponse(response, apiName) {
    console.log(`📥 ${apiName} response status:`, response.status);
    console.log(`📥 ${apiName} response data:`, JSON.stringify(response.data, null, 2));

    if (!response.data) {
      throw new Error(`No data received from ${apiName}`);
    }

    if (response.data && response.data.code === 200) {
      return response.data.data;
    }

    if (response.data && response.data.desc) {
      throw new Error(response.data.desc);
    }

    if (response.data && response.data.balance !== undefined) {
      return response.data;
    }
    if (response.data && response.data.data) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }

    console.error(`⚠️ Unexpected response format from ${apiName}:`, JSON.stringify(response.data, null, 2));
    throw new Error(`Unexpected response format from ${apiName}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Helper: Handle Errors ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static handleError(error, apiName) {
    console.error(`❌ DESCO API Error (${apiName}):`, error.message);

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      console.error(`📊 Response status: ${status}`);
      console.error(`📊 Response data:`, data);

      if (data && data.desc) throw new Error(data.desc);
      if (data && data.message) throw new Error(data.message);

      if (status === 404) throw new Error('Meter or Customer Number Does not Exists');
      if (status === 401 || status === 403) throw new Error('Authentication failed. Please try again later.');
      if (status === 429) throw new Error('Too many requests. Please try again later.');
      if (status >= 500) throw new Error('DESCO server is currently unavailable. Please try again later.');

      throw new Error(`Server error: ${status}`);
    } else if (error.request) {
      console.error('❌ No response received from DESCO server');
      throw new Error('Network error - No response from DESCO server');
    } else {
      console.error('❌ Request setup error:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Helper: Is Response Valid? ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // DESCO can return:
  //   - code 200 + valid data  → SUCCESS
  //   - code 200 + null data   → EMPTY (this system has no account here)
  //   - code 16001/16002       → Account not found in this system
  //   - HTTP error             → Network / server issue
  // ═══════════════════════════════════════════════════════════════════════════
  static isResponseValid(response) {
    if (!response.data) return { valid: false, reason: 'No response data' };

    if (response.data.code !== 200) {
      return {
        valid: false,
        reason: `code ${response.data.code}: ${response.data.desc || 'unknown error'}`,
      };
    }

    const data = response.data.data;

    if (data === null || data === undefined) {
      return { valid: false, reason: 'code 200 but data is null/undefined' };
    }

    if (Array.isArray(data) && data.length === 0) {
      return { valid: false, reason: 'code 200 but data is empty array' };
    }

    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Helper: FALLBACK REQUEST PATTERN ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // DESCO has TWO separate backend systems:
  //   - System A: /api/unified/customer/*  (legacy accounts)
  //   - System B: /api/tkdes/customer/*    (alternative accounts)
  //
  // An account exists in ONLY ONE of them. We don't know which in advance.
  //
  // Strategy:
  //   1. Try System A (unified)  → if valid, return
  //   2. Try System B (tkdes)    → if valid, return
  //   3. If both fail, throw the last error
  //
  // Note: System A can return code 200 with null data for accounts that
  // belong to System B, so we validate data presence, not just code.
  // ═══════════════════════════════════════════════════════════════════════════
  static async fetchWithFallback(endpoint, apiName, params) {
    const systems = [
      { key: 'unified', label: 'system-A (unified)' },
      { key: 'tkdes',   label: 'system-B (tkdes)' },
    ];

    let lastError = null;

    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`🌐 [${apiName}] Fallback fetch:`, JSON.stringify(params));
    console.log(`═══════════════════════════════════════════════════════════════`);

    for (const sys of systems) {
      const url = `${DESCO_API_URL}/api/${sys.key}/customer/${endpoint}`;
      console.log(`\n🔎 [${apiName}] [${sys.label}] → ${url}`);

      try {
        const response = await descoAxios.get(url, { params });

        console.log(`📥 [${apiName}] [${sys.label}] HTTP ${response.status}`);
        console.log(
          `📥 [${apiName}] [${sys.label}] response:`,
          JSON.stringify(response.data, null, 2)
        );

        const check = this.isResponseValid(response);

        if (check.valid) {
          console.log(`✅ [${apiName}] [${sys.label}] VALID — returning data`);
          return this.handleResponse(response, `${apiName} (${sys.label})`);
        }

        console.log(`⚠️ [${apiName}] [${sys.label}] INVALID — ${check.reason}`);
        lastError = new Error(check.reason);
      } catch (err) {
        console.error(`❌ [${apiName}] [${sys.label}] REQUEST FAILED:`, err.message);
        lastError = err;
      }
    }

    console.error(`\n❌ [${apiName}] ALL systems failed. Last error: ${lastError?.message}`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    throw lastError || new Error(`All DESCO endpoints failed for ${apiName}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── API 01: Get Customer Information ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static async getCustomerInfo(accountNo, meterNo = '') {
    console.log(`\n🌐 [getCustomerInfo] accountNo=${accountNo}, meterNo=${meterNo}`);
    return this.fetchWithFallback('getCustomerInfo', 'getCustomerInfo', { accountNo, meterNo });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── API 02: Get Current Balance ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static async getBalance(accountNo, meterNo) {
    console.log(`\n🌐 [getBalance] accountNo=${accountNo}, meterNo=${meterNo}`);
    return this.fetchWithFallback('getBalance', 'getBalance', { accountNo, meterNo });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── API 03: Get Daily Consumption ─────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static async getDailyConsumption(accountNo, meterNo, dateFrom, dateTo) {
    console.log(`\n🌐 [getDailyConsumption] ${accountNo}, ${meterNo}, ${dateFrom} → ${dateTo}`);
    return this.fetchWithFallback(
      'getCustomerDailyConsumption',
      'getDailyConsumption',
      { accountNo, meterNo, dateFrom, dateTo }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── API 04: Get Monthly Consumption ───────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static async getMonthlyConsumption(accountNo, meterNo, monthFrom, monthTo) {
    console.log(`\n🌐 [getMonthlyConsumption] ${accountNo}, ${meterNo}, ${monthFrom} → ${monthTo}`);
    return this.fetchWithFallback(
      'getCustomerMonthlyConsumption',
      'getMonthlyConsumption',
      { accountNo, meterNo, monthFrom, monthTo }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── API 05: Get Recharge History ──────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  static async getRechargeHistory(accountNo, meterNo, dateFrom, dateTo) {
    console.log(`\n🌐 [getRechargeHistory] ${accountNo}, ${meterNo}, ${dateFrom} → ${dateTo}`);
    return this.fetchWithFallback(
      'getRechargeHistory',
      'getRechargeHistory',
      { accountNo, meterNo, dateFrom, dateTo }
    );
  }
}

module.exports = DescoService;