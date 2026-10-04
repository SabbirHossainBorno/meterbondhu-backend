// src/services/pushService.js
const { Expo } = require('expo-server-sdk');
const { pool } = require('../config/database');

class PushService {
  constructor() {
    this.expo = new Expo();
  }

  // ─── Register Push Token ──────────────────────────────────────────────
  async registerToken(mBondhuId, pushToken, deviceInfo = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PushService] 📝 Registering token for ${mBondhuId}`);
    
    try {
      if (!Expo.isExpoPushToken(pushToken)) {
        return { success: false, message: 'Invalid push token' };
      }

      const query = `
        INSERT INTO user_push_tokens (
          m_bondhu_id, push_token, device_type, device_name, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (m_bondhu_id, push_token) 
        DO UPDATE SET 
          is_active = true,
          device_type = EXCLUDED.device_type,
          device_name = EXCLUDED.device_name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const values = [
        mBondhuId,
        pushToken,
        deviceInfo.deviceType || 'unknown',
        deviceInfo.deviceName || 'Unknown',
      ];
      
      const result = await pool.query(query, values);
      console.log(`[${timestamp}] [PushService] ✅ Token registered`);
      
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error(`[${timestamp}] [PushService] ❌ Error:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // ─── Unregister Push Token ────────────────────────────────────────────
  async unregisterToken(mBondhuId, pushToken) {
    try {
      await pool.query(
        `UPDATE user_push_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE m_bondhu_id = $1 AND push_token = $2`,
        [mBondhuId, pushToken]
      );
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ─── Get User Push Tokens ────────────────────────────────────────────
  async getUserTokens(mBondhuId) {
    try {
      const result = await pool.query(
        `SELECT push_token FROM user_push_tokens 
         WHERE m_bondhu_id = $1 AND is_active = true`,
        [mBondhuId]
      );
      return result.rows.map(row => row.push_token);
    } catch (error) {
      return [];
    }
  }

  // ─── Send Push Notification ──────────────────────────────────────────
  async sendPushNotification(user, notification) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PushService] 📱 Sending to ${user.m_bondhu_id}`);
    
    try {
      const pushTokens = await this.getUserTokens(user.m_bondhu_id);
      
      if (pushTokens.length === 0) {
        console.log(`[${timestamp}] [PushService] ⚠️ No active tokens`);
        return false;
      }
      
      const messages = [];
      for (const pushToken of pushTokens) {
        if (!Expo.isExpoPushToken(pushToken)) continue;
        
        messages.push({
          to: pushToken,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: notification.data?.type === 'critical_alert' ? 'high' : 'default',
          channelId: notification.data?.type === 'critical_alert' ? 'critical-alerts' : 'default',
        });
      }
      
      if (messages.length === 0) return false;
      
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];
      
      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (chunkError) {
          console.error(`[${timestamp}] [PushService] ❌ Chunk error:`, chunkError.message);
        }
      }
      
      console.log(`[${timestamp}] [PushService] ✅ Sent to ${user.m_bondhu_id}`);
      return tickets.length > 0;
    } catch (error) {
      console.error(`[${timestamp}] [PushService] ❌ Error:`, error.message);
      return false;
    }
  }
}

module.exports = new PushService();