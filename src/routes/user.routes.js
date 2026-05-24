/**
 * User Routes
 * GET    /api/users            — admin only
 * GET    /api/users/agents     — get available agents
 * GET    /api/users/:id
 * PUT    /api/users/:id
 * DELETE /api/users/:id        — admin only
 */

const express = require('express');
const router = express.Router();

const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAvailableAgents,
} = require('../controllers/user.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');

// All user routes require auth
router.use(protect);

router.get('/', authorize('admin'), getUsers);
router.get('/agents', getAvailableAgents);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
