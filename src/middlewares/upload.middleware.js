/**
 * File Upload Middleware
 * Multer + Sharp for image optimization
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../utils/apiResponse');

const ALLOWED_MIMES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,image/webp,application/pdf').split(',');
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

// Use disk storage for persistence
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(`File type '${file.mimetype}' not allowed. Allowed: ${ALLOWED_MIMES.join(', ')}`, 400),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: 5 }, // max 5 files per request
});

// Named exports for route usage
const uploadSingle = (fieldName = 'file') => upload.single(fieldName);
const uploadMultiple = (fieldName = 'files', maxCount = 5) => upload.array(fieldName, maxCount);
const uploadFields = (fields) => upload.fields(fields);

// Build public URL for a stored file
function buildFileUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

module.exports = { uploadSingle, uploadMultiple, uploadFields, buildFileUrl };
