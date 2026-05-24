/**
 * Message Model
 * Supports text, attachments, read receipts, and soft delete
 */

const mongoose = require('mongoose');

const MESSAGE_TYPES = ['text', 'image', 'file', 'system'];

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
    thumbnailUrl: { type: String, default: null }, // for images
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },
    // For direct messages — optional, derived from conversation
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
      default: '',
    },
    messageType: {
      type: String,
      enum: MESSAGE_TYPES,
      default: 'text',
    },
    attachments: [attachmentSchema],
    // Read receipts: Map of userId → timestamp
    readBy: {
      type: Map,
      of: Date,
      default: {},
    },
    // Delivery status
    deliveredTo: {
      type: Map,
      of: Date,
      default: {},
    },
    // Reply threading
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // For system messages (e.g. "User joined")
    systemData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.__v;
        // Mask deleted message content
        if (ret.isDeleted) {
          ret.content = 'This message was deleted.';
          ret.attachments = [];
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isDeleted: 1 });

// ─── Instance Methods ─────────────────────────────────────────────────────────
messageSchema.methods.markReadBy = function (userId) {
  if (!this.readBy.has(userId.toString())) {
    this.readBy.set(userId.toString(), new Date());
  }
  return this;
};

messageSchema.methods.markDeliveredTo = function (userId) {
  if (!this.deliveredTo.has(userId.toString())) {
    this.deliveredTo.set(userId.toString(), new Date());
  }
  return this;
};

messageSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this;
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
