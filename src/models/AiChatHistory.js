const mongoose = require('mongoose');

const AiChatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },

    reply: {
      type: String,
      required: true,
    },

    farmName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    cropType: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },

    category: {
      type: String,
      default: 'Agronomic Consultation',
    },

    modelUsed: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

AiChatHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AiChatHistory', AiChatHistorySchema);
