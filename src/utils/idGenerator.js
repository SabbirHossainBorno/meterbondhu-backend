// src/utils/idGenerator.js
// ═══════════════════════════════════════════════════════════════════════════
// ID Generator — No padding, direct serial
// ═══════════════════════════════════════════════════════════════════════════
//
// Format examples:
//   generateMBondhuId(1)              → USR1MBONDHU
//   generateMeterId(5)                → MET5MBONDHU
//   generateConsumptionId(1)          → DLY1MBONDHU
//   generateMonthlyConsumptionId(42)  → MTH42MBONDHU
//   generateRechargeId(1234)          → RCH1234MBONDHU
//   generateNotificationId(10)        → NOT10MBONDHU
//   generateReportId(99)              → RPT99MBONDHU
//   generateAlertId(500)              → ALT500MBONDHU
// ═══════════════════════════════════════════════════════════════════════════

class IDGenerator {
  // ─── User ID ──────────────────────────────────────────────────────────
  static generateMBondhuId(serial) {
    return `USR${serial}MBONDHU`;
  }

  // ─── Meter ID ─────────────────────────────────────────────────────────
  static generateMeterId(serial) {
    return `MET${serial}MBONDHU`;
  }

  // ─── Daily Consumption ID ─────────────────────────────────────────────
  static generateConsumptionId(serial) {
    return `DLY${serial}MBONDHU`;
  }

  // ─── Monthly Consumption ID ───────────────────────────────────────────
  static generateMonthlyConsumptionId(serial) {
    return `MTH${serial}MBONDHU`;
  }

  // ─── Recharge ID ──────────────────────────────────────────────────────
  static generateRechargeId(serial) {
    return `RCH${serial}MBONDHU`;
  }

  // ─── Notification ID ──────────────────────────────────────────────────
  static generateNotificationId(serial) {
    return `NOT${serial}MBONDHU`;
  }

  // ─── Report ID ────────────────────────────────────────────────────────
  static generateReportId(serial) {
    return `RPT${serial}MBONDHU`;
  }

  // ─── Alert ID ─────────────────────────────────────────────────────────
  static generateAlertId(serial) {
    return `ALT${serial}MBONDHU`;
  }

// ─── Feedback ID ─────────────────────────────────────────────────────
  static generateFeedbackId(serial) {
    return `FEDBK${serial}MBONDHU`;
  }
}

module.exports = IDGenerator;