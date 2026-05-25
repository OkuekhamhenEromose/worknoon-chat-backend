/**
 * JWT Utility
 * Handles access token + refresh token generation/verification
 */

const jwt = require('jsonwebtoken');

/**
 * Generate a short-lived access token
 * @param {Object} payload - { id, role }
 */
function generateAccessToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined in environment variables');
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    issuer: 'worknoon-chat',
    audience: 'worknoon-client',
  });
}

/**
 * Generate a long-lived refresh token
 * @param {Object} payload - { id }
 */
function generateRefreshToken(payload) {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  return jwt.sign({ id: payload.id }, secret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
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
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined in environment variables');
  return jwt.verify(token, secret, {
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
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  return jwt.verify(token, secret, {
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
    maxAge: 7 * 24 * 60 * 60 * 1000,
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