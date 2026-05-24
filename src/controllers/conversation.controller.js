/**
 * Conversation Controller
 * Create, list, fetch, and delete conversations
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const logger = require('../utils/logger');

// ─── Role → Conversation Type mapping ────────────────────────────────────────
const ROLE_PAIR_TO_TYPE = {
  'customer-designer': 'buyer-designer',
  'customer-merchant': 'buyer-merchant',
  'customer-agent': 'buyer-agent',
  'merchant-agent': 'merchant-agent',
  'admin-any': 'admin-any',
};

function resolveConversationType(roleA, roleB) {
  const adminRoles = ['admin'];
  if (adminRoles.includes(roleA) || adminRoles.includes(roleB)) return 'admin-any';

  const key = [roleA, roleB].sort().join('-');
  return ROLE_PAIR_TO_TYPE[key] || 'buyer-agent';
}

// ─── POST /api/conversations ──────────────────────────────────────────────────
const createConversation = async (req, res, next) => {
  try {
    const { participantId, conversationType, name, metadata } = req.body;

    if (!participantId) return next(ApiError.badRequest('participantId is required'));

    const participant = await User.findById(participantId);
    if (!participant || !participant.isActive) {
      return next(ApiError.notFound('Participant not found'));
    }

    if (participantId === req.user._id.toString()) {
      return next(ApiError.badRequest('You cannot start a conversation with yourself'));
    }

    // Resolve conversation type
    const type = conversationType || resolveConversationType(req.user.role, participant.role);

    // For direct (non-group) conversations: find or create
    if (type !== 'group') {
      const { conversation, created } = await Conversation.findOrCreateDirect(
        req.user._id,
        participantId,
        type
      );

      return ApiResponse[created ? 'created' : 'success'](
        res,
        { conversation },
        created ? 'Conversation created' : 'Existing conversation retrieved'
      );
    }

    // Group conversation
    const participantIds = [req.user._id, ...(req.body.participantIds || [participantId])];
    const uniqueIds = [...new Set(participantIds.map(String))];

    const conversation = await Conversation.create({
      participants: uniqueIds,
      conversationType: 'group',
      createdBy: req.user._id,
      name: name || `Group (${uniqueIds.length})`,
      metadata,
    });

    await conversation.populate('participants', '-password -refreshToken');

    logger.info(`Conversation [${type}] created by ${req.user.email}`);
    return ApiResponse.created(res, { conversation }, 'Conversation created');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/conversations ───────────────────────────────────────────────────
const getConversations = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const userId = req.user._id;

    const filter = {
      participants: userId,
      isActive: true,
      archivedBy: { $ne: userId },
    };

    if (req.query.type) filter.conversationType = req.query.type;

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .populate('participants', 'name email profileImage isOnline lastSeen role')
        .populate({
          path: 'lastMessage',
          select: 'content messageType sender createdAt isDeleted',
          populate: { path: 'sender', select: 'name' },
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filter),
    ]);

    // Attach unread count for current user
    const enriched = conversations.map((conv) => {
      const obj = conv.toObject();
      obj.unreadCount = conv.unreadCounts?.get?.(userId.toString()) || 0;
      return obj;
    });

    return ApiResponse.paginated(res, enriched, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/conversations/:id ───────────────────────────────────────────────
const getConversationById = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'name email profileImage isOnline lastSeen role')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name profileImage' },
      });

    if (!conversation) return next(ApiError.notFound('Conversation not found'));

    return ApiResponse.success(res, { conversation });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/conversations/:id (soft delete / archive) ───────────────────
const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    });

    if (!conversation) return next(ApiError.notFound('Conversation not found'));

    const userId = req.user._id;

    if (req.user.role === 'admin') {
      // Hard soft-delete for admin
      conversation.isActive = false;
      await conversation.save();
      return ApiResponse.success(res, {}, 'Conversation deleted');
    }

    // Archive for this user only
    if (!conversation.archivedBy.includes(userId)) {
      conversation.archivedBy.push(userId);
      await conversation.save();
    }

    return ApiResponse.success(res, {}, 'Conversation archived');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  deleteConversation,
};
