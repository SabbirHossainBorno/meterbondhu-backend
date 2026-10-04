// src/routes/pushRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pushController = require('../controllers/pushController');

router.post('/register', auth, pushController.registerToken);
router.post('/unregister', auth, pushController.unregisterToken);
router.post('/test', auth, pushController.sendTestPush);

module.exports = router;