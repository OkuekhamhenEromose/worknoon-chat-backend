/**
 * Chat Socket Handler
 * Manages conversation rooms, real-time messaging, delivery & read receipts
 *
 * Client Events:
 *   conversation:join      { conversationId }
 *   conversation:leave     { conversationId }
 *   message:send           { conversationId, content, messageType?, replyTo?, tempId }
 *   message:delivered      { messageId }
 *   message:read           { messageId, conversationId }
 *   message:delete         { messageId, conversationId }
 *
 * Server Events (emitted):
 *   conversation:joined    { conversationId, userId }
 *   message:new            { message }
 *   message:delivered      { messageId, deliveredTo, deliveredAt }
 *   message:read           { messageId, readBy, readAt }
 *   message:deleted        { messageId, conversationId }
 *   error                  { event, message }
 */

const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const logger = require('../../utils/logger');

module.exports = function chatHandler(io, socket, presenceMap) {
  const userId = socket.user._id.toString();

  // ── Join Conversation Room ─────────────────────────────────────────────────
  socket.on('conversation:join', async ({ conversationId }) => {
    try {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.user._id,
        isActive: true,
      });

      if (!conversation) {
        return socket.emit('error', { event: 'conversation:join', message: 'Conversation not found' });
      }

      socket.join(`conversation:${conversationId}`);
      logger.debug(`${socket.user.email} joined room conversation:${conversationId}`);

      socket.to(`conversation:${conversationId}`).emit('conversation:joined', {
        conversationId,
        userId,
        name: socket.user.name,
      });
    } catch (err) {
      logger.error('conversation:join error:', err.message);
      socket.emit('error', { event: 'conversation:join', message: 'Failed to join conversation' });
    }
  });

  // ── Leave Conversation Room ────────────────────────────────────────────────
  socket.on('conversation:leave', ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
    logger.debug(`${socket.user.email} left room conversation:${conversationId}`);
  });

  // ── Send Message ───────────────────────────────────────────────────────────
  socket.on('message:send', async ({ conversationId, content, messageType, replyTo, tempId, attachments }) => {
    try {
      if (!conversationId) {
        return socket.emit('error', { event: 'message:send', message: 'conversationId required' });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.user._id,
        isActive: true,
      });

      if (!conversation) {
        return socket.emit('error', { event: 'message:send', message: 'Conversation not found or access denied' });
      }

      if (!content && (!attachments || attachments.length === 0)) {
        return socket.emit('error', { event: 'message:send', message: 'Message must have content or attachments' });
      }

      // Create message in DB
      const message = await Message.create({
        conversationId,
        sender: socket.user._id,
        content: content?.trim() || '',
        messageType: messageType || 'text',
        attachments: attachments || [],
        replyTo: replyTo || null,
      });

      await message.populate('sender', 'name email profileImage role');
      if (replyTo) await message.populate('replyTo', 'content sender messageType');

      // Update conversation last message
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
      });

      // Increment unread counts for offline participants
      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== userId
      );

      const unreadUpdate = {};
      for (const pid of otherParticipants) {
        unreadUpdate[`unreadCounts.${pid}`] = (conversation.unreadCounts?.get?.(pid.toString()) || 0) + 1;
      }
      await Conversation.findByIdAndUpdate(conversationId, { $set: unreadUpdate });

      const messageObj = message.toObject();
      messageObj.tempId = tempId; // echo back client temp ID for optimistic UI

      // Broadcast to everyone in room (including sender — for multi-device)
      io.to(`conversation:${conversationId}`).emit('message:new', { message: messageObj });

      // Notify participants NOT in the room (offline/different page)
      for (const pid of otherParticipants) {
        const pidStr = pid.toString();
        const isInRoom = (await io.in(`conversation:${conversationId}`).fetchSockets())
          .some((s) => s.user?._id.toString() === pidStr);

        if (!isInRoom) {
          // Send to personal room
          io.to(`user:${pidStr}`).emit('notification:new_message', {
            conversationId,
            message: messageObj,
            senderName: socket.user.name,
          });

          // Save in-app notification
          await Notification.create({
            recipient: pid,
            sender: socket.user._id,
            type: 'new_message',
            message: `${socket.user.name}: ${(content || '[attachment]').substring(0, 80)}`,
            resourceType: 'conversation',
            resourceId: conversation._id,
          });
        }
      }

      logger.debug(`Message sent in conversation ${conversationId}`);
    } catch (err) {
      logger.error('message:send error:', err.message);
      socket.emit('error', { event: 'message:send', message: 'Failed to send message' });
    }
  });

  // ── Message Delivered ─────────────────────────────────────────────────────
  socket.on('message:delivered', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      message.markDeliveredTo(userId);
      await message.save();

      // Notify sender
      io.to(`user:${message.sender.toString()}`).emit('message:delivered', {
        messageId,
        deliveredTo: userId,
        deliveredAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('message:delivered error:', err.message);
    }
  });

  // ── Message Read ───────────────────────────────────────────────────────────
  socket.on('message:read', async ({ messageId, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      message.markReadBy(userId);
      await message.save();

      // Reset unread count for this user
      await Conversation.findByIdAndUpdate(conversationId, {
        $set: { [`unreadCounts.${userId}`]: 0 },
      });

      // Notify sender (and others in room)
      io.to(`conversation:${conversationId}`).emit('message:read', {
        messageId,
        readBy: userId,
        readAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('message:read error:', err.message);
    }
  });

  // ── Delete Message ─────────────────────────────────────────────────────────
  socket.on('message:delete', async ({ messageId, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit('error', { event: 'message:delete', message: 'Message not found' });
      }

      if (
        message.sender.toString() !== userId &&
        socket.user.role !== 'admin'
      ) {
        return socket.emit('error', { event: 'message:delete', message: 'Not authorized' });
      }

      message.softDelete();
      await message.save();

      io.to(`conversation:${conversationId}`).emit('message:deleted', {
        messageId,
        conversationId,
        deletedBy: userId,
      });
    } catch (err) {
      logger.error('message:delete error:', err.message);
      socket.emit('error', { event: 'message:delete', message: 'Failed to delete message' });
    }
  });
};
