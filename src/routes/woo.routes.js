/**
 * WooCommerce Integration Routes
 * 
 * POST /api/woo/order-sync      — receive order status updates from WP
 * POST /api/woo/order-created   — new order webhook from WP
 */

const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Middleware: verify WordPress shared secret ───────────────────────────────
const verifyWordPressSecret = (req, res, next) => {
  const secret = process.env.WORDPRESS_SECRET || process.env.WORKNOON_CHAT_API_SECRET || '';
  const provided = req.headers['x-worknoon-secret'] || '';
  if (secret && secret !== provided) {
    return next(ApiError.forbidden('Invalid WordPress secret'));
  }
  next();
};

// ─── POST /api/woo/order-sync ─────────────────────────────────────────────────
// Receives order status changes from WordPress/WooCommerce
router.post('/order-sync', verifyWordPressSecret, async (req, res, next) => {
  try {
    const {
      orderId,
      customerId,
      oldStatus,
      newStatus,
      total,
      currency,
      items = [],
      orderUrl,
    } = req.body;

    if (!orderId) return next(ApiError.badRequest('orderId is required'));

    logger.info(`WooCommerce order sync: order #${orderId} ${oldStatus} → ${newStatus}`);

    // Find conversations linked to this order
    const conversations = await Conversation.find({
      'metadata.orderId': String(orderId),
      isActive: true,
    }).populate('participants', '_id isOnline');

    // If a conversation exists, send a system notification about the status change
    for (const conv of conversations) {
      // Notify all participants
      for (const participant of conv.participants) {
        await Notification.create({
          recipient: participant._id,
          type: 'order_update',
          message: `Order #${orderId} status changed: ${oldStatus} → ${newStatus}`,
          resourceType: 'conversation',
          resourceId: conv._id,
          metadata: { orderId, oldStatus, newStatus, total, currency },
        });
      }
    }

    return ApiResponse.success(res, {
      synced: true,
      conversationsNotified: conversations.length,
      orderId,
      newStatus,
    }, 'Order status synced');
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/woo/order-created ─────────────────────────────────────────────
// Called when a new WooCommerce order is placed
router.post('/order-created', verifyWordPressSecret, async (req, res, next) => {
  try {
    const {
      orderId,
      wpUserId,
      email,
      productIds = [],
      total,
      currency,
    } = req.body;

    if (!orderId || !email) {
      return next(ApiError.badRequest('orderId and email are required'));
    }

    logger.info(`WooCommerce new order: #${orderId} from ${email}`);

    // Find the customer in our system
    const customer = await User.findOne({ email });
    if (!customer) {
      // Customer doesn't have a chat account yet — that's okay
      return ApiResponse.success(res, { registered: false }, 'Customer not found in chat system');
    }

    // Find an available support agent (least busy)
    const agent = await User.findOne({ role: 'agent', isActive: true })
      .sort({ activeConversations: 1 });

    if (agent) {
      // Create a conversation with order context
      const { conversation, created } = await Conversation.findOrCreateDirect(
        customer._id,
        agent._id,
        'buyer-agent'
      );

      if (created || !conversation.metadata?.orderId) {
        conversation.metadata = {
          orderId: String(orderId),
          context: `Order #${orderId} — ${currency} ${total}`,
        };
        await conversation.save();

        // Notify the agent
        await Notification.create({
          recipient: agent._id,
          sender: customer._id,
          type: 'new_conversation',
          message: `New order from ${customer.name}: Order #${orderId} (${currency} ${total})`,
          resourceType: 'conversation',
          resourceId: conversation._id,
          metadata: { orderId, total, currency },
        });
      }

      return ApiResponse.success(res, {
        registered: true,
        conversationId: conversation._id,
        created,
      }, 'Order conversation ready');
    }

    return ApiResponse.success(res, { registered: true, conversationId: null }, 'No agents available');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
