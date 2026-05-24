/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 */

const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiResponse');

// ─── 404 Handler ─────────────────────────────────────────────────────────────
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// ─── Global Error Handler ────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log the error
  if (error.statusCode >= 500) {
    logger.error(`${error.statusCode} — ${error.message}`, { stack: err.stack, path: req.path });
  } else {
    logger.warn(`${error.statusCode} — ${error.message}`, { path: req.path });
  }

  // ── Mongoose: Cast error (bad ObjectId) ──────────────────────────────────
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // ── Mongoose: Duplicate key ───────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = ApiError.conflict(`${field} already exists`);
  }

  // ── Mongoose: Validation error ───────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', errors);
  }

  // ── JWT Errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token expired');
  }

  // ── Multer file upload errors ─────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = ApiError.badRequest('File too large. Maximum size is 10MB.');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = ApiError.badRequest('Unexpected file field.');
  }

  // ── CORS error ────────────────────────────────────────────────────────────
  if (err.message && err.message.startsWith('CORS policy')) {
    error = ApiError.forbidden(err.message);
  }

  const isDev = process.env.NODE_ENV === 'development';

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(error.errors && error.errors.length > 0 && { errors: error.errors }),
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
