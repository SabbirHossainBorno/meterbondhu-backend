// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const meterRoutes = require('./routes/meterRoutes');
const descoRoutes = require('./routes/descoRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const alertRoutes = require('./routes/alertRoutes');
const rechargeRoutes = require('./routes/rechargeRoutes');
const pushRoutes = require('./routes/pushRoutes');
const meterManagementRoutes = require('./routes/meterManagementRoutes');
const profileRoutes = require('./routes/profileRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');

const app = express();

// ═══════════════════════════════════════════════════════════════════════════
// ─── Environment Detection ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// ═══════════════════════════════════════════════════════════════════════════
// ─── Security middleware ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
app.use(helmet());
app.use(cors());

// ═══════════════════════════════════════════════════════════════════════════
// ─── Rate Limiting — Environment Based ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// Development: very high limit (or skip for localhost)
// Staging:     medium limit
// Production:  strict limit
// ═══════════════════════════════════════════════════════════════════════════

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 300 : 10000, // Dev: 10000, Prod: 300
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    errorType: 'RATE_LIMIT',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // ✅ In development, skip rate limiting for localhost
  skip: (req) => {
    if (!isProduction) {
      const ip = req.ip || req.connection?.remoteAddress || '';
      // Skip for local IPs
      return (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1' ||
        ip.includes('localhost')
      );
    }
    return false;
  },
});

// Apply rate limiting to all API routes
app.use('/api', limiter);

// ═══════════════════════════════════════════════════════════════════════════
// ─── Auth Endpoints — Stricter Rate Limiting (Security) ─────────────────
// ═══════════════════════════════════════════════════════════════════════════
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 10 : 500, // Dev: 500, Prod: 10
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    errorType: 'AUTH_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip in dev
  skip: (req) => !isProduction,
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── Body parser ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ═══════════════════════════════════════════════════════════════════════════
// ─── Request logging ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── Routes ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Auth routes (with stricter limiter in production)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);

app.use('/api/meters', meterRoutes);
app.use('/api/desco', descoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/meter-management', meterManagementRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/feedback', feedbackRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// ─── Health check ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── Error handler ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
app.use(errorHandler);

module.exports = app;