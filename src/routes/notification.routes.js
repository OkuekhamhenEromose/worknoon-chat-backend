/**
 * Notification Routes
 * GET    /api/notifications
 * PUT    /api/notifications/read-all
 * PUT    /api/notifications/:id/read
 * DELETE /api/notifications/:id
 */

const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require('../controllers/notification.controller');

const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
router.delete('/:id', deleteNotification);

module.exports = router;
