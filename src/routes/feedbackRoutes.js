// src/routes/feedbackRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const feedbackController = require('../controllers/feedbackController');

router.post('/submit', auth, feedbackController.submitFeedback);
router.get('/my', auth, feedbackController.getMyFeedback);

module.exports = router;