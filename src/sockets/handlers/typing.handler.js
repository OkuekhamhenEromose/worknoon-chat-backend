/**
 * Typing Indicator Socket Handler
 * Broadcasts typing start/stop with automatic timeout
 *
 * Client Events:
 *   typing:start   { conversationId }
 *   typing:stop    { conversationId }
 *
 * Server Events:
 *   typing:started { conversationId, userId, name }
 *   typing:stopped { conversationId, userId }
 */

const logger = require('../../utils/logger');

// Track typing timeouts per user per conversation
const typingTimeouts = new Map();

module.exports = function typingHandler(io, socket) {
  const userId = socket.user._id.toString();
  const userName = socket.user.name;

  socket.on('typing:start', ({ conversationId }) => {
    if (!conversationId) return;

    const key = `${userId}:${conversationId}`;

    // Clear any existing timeout (user is still typing)
    if (typingTimeouts.has(key)) {
      clearTimeout(typingTimeouts.get(key));
    }

    // Broadcast to everyone else in the room
    socket.to(`conversation:${conversationId}`).emit('typing:started', {
      conversationId,
      userId,
      name: userName,
    });

    // Auto-stop after 5 seconds of no update
    const timeout = setTimeout(() => {
      socket.to(`conversation:${conversationId}`).emit('typing:stopped', {
        conversationId,
        userId,
      });
      typingTimeouts.delete(key);
    }, 5000);

    typingTimeouts.set(key, timeout);
  });

  socket.on('typing:stop', ({ conversationId }) => {
    if (!conversationId) return;

    const key = `${userId}:${conversationId}`;
    if (typingTimeouts.has(key)) {
      clearTimeout(typingTimeouts.get(key));
      typingTimeouts.delete(key);
    }

    socket.to(`conversation:${conversationId}`).emit('typing:stopped', {
      conversationId,
      userId,
    });
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    for (const [key, timeout] of typingTimeouts.entries()) {
      if (key.startsWith(`${userId}:`)) {
        clearTimeout(timeout);
        typingTimeouts.delete(key);
      }
    }
  });
};
