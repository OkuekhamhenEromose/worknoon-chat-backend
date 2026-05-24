/**
 * JWT Utility
 * Handles access token + refresh token generation/verification
 */

const jwt = require('jsonwebtoken');

const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN,
} = process.env;

/**
 * Generate a short-lived access token
 * @param {Object} payload - { id, role }
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN || '15m',
    issuer: 'worknoon-chat',
    audience: 'worknoon-client',
  });
}

/**
 * Generate a long-lived refresh token
 * @param {Object} payload - { id }
 */
function generateRefreshToken(payload) {
  return jwt.sign({ id: payload.id }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'worknoon-chat',
    audience: 'worknoon-client',
  });
}

/**
 * Verify an access token
 * @param {string} token
 * @returns decoded payload or throws
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'worknoon-chat',
    audience: 'worknoon-client',
  });
}

/**
 * Verify a refresh token
 * @param {string} token
 * @returns decoded payload or throws
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET, {
    issuer: 'worknoon-chat',
    audience: 'worknoon-client',
  });
}

/**
 * Set refresh token as HttpOnly cookie
 */
function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

/**
 * Clear the refresh token cookie
 */
function clearRefreshTokenCookie(res) {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0),
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
