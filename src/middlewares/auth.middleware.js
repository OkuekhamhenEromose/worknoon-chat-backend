/**
 * Authentication & Authorization Middleware
 * Protects routes with JWT verification and role-based access control
 */

const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * protect — verifies JWT from Authorization header
 * Attaches req.user to the request
 */
const protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('No token provided — please log in'));
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Token expired — please refresh your session'));
      }
      return next(ApiError.unauthorized('Invalid token'));
    }

    // Check user still exists and is active
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user || !user.isActive) {
      return next(ApiError.unauthorized('User no longer exists or has been deactivated'));
    }

    // Check if password was changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(ApiError.unauthorized('Password recently changed — please log in again'));
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    next(ApiError.internal());
  }
};

/**
 * authorize — RBAC middleware
 * Usage: authorize('admin', 'agent')
 * @param {...string} roles - allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

/**
 * optionalAuth — attaches user if token is present, but does not block
 * Useful for public endpoints that behave differently when authenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // silently ignore — optional
  }
  next();
};

/**
 * requireOwnerOrAdmin — ensures user can only access their own resource
 * Admins can access anything
 */
const requireOwnerOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();

    const resourceUserId = typeof getResourceUserId === 'function'
      ? await getResourceUserId(req)
      : req.params[getResourceUserId];

    if (!resourceUserId || resourceUserId.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden('You can only access your own resources'));
    }
    next();
  };
};

module.exports = { protect, authorize, optionalAuth, requireOwnerOrAdmin };
