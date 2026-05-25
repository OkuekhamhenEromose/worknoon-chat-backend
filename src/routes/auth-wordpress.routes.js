/**
 * WordPress SSO Authentication Route
 * POST /api/auth/wordpress-sso
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const logger  = require('../utils/logger');
const { ApiResponse, ApiError } = require('../utils/apiResponse');

// ─── Middleware: verify WordPress shared secret ───────────────────────────────
const verifyWordPressSecret = (req, res, next) => {
  const secret   = process.env.WORDPRESS_SECRET || process.env.WORKNOON_CHAT_API_SECRET || '';
  const provided = req.headers['x-worknoon-secret'] || '';
  if (secret && secret !== provided) {
    return next(ApiError.forbidden('Invalid WordPress secret'));
  }
  next();
};

// ─── POST /api/auth/wordpress-sso ────────────────────────────────────────────
// Called by WordPress after a user logs in — creates/updates user and returns a JWT
router.post('/wordpress-sso', verifyWordPressSecret, async (req, res, next) => {
  try {
    const {
      wpUserId,
      email,
      name,
      role        = 'buyer',
      avatarUrl,
    } = req.body;

    if (!wpUserId || !email) {
      return next(ApiError.badRequest('wpUserId and email are required'));
    }

    logger.info(`WordPress SSO: user ${email} (wpId: ${wpUserId})`);

    // Upsert the user — create on first login, update on subsequent logins
    const user = await User.findOneAndUpdate(
      { $or: [{ wpUserId: String(wpUserId) }, { email }] },
      {
        $set: {
          wpUserId:  String(wpUserId),
          email,
          name:      name  || email.split('@')[0],
          role,
          avatarUrl: avatarUrl || '',
          isActive:  true,
        },
        $setOnInsert: {
          password: crypto.randomBytes(32).toString('hex'), // unusable random password
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Issue a JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return ApiResponse.success(res, {
      token,
      user: {
        id:        user._id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        avatarUrl: user.avatarUrl,
      },
    }, 'WordPress SSO successful');

  } catch (err) {
    next(err);
  }
});

module.exports = router;