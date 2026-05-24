/**
 * Conversation Routes
 * POST   /api/conversations
 * GET    /api/conversations
 * GET    /api/conversations/:id
 * DELETE /api/conversations/:id
 */

const express = require('express');
const router = express.Router();

const {
  createConversation,
  getConversations,
  getConversationById,
  deleteConversation,
} = require('../controllers/conversation.controller');

const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.route('/')
  .post(createConversation)
  .get(getConversations);

router.route('/:id')
  .get(getConversationById)
  .delete(deleteConversation);

module.exports = router;
