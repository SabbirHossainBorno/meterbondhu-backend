// src/services/telegramService.js
const axios = require('axios');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
  }

  // ─── Send Message to Telegram ────────────────────────────────────────────
  async sendMessage(message, chatId = null) {
    const targetChatId = chatId || this.chatId;
    
    if (!this.botToken) {
      console.warn('⚠️ Telegram bot token not configured');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: targetChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      console.log('✅ Telegram message sent');
      return true;
    } catch (error) {
      console.error('❌ Telegram send error:', error.message);
      return false;
    }
  }

  // ─── Send New User Notification ──────────────────────────────────────────
  async sendNewUserNotification(user) {
    const message = `
👤 <b>New User Registered!</b>

📋 <b>Name:</b> ${user.full_name}
📧 <b>Email:</b> ${user.email}
📱 <b>Mobile:</b> ${user.mobile}
🏷️ <b>Type:</b> ${user.user_type === 'owner' ? '🏠 Landlord' : '👤 Tenant'}
🔢 <b>Account:</b> ${user.account_no}
🔢 <b>Meter:</b> ${user.meter_no}
🆔 <b>ID:</b> ${user.m_bondhu_id}

📅 <b>Registered:</b> ${new Date().toLocaleString()}
    `;
    
    return this.sendMessage(message);
  }

  // ─── Send Alert Notification ─────────────────────────────────────────────
  async sendAlertNotification(user, alertData) {
    const message = `
⚡ <b>${alertData.title}</b>

${alertData.message}

👤 <b>User:</b> ${user.full_name}
📋 <b>Account:</b> ${user.account_no}
🔢 <b>Meter:</b> ${user.meter_no}
${alertData.balance ? `💰 <b>Balance:</b> ${alertData.balance}` : ''}
${alertData.consumption ? `⚡ <b>Consumption:</b> ${alertData.consumption} kWh` : ''}

📅 <b>Time:</b> ${new Date().toLocaleString()}
    `;
    
    return this.sendMessage(message);
  }

  // ─── Send Daily Report ────────────────────────────────────────────────────
  async sendDailyReport(user, reportData) {
    const message = `
📊 <b>Daily Report - ${new Date().toLocaleDateString()}</b>

👤 <b>User:</b> ${user.full_name}
📋 <b>Account:</b> ${user.account_no}
🔢 <b>Meter:</b> ${user.meter_no}

💰 <b>Balance:</b> ৳${reportData.balance}
⚡ <b>Today's Usage:</b> ${reportData.dailyUsage || 0} kWh
📊 <b>Monthly Usage:</b> ${reportData.monthlyUsage || 0} kWh

📈 <b>Status:</b> ${reportData.balance > 500 ? '✅ Healthy' : reportData.balance > 100 ? '⚠️ Low' : '🔴 Critical'}

📅 ${new Date().toLocaleString()}
    `;
    
    return this.sendMessage(message);
  }

  // ─── Send Error Notification ─────────────────────────────────────────────
  async sendErrorNotification(error, context = '') {
    const message = `
❌ <b>System Error!</b>

📝 <b>Error:</b> ${error.message}
${context ? `📂 <b>Context:</b> ${context}` : ''}
📅 <b>Time:</b> ${new Date().toLocaleString()}

Stack:
<code>${error.stack || 'No stack trace'}</code>
    `;
    
    return this.sendMessage(message);
  }
}

module.exports = new TelegramService();