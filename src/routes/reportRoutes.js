const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/daily', auth, async (req, res) => {
  res.json({ success: true, message: 'Daily reports coming soon' });
});

router.get('/monthly', auth, async (req, res) => {
  res.json({ success: true, message: 'Monthly reports coming soon' });
});

module.exports = router;
