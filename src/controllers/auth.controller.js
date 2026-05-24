// /**
//  * Authentication Controller
//  * Handles register, login, logout, refresh token, and profile fetch
//  */

// const User = require('../models/User');
// const {
//   generateAccessToken,
//   generateRefreshToken,
//   verifyRefreshToken,
//   setRefreshTokenCookie,
//   clearRefreshTokenCookie,
// } = require('../utils/jwt');
// const { ApiResponse, ApiError } = require('../utils/apiResponse');
// const { sendWelcomeEmail } = require('../utils/email');
// const logger = require('../utils/logger');

// // ─── Register ─────────────────────────────────────────────────────────────────
// const register = async (req, res, next) => {
//   try {
//     const { name, email, password, role } = req.body;

//     const existing = await User.findOne({ email });
//     if (existing) return next(ApiError.conflict('Email already registered'));

//     // Prevent self-registering as admin
//     const safeRole = role === 'admin' ? 'customer' : (role || 'customer');

//     const user = await User.create({ name, email, password, role: safeRole });

//     // Generate tokens
//     const accessToken = generateAccessToken({ id: user._id, role: user.role });
//     const refreshToken = generateRefreshToken({ id: user._id });

//     // Store hashed refresh token
//     user.refreshToken = refreshToken;
//     await user.save({ validateBeforeSave: false });

//     // Set cookie
//     setRefreshTokenCookie(res, refreshToken);

//     // Send welcome email (fire-and-forget)
//     sendWelcomeEmail({ email: user.email, name: user.name }).catch((err) =>
//       logger.warn('Welcome email failed:', err.message)
//     );

//     logger.info(`New user registered: ${user.email} [${user.role}]`);

//     return ApiResponse.created(res, {
//       accessToken,
//       user: user.toSafeObject(),
//     }, 'Registration successful');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── Login ────────────────────────────────────────────────────────────────────
// const login = async (req, res, next) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email }).select('+password +refreshToken');
//     if (!user || !user.isActive) {
//       return next(ApiError.unauthorized('Invalid credentials'));
//     }

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) return next(ApiError.unauthorized('Invalid credentials'));

//     const accessToken = generateAccessToken({ id: user._id, role: user.role });
//     const refreshToken = generateRefreshToken({ id: user._id });

//     // Update online status + refresh token
//     user.refreshToken = refreshToken;
//     user.isOnline = true;
//     user.lastSeen = new Date();
//     await user.save({ validateBeforeSave: false });

//     setRefreshTokenCookie(res, refreshToken);

//     logger.info(`User logged in: ${user.email}`);

//     return ApiResponse.success(res, {
//       accessToken,
//       user: user.toSafeObject(),
//     }, 'Login successful');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── Logout ───────────────────────────────────────────────────────────────────
// const logout = async (req, res, next) => {
//   try {
//     const user = await User.findById(req.user._id).select('+refreshToken');
//     if (user) {
//       user.refreshToken = undefined;
//       user.isOnline = false;
//       user.lastSeen = new Date();
//       await user.save({ validateBeforeSave: false });
//     }

//     clearRefreshTokenCookie(res);
//     return ApiResponse.success(res, {}, 'Logged out successfully');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── Refresh Token ────────────────────────────────────────────────────────────
// const refreshToken = async (req, res, next) => {
//   try {
//     const token = req.cookies.refreshToken;
//     if (!token) return next(ApiError.unauthorized('No refresh token'));

//     let decoded;
//     try {
//       decoded = verifyRefreshToken(token);
//     } catch {
//       return next(ApiError.unauthorized('Invalid or expired refresh token'));
//     }

//     const user = await User.findById(decoded.id).select('+refreshToken');
//     if (!user || user.refreshToken !== token || !user.isActive) {
//       return next(ApiError.unauthorized('Refresh token revoked or invalid'));
//     }

//     const newAccessToken = generateAccessToken({ id: user._id, role: user.role });
//     const newRefreshToken = generateRefreshToken({ id: user._id });

//     user.refreshToken = newRefreshToken;
//     await user.save({ validateBeforeSave: false });

//     setRefreshTokenCookie(res, newRefreshToken);

//     return ApiResponse.success(res, { accessToken: newAccessToken }, 'Token refreshed');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── Get Current User ─────────────────────────────────────────────────────────
// const getMe = async (req, res, next) => {
//   try {
//     return ApiResponse.success(res, { user: req.user.toSafeObject() });
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = { register, login, logout, refreshToken, getMe };
