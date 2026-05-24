// /**
//  * Message Controller
//  * Send, fetch, mark read, and delete messages
//  */

// const Message = require('../models/Message');
// const Conversation = require('../models/Conversation');
// const Notification = require('../models/Notification');
// const User = require('../models/User');
// const { ApiResponse, ApiError } = require('../utils/apiResponse');
// const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
// const { sendNewMessageNotification } = require('../utils/email');
// const logger = require('../utils/logger');

// // ─── POST /api/messages ───────────────────────────────────────────────────────
// const sendMessage = async (req, res, next) => {
//   try {
//     const { conversationId, content, messageType, replyTo } = req.body;

//     if (!conversationId) return next(ApiError.badRequest('conversationId is required'));
//     if (!content && (!req.files || req.files.length === 0)) {
//       return next(ApiError.badRequest('Message must have content or attachments'));
//     }

//     // Verify sender is in the conversation
//     const conversation = await Conversation.findOne({
//       _id: conversationId,
//       participants: req.user._id,
//       isActive: true,
//     });
//     if (!conversation) return next(ApiError.notFound('Conversation not found'));

//     // Build attachments array from uploaded files
//     const attachments = req.files
//       ? req.files.map((file) => ({
//           url: `/uploads/${file.filename}`,
//           originalName: file.originalname,
//           mimeType: file.mimetype,
//           size: file.size,
//         }))
//       : [];

//     // Determine message type
//     const resolvedType = attachments.length > 0
//       ? (attachments[0].mimeType.startsWith('image/') ? 'image' : 'file')
//       : (messageType || 'text');

//     const message = await Message.create({
//       conversationId,
//       sender: req.user._id,
//       content: content || '',
//       messageType: resolvedType,
//       attachments,
//       replyTo: replyTo || null,
//     });

//     await message.populate('sender', 'name email profileImage role');
//     if (replyTo) await message.populate('replyTo', 'content sender');

//     // Update conversation's last message
//     await Conversation.findByIdAndUpdate(conversationId, {
//       lastMessage: message._id,
//       lastMessageAt: message.createdAt,
//     });

//     // Increment unread count for all other participants
//     const otherParticipants = conversation.participants.filter(
//       (p) => p.toString() !== req.user._id.toString()
//     );

//     const unreadUpdate = {};
//     for (const participantId of otherParticipants) {
//       const key = `unreadCounts.${participantId}`;
//       unreadUpdate[key] = (conversation.unreadCounts?.get?.(participantId.toString()) || 0) + 1;
//     }
//     await Conversation.findByIdAndUpdate(conversationId, { $set: unreadUpdate });

//     // Create in-app notifications for offline participants
//     const offlineParticipants = await User.find({
//       _id: { $in: otherParticipants },
//       isOnline: false,
//     });

//     if (offlineParticipants.length > 0) {
//       const notifications = offlineParticipants.map((p) => ({
//         recipient: p._id,
//         sender: req.user._id,
//         type: 'new_message',
//         message: `${req.user.name}: ${(content || '[attachment]').substring(0, 80)}`,
//         resourceType: 'conversation',
//         resourceId: conversation._id,
//       }));

//       await Notification.insertMany(notifications);

//       // Send email notifications (fire-and-forget)
//       for (const p of offlineParticipants) {
//         sendNewMessageNotification({
//           recipientEmail: p.email,
//           recipientName: p.name,
//           senderName: req.user.name,
//           preview: (content || '[attachment]').substring(0, 200),
//           conversationId: conversation._id.toString(),
//         }).catch((err) => logger.warn('Email notification failed:', err.message));
//       }
//     }

//     logger.info(`Message sent in conversation ${conversationId} by ${req.user.email}`);
//     return ApiResponse.created(res, { message }, 'Message sent');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── GET /api/messages/:conversationId ───────────────────────────────────────
// const getMessages = async (req, res, next) => {
//   try {
//     const { conversationId } = req.params;
//     const { page, limit, skip } = getPaginationParams(req.query);

//     // Ensure user belongs to conversation
//     const conversation = await Conversation.findOne({
//       _id: conversationId,
//       participants: req.user._id,
//     });
//     if (!conversation) return next(ApiError.notFound('Conversation not found'));

//     const [messages, total] = await Promise.all([
//       Message.find({ conversationId, isDeleted: false })
//         .populate('sender', 'name email profileImage role')
//         .populate('replyTo', 'content sender messageType')
//         .sort({ createdAt: -1 }) // newest first for cursor pagination
//         .skip(skip)
//         .limit(limit),
//       Message.countDocuments({ conversationId, isDeleted: false }),
//     ]);

//     return ApiResponse.paginated(
//       res,
//       messages.reverse(), // chronological order
//       buildPaginationMeta(total, page, limit)
//     );
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── PUT /api/messages/:id/read ───────────────────────────────────────────────
// const markMessageRead = async (req, res, next) => {
//   try {
//     const message = await Message.findById(req.params.id);
//     if (!message) return next(ApiError.notFound('Message not found'));

//     const userId = req.user._id.toString();
//     message.markReadBy(userId);
//     await message.save();

//     // Reset unread count for this user
//     const key = `unreadCounts.${userId}`;
//     await Conversation.findByIdAndUpdate(message.conversationId, { $set: { [key]: 0 } });

//     return ApiResponse.success(res, { message }, 'Message marked as read');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── PUT /api/messages/read-all/:conversationId ───────────────────────────────
// const markAllRead = async (req, res, next) => {
//   try {
//     const { conversationId } = req.params;
//     const userId = req.user._id.toString();

//     // Mark all unread messages in conversation as read
//     const unreadMessages = await Message.find({
//       conversationId,
//       isDeleted: false,
//       [`readBy.${userId}`]: { $exists: false },
//       sender: { $ne: req.user._id },
//     });

//     await Promise.all(
//       unreadMessages.map((msg) => {
//         msg.markReadBy(userId);
//         return msg.save();
//       })
//     );

//     // Reset unread count
//     const key = `unreadCounts.${userId}`;
//     await Conversation.findByIdAndUpdate(conversationId, { $set: { [key]: 0 } });

//     return ApiResponse.success(res, { markedCount: unreadMessages.length }, 'All messages marked as read');
//   } catch (err) {
//     next(err);
//   }
// };

// // ─── DELETE /api/messages/:id (soft delete) ───────────────────────────────────
// const deleteMessage = async (req, res, next) => {
//   try {
//     const message = await Message.findById(req.params.id);
//     if (!message) return next(ApiError.notFound('Message not found'));

//     if (
//       message.sender.toString() !== req.user._id.toString() &&
//       req.user.role !== 'admin'
//     ) {
//       return next(ApiError.forbidden('You can only delete your own messages'));
//     }

//     message.softDelete();
//     await message.save();

//     return ApiResponse.success(res, {}, 'Message deleted');
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = { sendMessage, getMessages, markMessageRead, markAllRead, deleteMessage };
