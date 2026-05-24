/**
 * Upload Controller
 * Handles file uploads and returns public URLs
 */

const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const { buildFileUrl } = require('../middlewares/upload.middleware');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── POST /api/uploads/avatar ─────────────────────────────────────────────────
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(ApiError.badRequest('No file uploaded'));

    const filePath = req.file.path;
    const ext = path.extname(req.file.filename);
    const thumbnailName = `thumb_${req.file.filename}`;
    const thumbnailPath = path.join(path.dirname(filePath), thumbnailName);

    // Resize image with Sharp
    await sharp(filePath)
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);

    const avatarUrl = buildFileUrl(req, req.file.filename);
    const thumbnailUrl = buildFileUrl(req, thumbnailName);

    // Update user's profile image
    req.user.profileImage = avatarUrl;
    await req.user.save({ validateBeforeSave: false });

    return ApiResponse.success(res, { avatarUrl, thumbnailUrl }, 'Avatar uploaded');
  } catch (err) {
    logger.error('Avatar upload error:', err);
    next(err);
  }
};

// ─── POST /api/uploads/message-files ──────────────────────────────────────────
const uploadMessageFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(ApiError.badRequest('No files uploaded'));
    }

    const files = await Promise.all(
      req.files.map(async (file) => {
        const url = buildFileUrl(req, file.filename);
        let thumbnailUrl = null;

        // Generate thumbnail for images
        if (file.mimetype.startsWith('image/')) {
          const thumbnailName = `thumb_${file.filename}`;
          const thumbnailPath = path.join(path.dirname(file.path), thumbnailName);
          await sharp(file.path)
            .resize(400, 400, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
          thumbnailUrl = buildFileUrl(req, thumbnailName);
        }

        return {
          url,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          thumbnailUrl,
        };
      })
    );

    return ApiResponse.success(res, { files }, 'Files uploaded successfully');
  } catch (err) {
    logger.error('File upload error:', err);
    next(err);
  }
};

module.exports = { uploadAvatar, uploadMessageFiles };
