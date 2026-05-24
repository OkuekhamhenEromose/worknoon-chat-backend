/**
 * Conversation Model
 * Supports all conversation types in the eCommerce ecosystem
 */

const mongoose = require('mongoose');

const CONVERSATION_TYPES = [
  'buyer-designer',
  'buyer-merchant',
  'buyer-agent',
  'merchant-agent',
  'admin-any',
  'group',
];

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    conversationType: {
      type: String,
      enum: { values: CONVERSATION_TYPES, message: 'Invalid conversation type: {VALUE}' },
      required: [true, 'Conversation type is required'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    // For group chats
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    groupImage: {
      type: String,
      default: null,
    },
    // Soft delete — archived per participant
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // For WooCommerce integration — link to a specific product/order
    metadata: {
      productId: { type: String, default: null },
      orderId: { type: String, default: null },
      context: { type: String, default: null }, // e.g. "order #1234 inquiry"
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Unread count per participant
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_, ret) => { delete ret.__v; return ret; } },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
conversationSchema.index({ participants: 1 });
conversationSchema.index({ createdBy: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ conversationType: 1 });
conversationSchema.index({ 'metadata.productId': 1 });
conversationSchema.index({ 'metadata.orderId': 1 });

// Prevent duplicate direct conversations between the same two users
conversationSchema.index(
  { participants: 1, conversationType: 1 },
  { unique: false } // not unique — same pair can have different types
);

// ─── Virtual: participant count ────────────────────────────────────────────────
conversationSchema.virtual('participantCount').get(function () {
  return this.participants.length;
});

// ─── Static: find or create DM conversation ───────────────────────────────────
conversationSchema.statics.findOrCreateDirect = async function (userA, userB, type) {
  const existing = await this.findOne({
    participants: { $all: [userA, userB], $size: 2 },
    conversationType: type,
    isActive: true,
  }).populate('participants', '-password -refreshToken');

  if (existing) return { conversation: existing, created: false };

  const conversation = await this.create({
    participants: [userA, userB],
    conversationType: type,
    createdBy: userA,
  });

  await conversation.populate('participants', '-password -refreshToken');
  return { conversation, created: true };
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
