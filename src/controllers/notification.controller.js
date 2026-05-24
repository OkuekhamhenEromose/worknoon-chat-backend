// /**
//  * Notification Controller
//  */

// const Notification = require('../models/Notification');
// const { ApiResponse, ApiError } = require('../utils/apiResponse');
// const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');

// // ─── GET /api/notifications ───────────────────────────────────────────────────
// const getNotifications = async (req, res, next) => {
//   try {
//     const { page, limit, skip } = getPaginationParams(req.query);
//     const filter = { recipient: req.user._id };

//     if (req.query.unreadOnly === 'true') filter.isRead = false;

//     const [notifications, total, unreadCount] = await Promise.all([
//       Notification.find(filter)
//         .populate('sender', 'name profileImage')
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),
//       Notification.countDocuments(filter),
//       Notification.countDocuments({ recipient: req.user._id, isRead: false }),
//     ]);

//     return ApiResponse.paginated(
//       res,
//       { notifications, unreadCount },
//       buildPaginationMeta(total, page, limit)
//     );
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── PUT /api/notifications/:id/read ─────────────────────────────────────────
// const markNotificationRead = async (req, res, next) => {
//   try {
//     const notification = await Notification.findOne({
//       _id: req.params.id,
//       recipient: req.user._id,
//     });

//     if (!notification) return next(ApiError.notFound('Notification not found'));

//     notification.markAsRead();
//     await notification.save();

//     return ApiResponse.success(res, { notification }, 'Notification marked as read');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── PUT /api/notifications/read-all ─────────────────────────────────────────
// const markAllNotificationsRead = async (req, res, next) => {
//   try {
//     const result = await Notification.updateMany(
//       { recipient: req.user._id, isRead: false },
//       { $set: { isRead: true, readAt: new Date() } }
//     );

//     return ApiResponse.success(res, { updatedCount: result.modifiedCount }, 'All notifications marked as read');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── DELETE /api/notifications/:id ────────────────────────────────────────────
// const deleteNotification = async (req, res, next) => {
//   try {
//     const result = await Notification.findOneAndDelete({
//       _id: req.params.id,
//       recipient: req.user._id,
//     });

//     if (!result) return next(ApiError.notFound('Notification not found'));

//     return ApiResponse.success(res, {}, 'Notification deleted');
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = {
//   getNotifications,
//   markNotificationRead,
//   markAllNotificationsRead,
//   deleteNotification,
// };
