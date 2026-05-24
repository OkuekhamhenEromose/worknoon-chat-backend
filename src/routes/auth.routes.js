/**
 * Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * POST /api/auth/refresh
 * GET  /api/auth/me
 */

const express = require('express');
const router = express.Router();

const { register, login, logout, refreshToken, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { registerValidator, loginValidator } = require('../validators/auth.validator');
const validate = require('../middlewares/validate');

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/logout', protect, logout);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);

module.exports = router;
