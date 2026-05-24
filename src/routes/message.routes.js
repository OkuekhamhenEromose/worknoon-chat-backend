/**
 * Message Routes
 * POST /api/messages
 * GET  /api/messages/:conversationId
 * PUT  /api/messages/:id/read
 * PUT  /api/messages/read-all/:conversationId
 * DELETE /api/messages/:id
 */

const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getMessages,
  markMessageRead,
  markAllRead,
  deleteMessage,
} = require('../controllers/message.controller');

const { protect } = require('../middlewares/auth.middleware');
const { uploadMultiple } = require('../middlewares/upload.middleware');

router.use(protect);

router.post('/', uploadMultiple('attachments', 5), sendMessage);
router.get('/:conversationId', getMessages);
router.put('/read-all/:conversationId', markAllRead);
router.put('/:id/read', markMessageRead);
router.delete('/:id', deleteMessage);

module.exports = router;
