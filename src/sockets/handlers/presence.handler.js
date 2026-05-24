/**
 * Presence Socket Handler
 * Tracks online/offline status and provides presence queries
 *
 * Client Events:
 *   presence:request   { userIds: string[] }
 *
 * Server Events:
 *   presence:status    { presences: { userId, isOnline, lastSeen }[] }
 *   user:online        { userId, name, profileImage }
 *   user:offline       { userId, lastSeen }
 */

const User = require('../../models/User');
const logger = require('../../utils/logger');

module.exports = function presenceHandler(io, socket, presenceMap) {
  const userId = socket.user._id.toString();

  // Client can query current presence for a list of users
  socket.on('presence:request', async ({ userIds }) => {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) return;

      // Cap at 50 to prevent abuse
      const limitedIds = userIds.slice(0, 50);

      const users = await User.find({ _id: { $in: limitedIds } })
        .select('_id isOnline lastSeen');

      const presences = users.map((u) => ({
        userId: u._id.toString(),
        isOnline: presenceMap.has(u._id.toString()) || u.isOnline,
        lastSeen: u.lastSeen,
      }));

      socket.emit('presence:status', { presences });
    } catch (err) {
      logger.error('presence:request error:', err.message);
    }
  });
};
