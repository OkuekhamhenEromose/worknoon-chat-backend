/**
 * Validation Middleware
 * Runs express-validator results and returns 400 on errors
 */

const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/apiResponse');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(ApiError.badRequest('Validation failed', formatted));
  }
  next();
};

module.exports = validate;
