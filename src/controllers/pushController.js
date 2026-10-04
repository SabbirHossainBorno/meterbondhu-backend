// src/controllers/pushController.js
const pushService = require('../services/pushService');

exports.registerToken = async (req, res) => {
  try {
    const { pushToken, deviceInfo } = req.body;
    const mBondhuId = req.user.m_bondhu_id;
    
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'pushToken required' });
    }
    
    const result = await pushService.registerToken(mBondhuId, pushToken, deviceInfo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.unregisterToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    const result = await pushService.unregisterToken(req.user.m_bondhu_id, pushToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendTestPush = async (req, res) => {
  try {
    const sent = await pushService.sendPushNotification(req.user, {
      title: '🧪 Test Push',
      body: 'This is a test push from MeterBondhu!',
      data: { type: 'test' }
    });
    res.json({ success: sent, message: sent ? 'Sent' : 'Failed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};