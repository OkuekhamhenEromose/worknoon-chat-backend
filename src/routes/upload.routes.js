/**
 * Upload Routes
 * POST /api/uploads/avatar
 * POST /api/uploads/message-files
 */

const express = require('express');
const router = express.Router();

const { uploadAvatar, uploadMessageFiles } = require('../controllers/upload.controller');
const { protect } = require('../middlewares/auth.middleware');
const { uploadSingle, uploadMultiple } = require('../middlewares/upload.middleware');

router.use(protect);

router.post('/avatar', uploadSingle('avatar'), uploadAvatar);
router.post('/message-files', uploadMultiple('files', 5), uploadMessageFiles);

module.exports = router;
